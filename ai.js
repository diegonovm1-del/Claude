/*
  Módulo de IA do Leitor.

  Nesta versão o modelo ainda não está conectado: ask() lança o erro IA_DESLIGADA
  e o app mostra o que seria enviado. Na próxima etapa este arquivo passa a carregar
  um modelo local (WebLLM) e ask() devolve a resposta em partes (streaming),
  chamando onToken(texto) a cada pedaço. O resto do app não precisa mudar.
*/
window.LeitorAI = {
  status: 'off', // 'off' | 'loading' | 'ready'

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

  async ask(messages, onToken) {
    throw new Error('IA_DESLIGADA');
  }
};
