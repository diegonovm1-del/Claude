/*
  Módulo de IA do Leitor.

  A IA roda no próprio celular com o WebLLM (webllm.js, carregado só quando a IA
  é usada) dentro de um worker (ai-worker.js), usando a placa de vídeo pelo WebGPU.
  O modelo é baixado uma vez e fica guardado no armazenamento do Chrome; depois
  disso funciona sem internet.

  O resto do app usa:
    LeitorAI.check()          compatibilidade do aparelho
    LeitorAI.installedId()    modelo já baixado (ou null)
    LeitorAI.install(key)     baixa e prepara um modelo
    LeitorAI.ask(msgs, onToken, onProgress)  responde em partes (streaming)
    LeitorAI.remove()         apaga o modelo do aparelho
*/
window.LeitorAI = {
  status: 'off', // 'off' | 'loading' | 'ready'
  engine: null,
  worker: null,
  modelId: null,
  lastReport: null,
  listeners: new Set(),

  MODELS: [
    {
      key: 'qwen15', name: 'Qwen2.5 1.5B', size: 'cerca de 1 GB', memGB: 1.6,
      note: 'Recomendado. Traduz e explica bem em português.',
      ids: { f16: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', f32: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC' }
    },
    {
      key: 'qwen05', name: 'Qwen2.5 0.5B', size: 'cerca de 300 MB', memGB: 0.9,
      note: 'Mais leve e rápido, com respostas mais simples.',
      ids: { f16: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', f32: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC' }
    }
  ],

  system: [
    'Você é um assistente de leitura que ajuda um leitor brasileiro.',
    'Responda sempre em português do Brasil, de forma curta e clara.',
    'Quando o pedido for traduzir: se o trecho for uma palavra ou expressão, dê a tradução,',
    'a classe gramatical, o significado no contexto da frase e um exemplo curto;',
    'se for uma frase ou um parágrafo, dê uma tradução natural.',
    'Quando o pedido for o significado, explique com palavras simples, considerando o contexto.',
    'Se não tiver certeza, diga isso em vez de inventar.'
  ].join(' '),

  presets: [
    ['Traduzir', 'Traduza o trecho para o português.'],
    ['Significado', 'Qual é o significado deste trecho no contexto?'],
    ['Explicar', 'Explique o trecho com palavras simples.'],
    ['Resumir', 'Resuma o trecho em uma frase.']
  ],

  buildMessages({ docName, page, text, comment, ask }) {
    const user = [
      `Documento: ${docName} (página ${page})`,
      `Trecho marcado: “${text}”`,
      comment ? `Comentário do leitor: ${comment}` : null,
      `Pedido: ${ask}`
    ].filter(Boolean).join('\n\n');
    return [
      { role: 'system', content: this.system },
      { role: 'user', content: user }
    ];
  },

  /* ---------- utilidades ---------- */
  lib() {
    if (!this._lib) this._lib = import('./webllm.js').catch(e => { this._lib = null; throw e; });
    return this._lib;
  },
  modelOf(id) { return this.MODELS.find(m => m.ids.f16 === id || m.ids.f32 === id) || null; },
  saved() { try { return localStorage.getItem('leitor-ia') || null; } catch (e) { return null; } },
  save(id) { try { id ? localStorage.setItem('leitor-ia', id) : localStorage.removeItem('leitor-ia'); } catch (e) {} },
  emit(r) { this.lastReport = r; for (const f of this.listeners) { try { f(r); } catch (e) {} } },

  /* ---------- compatibilidade ---------- */
  async check() {
    if (!('gpu' in navigator)) {
      return { ok: false, reason: 'Este navegador não tem WebGPU, que a IA precisa para usar a placa de vídeo. Use o Chrome atualizado.' };
    }
    let a = null;
    try { a = await navigator.gpu.requestAdapter(); } catch (e) {}
    if (!a) return { ok: false, reason: 'O WebGPU está desligado ou não encontrou a placa de vídeo. Confira em chrome://gpu se a linha WebGPU diz "Hardware accelerated".' };
    return { ok: true, f16: a.features.has('shader-f16') };
  },

  async installedId() {
    const L = await this.lib();
    const all = this.MODELS.flatMap(m => [m.ids.f16, m.ids.f32]);
    const pref = this.saved();
    const order = pref && all.includes(pref) ? [pref, ...all.filter(x => x !== pref)] : all;
    for (const id of order) {
      try { if (await L.hasModelInCache(id, L.prebuiltAppConfig)) return id; } catch (e) {}
    }
    return null;
  },

  /* ---------- carregar, instalar, remover ---------- */
  stop() {
    try { this.worker && this.worker.terminate(); } catch (e) {}
    this.worker = null; this.engine = null; this.modelId = null; this.status = 'off';
  },

  load(id, onProgress) {
    if (this.engine && this.modelId === id) return Promise.resolve();
    if (this._loading && this._loadingId === id) {
      if (onProgress) this.listeners.add(onProgress);
      return this._loading.finally(() => onProgress && this.listeners.delete(onProgress));
    }
    this.stop();
    this.status = 'loading'; this._loadingId = id; this.lastReport = null;
    if (onProgress) this.listeners.add(onProgress);
    this._loading = (async () => {
      const L = await this.lib();
      this.worker = new Worker('ai-worker.js', { type: 'module' });
      this.engine = await L.CreateWebWorkerMLCEngine(
        this.worker, id,
        { appConfig: L.prebuiltAppConfig, initProgressCallback: r => this.emit(r) },
        { context_window_size: 2048 }
      );
      this.modelId = id; this.status = 'ready';
    })().catch(e => { this.stop(); throw e; })
      .finally(() => { this._loading = null; this._loadingId = null; if (onProgress) this.listeners.delete(onProgress); });
    return this._loading;
  },

  async install(key, onProgress) {
    const c = await this.check();
    if (!c.ok) throw new Error(c.reason);
    const m = this.MODELS.find(x => x.key === key) || this.MODELS[0];
    const id = c.f16 ? m.ids.f16 : m.ids.f32;
    await this.load(id, onProgress);
    this.save(id);
    // remove outros modelos baixados antes, para não ocupar espaço à toa
    const L = await this.lib();
    for (const other of this.MODELS.flatMap(x => [x.ids.f16, x.ids.f32])) {
      if (other === id) continue;
      try { if (await L.hasModelInCache(other, L.prebuiltAppConfig)) await L.deleteModelAllInfoInCache(other, L.prebuiltAppConfig); } catch (e) {}
    }
    return id;
  },

  async remove() {
    const L = await this.lib();
    this.stop();
    for (const id of this.MODELS.flatMap(m => [m.ids.f16, m.ids.f32])) {
      try { if (await L.hasModelInCache(id, L.prebuiltAppConfig)) await L.deleteModelAllInfoInCache(id, L.prebuiltAppConfig); } catch (e) {}
    }
    this.save(null);
  },

  /* ---------- perguntar ---------- */
  async ask(messages, onToken, onProgress) {
    if (!this.engine) {
      const id = await this.installedId();
      if (!id) throw new Error('IA_DESLIGADA');
      await this.load(id, onProgress);
    }
    try {
      const chunks = await this.engine.chat.completions.create({
        messages, stream: true, temperature: 0.3, max_tokens: 512
      });
      for await (const ch of chunks) {
        const t = ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content;
        if (t) onToken(t);
      }
    } catch (e) {
      // o Android pode desligar a placa de vídeo do app em segundo plano; na próxima pergunta recarrega
      this.stop();
      throw e;
    }
  },

  /* teste rápido depois de instalar: devolve a resposta e a velocidade */
  async test(onToken) {
    const t0 = performance.now(); let n = 0, out = '';
    await this.ask([
      { role: 'system', content: this.system },
      { role: 'user', content: 'Traduza para o português, em uma linha: "The little prince"' }
    ], t => { n++; out += t; onToken && onToken(out); });
    const s = (performance.now() - t0) / 1000;
    return { text: out.trim(), tokPerSec: n / Math.max(s, 0.001) };
  }
};
