(()=>{
'use strict';

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const el=(tag,props={},...kids)=>{
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(props)){
    if(k==='class')e.className=v;
    else if(k==='style')e.style.cssText=v;
    else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v);
  }
  kids.flat().filter(c=>c!=null&&c!==false).forEach(c=>e.append(c.nodeType?c:document.createTextNode(c)));
  return e;
};
const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
const clip=(s,n)=>s.length>n?s.slice(0,n)+'…':s;
const ICON={
  back:'<path d="M15 5l-7 7 7 7"/>',
  bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',
  list:'<path d="M4 6h16M4 12h16M4 18h10"/>',
  aa:'<path d="M3 19l5-13 5 13M5 14h6M15 19l3.5-8 3.5 8M16.3 16h4.4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  comment:'<path d="M4 5h16v11H9l-5 4z"/>',
  send:'<path d="M5 12l15-7-5 15-3-6z"/>',
  file:'<path d="M7 3h7l4 4v14H7zM14 3v4h4"/>',
  image:'<path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01"/>',
  text:'<path d="M5 6h14M5 11h14M5 16h9"/>',
  archive:'<path d="M4 5h16v4H4zM5 9v10h14V9M10 13h4"/>',
  download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload:'<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>'
};
const ico=n=>{const s=document.createElement('span');s.style.display='inline-grid';s.innerHTML=`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;return s};
const COLORS={yellow:'rgba(255,208,0,.55)',green:'rgba(70,200,90,.5)',blue:'rgba(60,150,255,.5)',pink:'rgba(255,90,150,.5)'};
const SOLID={yellow:'#f2c200',green:'#38b24a',blue:'#2d8cff',pink:'#f0508f'};
const NAMES={yellow:'Amarelo',green:'Verde',blue:'Azul',pink:'Rosa'};
const KIND={pdf:'PDF',image:'Imagem',text:'Texto'};

let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2400)}

/* ---------- armazenamento (IndexedDB, com reserva em memória) ---------- */
const store={
  mem:{docs:new Map(),files:new Map(),marks:new Map(),bms:new Map()},
  idb:null,
  async open(){
    try{
      this.idb=await new Promise((res,rej)=>{
        const r=indexedDB.open('leitor',1);
        r.onupgradeneeded=()=>{const d=r.result;['docs','files','marks','bms'].forEach(n=>d.createObjectStore(n,{keyPath:'id'}))};
        r.onsuccess=()=>res(r.result);
        r.onerror=()=>rej(r.error);
      });
    }catch(e){this.idb=null}
  },
  tx(n,mode,fn){
    return new Promise((res,rej)=>{
      const t=this.idb.transaction(n,mode);
      const rq=fn(t.objectStore(n));
      t.oncomplete=()=>res(rq&&rq.result);
      t.onerror=()=>rej(t.error);
      t.onabort=()=>rej(t.error);
    });
  },
  async all(n){
    if(!this.idb)return [...this.mem[n].values()];
    try{return await this.tx(n,'readonly',s=>s.getAll())}catch(e){return [...this.mem[n].values()]}
  },
  async get(n,id){
    if(!this.idb)return this.mem[n].get(id);
    try{return await this.tx(n,'readonly',s=>s.get(id))}catch(e){return this.mem[n].get(id)}
  },
  async put(n,v){
    this.mem[n].set(v.id,v);
    if(this.idb){try{await this.tx(n,'readwrite',s=>s.put(v))}catch(e){}}
  },
  async del(n,id){
    this.mem[n].delete(id);
    if(this.idb){try{await this.tx(n,'readwrite',s=>s.delete(id))}catch(e){}}
  }
};

/* ---------- estado ---------- */
const state={docs:[],cur:null,pdf:null,textPages:null,imgUrl:null,base:{width:612,height:792},n:1,scale:1,zoom:1,curPage:1,marks:[],bms:[],sel:null,openMark:null,lastW:0};
let obs=null;

/* ---------- telas ---------- */
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id))}

/* ---------- biblioteca ---------- */
async function loadDocs(){
  state.docs=(await store.all('docs')).sort((a,b)=>(b.opened||b.added)-(a.opened||a.added));
}
function renderLibrary(){
  const b=$('#libBody');b.replaceChildren();
  if(!state.docs.length){
    b.append(el('div',{class:'empty'},
      el('h2',{},'Sua biblioteca está vazia'),
      el('p',{},'Importe um PDF, uma imagem ou um arquivo de texto. Os arquivos ficam só neste aparelho.'),
      el('div',{class:'row'},
        el('button',{class:'btn primary',onclick:openImport},ico('plus'),'Importar arquivo'),
        el('button',{class:'btn',onclick:loadSample},'Abrir documento de exemplo'),
        el('button',{class:'btn',onclick:pickBackup},ico('upload'),'Restaurar backup')
      )));
    return;
  }
  const g=el('div',{class:'grid'});
  for(const d of state.docs){
    const cover=el('div',{class:'cover'},d.thumb?el('img',{src:d.thumb,alt:''}):el('div',{class:'ph'},(d.name[0]||'?').toUpperCase()));
    const pct=d.pages>1?Math.round((d.lastPage-1)/(d.pages-1)*100):0;
    const card=el('div',{class:'card'},
      el('button',{class:'card',style:'border:0;border-radius:0;width:100%',onclick:()=>openDoc(d.id),'aria-label':'Abrir '+d.name},
        cover,
        el('div',{class:'cmeta'},
          el('div',{class:'cname'},d.name),
          el('div',{class:'csub'},`${KIND[d.kind]} • ${d.pages} ${d.pages===1?'página':'páginas'}`),
          el('div',{class:'csub'},d.lastPage>1?`Parou na página ${d.lastPage}`:'Não iniciado'),
          el('div',{class:'bar'},el('i',{style:`width:${pct}%`}))
        )),
      el('button',{class:'del','aria-label':'Remover '+d.name,onclick:e=>{e.stopPropagation();confirmRemove(d)}},ico('trash'))
    );
    g.append(card);
  }
  b.append(g);
}
function confirmRemove(d){
  const w=el('div');
  w.append(sheetHead('Remover documento'));
  w.append(el('p',{},`“${d.name}” será removido da biblioteca, junto com os marcadores e as marcações dele.`));
  w.append(el('div',{class:'actions'},
    el('button',{class:'btn grow',onclick:closeSheet},'Cancelar'),
    el('button',{class:'btn grow danger',onclick:async()=>{
      await store.del('docs',d.id);await store.del('files',d.id);
      for(const m of (await store.all('marks')).filter(x=>x.docId===d.id))await store.del('marks',m.id);
      for(const m of (await store.all('bms')).filter(x=>x.docId===d.id))await store.del('bms',m.id);
      closeSheet();await loadDocs();renderLibrary();toast('Documento removido');
    }},'Remover')
  ));
  openSheet(w);
}

/* ---------- importação ---------- */
function pickFiles(accept){
  const inp=$('#file');inp.accept=accept;inp.value='';
  inp.onchange=()=>{const f=[...inp.files];if(f.length)importFiles(f)};
  inp.click();
}
function openImport(){
  const w=el('div');
  w.append(sheetHead('Importar'));
  const tiles=el('div',{class:'tiles'},
    el('button',{class:'tile',onclick:()=>{closeSheet();pickFiles('.pdf,application/pdf')}},ico('file'),el('div',{},el('b',{},'PDF'),el('span',{class:'s'},'Livros, artigos e apostilas'))),
    el('button',{class:'tile',onclick:()=>{closeSheet();pickFiles('image/*')}},ico('image'),el('div',{},el('b',{},'Imagens'),el('span',{class:'s'},'Fotos de páginas, capturas de tela'))),
    el('button',{class:'tile',onclick:()=>{closeSheet();pickFiles('.txt,.md,text/plain,text/markdown')}},ico('text'),el('div',{},el('b',{},'Texto'),el('span',{class:'s'},'Arquivos .txt e .md'))),
    el('button',{class:'tile',onclick:()=>{closeSheet();loadSample()}},ico('spark'),el('div',{},el('b',{},'Documento de exemplo'),el('span',{class:'s'},'Para testar sem importar nada')))
  );
  w.append(tiles);
  openSheet(w);
}
function paginate(txt){
  const H=594;
  const m=document.createElement('div');
  m.className='txtbody';
  m.style.cssText='visibility:hidden;position:fixed;left:-9999px;top:0;width:420px;height:auto;transform:none;overflow:visible';
  document.body.append(m);
  const fits=s=>{m.textContent=s;return m.scrollHeight<=H};
  const paras=txt.replace(/\r/g,'').split(/\n{2,}/).map(p=>p.replace(/^\n+|\n+$/g,'')).filter(p=>p.trim());
  const pages=[];let cur='';
  for(const p of paras){
    const cand=cur?cur+'\n\n'+p:p;
    if(fits(cand)){cur=cand;continue}
    if(cur){pages.push(cur);cur=''}
    if(fits(p)){cur=p;continue}
    // parágrafo maior que uma página: divide por palavras
    let line='';
    for(const w of p.split(/(\s+)/)){
      if(fits(line+w))line+=w;
      else{if(line.trim())pages.push(line.trim());line=w.trimStart()}
    }
    cur=line.trim();
  }
  if(cur.trim())pages.push(cur);
  m.remove();
  return pages.length?pages:[''];
}
async function pdfThumb(pdf){
  const p=await pdf.getPage(1);const v0=p.getViewport({scale:1});const s=240/v0.width;const v=p.getViewport({scale:s});
  const c=document.createElement('canvas');c.width=v.width;c.height=v.height;
  await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;
  return c.toDataURL('image/jpeg',.7);
}
async function imgThumb(file){
  const bmp=await createImageBitmap(file);const s=240/bmp.width;
  const c=document.createElement('canvas');c.width=240;c.height=Math.max(1,Math.round(bmp.height*s));
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',.7);
}
async function addDoc(f){
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  let kind;
  if(f.type==='application/pdf'||ext==='pdf')kind='pdf';
  else if((f.type||'').startsWith('image/'))kind='image';
  else if(['txt','md','text'].includes(ext)||(f.type||'').startsWith('text/'))kind='text';
  else throw new Error('formato');
  const doc={id:uid(),name:f.name.replace(/\.[^.]+$/,''),kind,size:f.size,added:Date.now(),opened:Date.now(),lastPage:1,pages:1,thumb:null};
  if(kind==='pdf'){
    if(typeof pdfjsLib==='undefined')throw new Error('pdfjs');
    const buf=await f.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
    doc.pages=pdf.numPages;
    try{doc.thumb=await pdfThumb(pdf)}catch(e){}
    pdf.destroy();
  }else if(kind==='image'){
    try{doc.thumb=await imgThumb(f)}catch(e){}
  }else{
    doc.pages=paginate(await f.text()).length;
  }
  await store.put('files',{id:doc.id,blob:f});
  await store.put('docs',doc);
  return doc;
}
async function importFiles(files){
  toast('Importando…');
  let ok=0;
  for(const f of files){
    try{await addDoc(f);ok++}
    catch(e){toast(e.message==='pdfjs'?'O leitor de PDF não carregou. Verifique a conexão.':`Não foi possível importar ${f.name}`)}
  }
  await loadDocs();renderLibrary();
  if(ok)toast(ok===1?'Documento importado':`${ok} documentos importados`);
}
/* ---------- backup ----------
   Formato: uma linha "LEITOR-BACKUP 1 <tamanho do JSON em bytes>", o JSON com
   documentos, marcações e marcadores, e depois os arquivos (PDFs, imagens,
   textos) colados em sequência, cada um localizado por offset e tamanho. */
const BK='LEITOR-BACKUP';
function fmtSize(n){
  if(n<1024)return n+' B';
  if(n<1048576)return Math.round(n/1024)+' KB';
  if(n<1073741824)return (n/1048576).toFixed(n<10485760?1:0).replace('.',',')+' MB';
  return (n/1073741824).toFixed(1).replace('.',',')+' GB';
}
async function makeBackup(withFiles){
  const docs=await store.all('docs'),marks=await store.all('marks'),bms=await store.all('bms');
  const parts=[],files=[];let off=0;
  if(withFiles)for(const d of docs){
    const f=await store.get('files',d.id);if(!f||!f.blob)continue;
    files.push({id:d.id,type:f.blob.type||'',size:f.blob.size,offset:off});
    parts.push(f.blob);off+=f.blob.size;
  }
  const json=new TextEncoder().encode(JSON.stringify({app:'leitor',version:1,created:Date.now(),docs,marks,bms,files}));
  return new Blob([`${BK} 1 ${json.length}\n`,json,...parts],{type:'application/octet-stream'});
}
async function downloadBackup(withFiles){
  toast('Preparando backup…');
  try{
    const b=await makeBackup(withFiles);
    const d=new Date(),z=n=>String(n).padStart(2,'0');
    const name=`leitor-backup-${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}${withFiles?'':'-marcacoes'}.leitor`;
    const url=URL.createObjectURL(b);
    const a=el('a',{href:url,download:name,style:'display:none'});document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),120000);
    toast(`Backup salvo em Downloads (${fmtSize(b.size)})`);
  }catch(e){toast('Não foi possível gerar o backup')}
}
async function readBackup(file){
  const line=(await file.slice(0,80).text()).split('\n')[0];
  const m=line.match(/^LEITOR-BACKUP (\d+) (\d+)$/);
  if(!m||+m[1]!==1)throw new Error('formato');
  const h=line.length+1,len=+m[2];
  const data=JSON.parse(await file.slice(h,h+len).text());
  if(!data||data.app!=='leitor')throw new Error('formato');
  const base=h+len;
  return {data,blob:f=>file.slice(base+f.offset,base+f.offset+f.size,f.type)};
}
function pickBackup(){
  closeSheet();
  const inp=$('#file');inp.removeAttribute('accept');inp.value='';
  inp.onchange=()=>{const f=inp.files[0];if(f)restoreBackup(f)};
  inp.click();
}
async function restoreBackup(file){
  toast('Restaurando backup…');
  let bk;
  try{bk=await readBackup(file)}catch(e){toast('Este arquivo não é um backup do Leitor');return}
  const data=bk.data;
  try{
    const local=await store.all('docs');
    const ids=new Set(local.map(d=>d.id));
    const files=new Map((data.files||[]).map(f=>[f.id,f]));
    const map=new Map(),missing=[];let nd=0;
    for(const d of data.docs||[]){
      if(ids.has(d.id)){map.set(d.id,d.id);continue}
      const f=files.get(d.id);
      if(f){await store.put('files',{id:d.id,blob:bk.blob(f)});await store.put('docs',d);map.set(d.id,d.id);nd++;continue}
      // backup só de marcações: liga ao mesmo documento importado de novo
      const same=local.find(x=>x.name===d.name&&x.size===d.size&&x.kind===d.kind);
      if(same){map.set(d.id,same.id);continue}
      missing.push(d.name);
    }
    const oldMarks=new Set((await store.all('marks')).map(m=>m.id));
    let nm=0;
    for(const m of data.marks||[]){
      const id=map.get(m.docId);if(!id)continue;
      if(!oldMarks.has(m.id))nm++;
      await store.put('marks',{...m,docId:id});
    }
    const oldBms=await store.all('bms');let nb=0;
    for(const b of data.bms||[]){
      const id=map.get(b.docId);if(!id)continue;
      if(oldBms.some(x=>x.docId===id&&x.page===b.page))continue;
      await store.put('bms',{...b,docId:id});nb++;
    }
    await loadDocs();renderLibrary();
    const w=el('div');
    w.append(sheetHead('Backup restaurado'));
    const n=(k,a,b)=>`${k} ${k===1?a:b}`;
    w.append(el('p',{},`${n(nd,'documento adicionado','documentos adicionados')}, ${n(nm,'marcação nova','marcações novas')} e ${n(nb,'marcador novo','marcadores novos')}. O que já estava no aparelho foi mantido.`));
    if(missing.length){
      w.append(el('p',{},'Estes documentos não estavam no backup nem na biblioteca, então as marcações deles ficaram de fora:'));
      w.append(el('ul',{},missing.map(x=>el('li',{},x))));
      w.append(el('p',{class:'muted'},'Importe esses arquivos de novo e restaure o backup outra vez para recuperar as marcações.'));
    }
    w.append(el('div',{class:'actions'},el('button',{class:'btn primary grow',onclick:closeSheet},'OK')));
    openSheet(w);
  }catch(e){toast('Não foi possível restaurar o backup')}
}
async function openBackup(){
  const docs=await store.all('docs'),marks=await store.all('marks');
  const total=docs.reduce((a,d)=>a+(d.size||0),0);
  const w=el('div');
  w.append(sheetHead('Backup'));
  w.append(el('p',{},'Salva seus documentos, marcações, comentários e marcadores num arquivo. Guarde esse arquivo fora do celular (Google Drive, e-mail) para não perder nada se os dados do navegador forem apagados.'));
  const cb=el('input',{type:'checkbox'});cb.checked=true;
  w.append(el('label',{class:'chk'},cb,el('span',{},
    el('b',{},'Incluir os arquivos'),
    el('span',{class:'s'},`PDFs, imagens e textos (cerca de ${fmtSize(total)}). Sem eles, o backup fica pequeno, mas para restaurar os documentos precisam estar na biblioteca.`))));
  w.append(el('div',{class:'tiles'},
    el('button',{class:'tile',onclick:()=>{closeSheet();downloadBackup(cb.checked)}},ico('download'),el('div',{},el('b',{},'Baixar backup'),el('span',{class:'s'},`${docs.length} ${docs.length===1?'documento':'documentos'} e ${marks.length} ${marks.length===1?'marcação':'marcações'}`))),
    el('button',{class:'tile',onclick:pickBackup},ico('upload'),el('div',{},el('b',{},'Restaurar backup'),el('span',{class:'s'},'Junta o backup ao que já está no aparelho, sem apagar nada')))
  ));
  openSheet(w);
}

const SAMPLE=`Bem-vindo ao protótipo do leitor

Este é um documento de exemplo para você testar as funções do app sem precisar importar nada. Tudo o que você marcar aqui fica salvo no seu aparelho.

Como marcar um trecho

Toque em uma palavra para selecioná-la. Para pegar um trecho maior, toque em outra palavra: a seleção vai da primeira até ela. Assim que houver texto selecionado, aparece uma barra na parte de baixo da tela com quatro cores. Toque em uma cor para destacar o trecho. Para cancelar, toque de novo na mesma palavra ou fora do texto.

Como comentar

Na mesma barra existe o botão “Comentar”. Ele destaca o trecho e já abre a ficha da marcação, onde você escreve a anotação. O comentário não aparece sobre o texto: para lê-lo, toque novamente sobre o trecho destacado.

Como marcar a página

No topo da tela, o ícone de marcador salva a página atual. Toque nele de novo para remover. O ícone de lista mostra todas as páginas marcadas e todas as marcações; tocar em um item leva você direto ao ponto.

Perguntar à IA

Dentro da ficha de uma marcação existe o botão “Perguntar à IA”. O trecho destacado, e o seu comentário, se houver, seguem como contexto, e você complementa com um pedido livre, como traduzir, explicar ou resumir. Para usar, instale a IA uma vez pelo botão de estrela, na Biblioteca. Depois ela funciona sem internet.

A leitura atenta costuma começar antes da primeira página. Observar o título, o sumário e a orelha do livro ajuda o cérebro a criar uma moldura onde as ideias seguintes vão se encaixar. Quem lê assim não perde tempo: chega ao texto já sabendo o que procurar.

Marcar um trecho é uma forma de conversar com o autor. O sublinhado diz “isto importa”; a nota na margem responde “por quê?”. Com o tempo, as marcações viram um mapa do que você pensou enquanto lia, e voltar a elas vale mais do que reler tudo.

Palavras novas são o maior obstáculo de quem lê em outra língua. A saída não é parar a cada termo desconhecido, mas marcar, seguir em frente e, no fim da sessão, voltar às marcações para traduzir e entender o contexto. Assim o ritmo da história não se quebra.

Há leitores que preferem ler de manhã, com a cabeça descansada; outros, à noite, quando a casa silencia. O importante é encontrar um horário que se repita. Vinte minutos por dia rendem mais do que duas horas aos domingos, porque o hábito pesa mais que a disposição.

Um bom marcador de página não é apenas um pedaço de papel entre as folhas. É uma promessa de retorno. Saber exatamente onde parou reduz o atrito de recomeçar, e quanto menor o atrito, maior a chance de o livro ser terminado.

Quando um parágrafo parecer difícil, vale ler em voz baixa, dividir a frase em partes e perguntar quem faz o quê. Se mesmo assim a dúvida persistir, marque o trecho e deixe para depois. Muitas vezes a página seguinte explica o que a anterior deixou em aberto.`;
async function loadSample(){
  const f=new File([SAMPLE],'Guia rápido (exemplo).txt',{type:'text/plain'});
  const d=await addDoc(f);await loadDocs();renderLibrary();openDoc(d.id);
}

/* ---------- abrir documento ---------- */
async function openDoc(id){
  const doc=state.docs.find(d=>d.id===id);if(!doc)return;
  const file=await store.get('files',id);if(!file){toast('Arquivo não encontrado');return}
  try{
    state.cur=doc;state.pdf=null;state.textPages=null;
    if(state.imgUrl){URL.revokeObjectURL(state.imgUrl);state.imgUrl=null}
    state.marks=(await store.all('marks')).filter(m=>m.docId===id);
    state.bms=(await store.all('bms')).filter(b=>b.docId===id).sort((a,b)=>a.page-b.page);
    if(doc.kind==='pdf'){
      if(typeof pdfjsLib==='undefined')throw new Error('O leitor de PDF não carregou.');
      const buf=await file.blob.arrayBuffer();
      state.pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
      state.n=state.pdf.numPages;
      const p1=await state.pdf.getPage(1);const v=p1.getViewport({scale:1});
      state.base={width:v.width,height:v.height};
    }else if(doc.kind==='image'){
      state.imgUrl=URL.createObjectURL(file.blob);
      const bmp=await createImageBitmap(file.blob);
      state.base={width:bmp.width,height:bmp.height};state.n=1;
    }else{
      state.textPages=paginate(await file.blob.text());
      state.n=state.textPages.length;state.base={width:420,height:594};
    }
  }catch(e){toast(e.message||'Não foi possível abrir');return}
  doc.opened=Date.now();store.put('docs',doc);
  $('#title').textContent=doc.name;
  show('rd');
  try{history.pushState({d:1},'')}catch(e){}
  state.zoom=1;
  buildPages();
  goTo(doc.lastPage||1);
  updateCur(true);
  if(doc.kind==='image')toast('Em imagens só é possível marcar a página.');
}
function backFromDoc(){
  if(history.state&&history.state.d)history.back();else closeDoc();
}
function closeDoc(){
  saveLast.flush&&saveLast.flush();
  if(obs){obs.disconnect()}
  if(state.pdf){try{state.pdf.destroy()}catch(e){}state.pdf=null}
  if(state.imgUrl){URL.revokeObjectURL(state.imgUrl);state.imgUrl=null}
  $('#pages').replaceChildren();
  state.cur=null;state.sel=null;
  hideSelBar(true);
  loadDocs().then(()=>{renderLibrary();show('lib')});
}

function buildPages(){
  if(state.sel){state.sel=null;hideSelBar(true)}
  const box=$('#pages');box.replaceChildren();
  if(obs)obs.disconnect();
  obs=new IntersectionObserver(es=>{
    for(const e of es){e.isIntersecting?renderPage(e.target):unrenderPage(e.target)}
  },{root:$('#reader'),rootMargin:'1200px 0px'});
  const rd=$('#reader');
  state.lastW=rd.clientWidth;
  const aw=Math.max(260,rd.clientWidth-16);
  const w=aw*state.zoom;
  state.scale=w/state.base.width;
  const h=state.base.height*state.scale;
  for(let i=1;i<=state.n;i++){
    const p=el('div',{class:'page','data-p':i,style:`width:${w}px;height:${h}px`});
    p.append(el('div',{class:'hl'}));
    box.append(p);obs.observe(p);
  }
}

async function renderPage(p){
  if(p._busy||p._done)return;
  p._busy=true;const t=p._t=(p._t||0)+1;
  const n=+p.dataset.p;
  try{
    const kind=state.cur.kind;
    if(kind==='pdf'){
      const page=await state.pdf.getPage(n);
      if(p._t!==t)return;
      const vp=page.getViewport({scale:state.scale});
      if(Math.abs(p.offsetWidth-vp.width)>2||Math.abs(p.offsetHeight-vp.height)>2){p.style.width=vp.width+'px';p.style.height=vp.height+'px'}
      const dpr=Math.min(window.devicePixelRatio||1,2.5);
      const c=document.createElement('canvas');
      c.width=Math.floor(vp.width*dpr);c.height=Math.floor(vp.height*dpr);
      c.style.width=vp.width+'px';c.style.height=vp.height+'px';
      p.insertBefore(c,p.firstChild);
      const task=page.render({canvasContext:c.getContext('2d'),viewport:vp,transform:dpr!==1?[dpr,0,0,dpr,0,0]:undefined});
      p._task=task;
      const tl=el('div',{class:'textLayer'});tl.style.setProperty('--scale-factor',vp.scale);p.append(tl);
      const tc=await page.getTextContent();
      if(p._t!==t)return;
      const tt=pdfjsLib.renderTextLayer({textContentSource:tc,container:tl,viewport:vp,textDivs:[]});
      await Promise.all([task.promise,tt.promise]);
    }else if(kind==='image'){
      const im=el('img',{class:'pimg',src:state.imgUrl,alt:'Página '+n,draggable:'false'});
      p.insertBefore(im,p.firstChild);
    }else{
      const body=el('div',{class:'txtbody',style:`width:${state.base.width}px;height:${state.base.height}px;transform:scale(${state.scale})`});
      body.textContent=state.textPages[n-1];
      p.append(body);
    }
    if(p._t!==t)return;
    p._done=true;renderHL(p);
  }catch(e){/* renderização cancelada */}
  finally{if(p._t===t)p._busy=false}
}
function unrenderPage(p){
  if(!p._busy&&!p._done)return;
  p._t=(p._t||0)+1;p._busy=false;p._done=false;
  try{p._task&&p._task.cancel()}catch(e){}
  [...p.children].forEach(c=>{if(!c.classList.contains('hl')){if(c.tagName==='CANVAS')c.width=0;c.remove()}});
  const h=p.querySelector('.hl');if(h)h.replaceChildren();
}

/* ---------- posição, marcador de página ---------- */
const saveLast=debounce(()=>{if(state.cur){state.cur.lastPage=state.curPage;store.put('docs',state.cur)}},600);
saveLast.flush=()=>{if(state.cur){state.cur.lastPage=state.curPage;store.put('docs',state.cur)}};
function updateCur(force){
  const r=$('#reader'),pages=$('#pages').children;
  if(!pages.length)return;
  const mid=r.scrollTop+r.clientHeight*0.35;
  let lo=0,hi=pages.length-1;
  while(lo<hi){const m=(lo+hi+1)>>1;if(pages[m].offsetTop<=mid)lo=m;else hi=m-1}
  const n=lo+1;
  if(n!==state.curPage||force){
    state.curPage=n;
    $('#pill').textContent=`${n} / ${state.n}`;
    updateBmBtn();saveLast();
  }
}
function updateBmBtn(){
  const has=state.bms.some(b=>b.page===state.curPage);
  $('#btnBm').classList.toggle('on',has);
}
function goTo(n,yFrac){
  n=Math.min(Math.max(1,n|0),state.n);
  const p=$('#pages').children[n-1];if(!p)return;
  const r=$('#reader');
  r.scrollTop=yFrac!=null?p.offsetTop+yFrac*p.offsetHeight-90:p.offsetTop-8;
  state.curPage=n;$('#pill').textContent=`${n} / ${state.n}`;updateBmBtn();
}
async function toggleBm(){
  const ex=state.bms.find(b=>b.page===state.curPage);
  if(ex){state.bms=state.bms.filter(b=>b!==ex);await store.del('bms',ex.id);toast('Marcador removido')}
  else{
    const b={id:uid(),docId:state.cur.id,page:state.curPage,added:Date.now()};
    state.bms.push(b);state.bms.sort((a,b)=>a.page-b.page);await store.put('bms',b);toast(`Página ${b.page} marcada`);
  }
  updateBmBtn();
}

/* ---------- seleção e marcações ---------- */
let hideT,barPressed=false;
function buildSelBar(){
  const bar=$('#selbar');bar.replaceChildren();
  for(const c of Object.keys(COLORS)){
    bar.append(el('button',{class:'dot',style:`background:${SOLID[c]}`,'aria-label':'Destacar em '+NAMES[c].toLowerCase(),onclick:()=>createHL(c,false)}));
  }
  bar.append(el('span',{class:'sep'}));
  bar.append(el('button',{class:'cm',onclick:()=>createHL('yellow',true)},ico('comment'),'Comentar'));
  bar.addEventListener('mousedown',e=>e.preventDefault());
  bar.addEventListener('pointerdown',()=>{barPressed=true});
  bar.addEventListener('pointerup',()=>setTimeout(()=>{barPressed=false},600));
  bar.addEventListener('pointercancel',()=>{barPressed=false});
}
function showSelBar(){clearTimeout(hideT);$('#selbar').classList.add('on');$('#pill').classList.add('hide')}
function hideSelBar(now){
  clearTimeout(hideT);
  const f=()=>{if(barPressed)return;$('#selbar').classList.remove('on');$('#pill').classList.remove('hide')};
  now?f():(hideT=setTimeout(f,350));
}
function rectsFromRange(range){
  const info=[...document.querySelectorAll('.page')].filter(p=>p.querySelector('.textLayer,.txtbody')).map(p=>({n:+p.dataset.p,r:p.getBoundingClientRect()}));
  const out=[];
  for(const r of range.getClientRects()){
    if(r.width<2||r.height<2)continue;
    const cx=r.left+r.width/2,cy=r.top+r.height/2;
    const pg=info.find(i=>cx>=i.r.left&&cx<=i.r.right&&cy>=i.r.top&&cy<=i.r.bottom);
    if(!pg||r.height>pg.r.height*0.2)continue;
    const x=Math.max(0,(r.left-pg.r.left)/pg.r.width),y=Math.max(0,(r.top-pg.r.top)/pg.r.height);
    out.push({p:pg.n,x,y,w:Math.min(1-x,r.width/pg.r.width),h:Math.min(1-y,r.height/pg.r.height)});
  }
  return out.filter((a,i)=>!out.some((b,j)=>j!==i&&b.p===a.p&&b.x<=a.x+.001&&b.y<=a.y+.001&&b.x+b.w>=a.x+a.w-.001&&b.y+b.h>=a.y+a.h-.001&&(b.w>a.w||b.h>a.h||j<i)));
}
/* Seleção própria do app: tocar numa palavra seleciona, tocar em outra estende
   até ela, tocar fora cancela. A seleção nativa fica desligada nas páginas para
   não abrir o menu do Android nem o "Tocar para pesquisar" do Chrome. */
const WORD=/[\p{L}\p{N}'’\-]/u;
let selTip=false;
function distTo(r,x,y){const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom);return Math.hypot(dx,dy)}
function textTargets(x,y){
  const els=document.elementsFromPoint(x,y);
  const page=els.map(e=>e.closest&&e.closest('.page')).find(Boolean);
  if(!page)return [];
  const isTxt=e=>e.firstChild&&e.firstChild.nodeType===3;
  const direct=els.find(e=>(e.tagName==='SPAN'&&isTxt(e)&&e.closest('.textLayer'))||e.classList.contains('txtbody'));
  if(direct)return [direct];
  // toque entre linhas: usa a linha mais próxima
  let best=null,bd=14;
  for(const e of page.querySelectorAll('.textLayer span')){if(!isTxt(e))continue;const d=distTo(e.getBoundingClientRect(),x,y);if(d<bd){bd=d;best=e}}
  return best?[best]:[];
}
function wordAt(x,y){
  const t=textTargets(x,y)[0];if(!t)return null;
  const r=document.createRange();
  let best=null,bd=14;
  for(const node of t.childNodes){
    if(node.nodeType!==3)continue;
    const d=node.data;
    for(let i=0;i<d.length;i++){
      if(!WORD.test(d[i]))continue;
      r.setStart(node,i);r.setEnd(node,i+1);
      const b=r.getBoundingClientRect();if(!b.width&&!b.height)continue;
      const dist=distTo(b,x,y);
      if(dist<bd){bd=dist;best={node,i};if(!dist)break}
    }
    if(best&&!bd)break;
  }
  if(!best)return null;
  const d=best.node.data;let s=best.i,e=best.i+1;
  while(s>0&&WORD.test(d[s-1]))s--;
  while(e<d.length&&WORD.test(d[e]))e++;
  while(s<e&&/['’\-]/.test(d[s]))s++;
  while(e>s&&/['’\-]/.test(d[e-1]))e--;
  if(s>=e)return null;
  return {node:best.node,s,e};
}
function before(aNode,aOff,bNode,bOff){
  const r=document.createRange();r.setStart(aNode,aOff);r.collapse(true);
  const q=document.createRange();q.setStart(bNode,bOff);q.collapse(true);
  return r.compareBoundaryPoints(Range.START_TO_START,q)<0;
}
function rangeText(range){
  let root=range.commonAncestorContainer;if(root.nodeType===3)root=root.parentNode;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  let out='',n=w.currentNode;
  while(n){
    if(range.intersectsNode(n)){
      if(n.nodeType===3){
        const st=n===range.startContainer?range.startOffset:0,en=n===range.endContainer?range.endOffset:n.data.length;
        out+=n.data.slice(st,en);
      }else if(n.tagName==='BR')out+=' ';
    }
    n=w.nextNode();
  }
  return out;
}
function selectAt(x,y){
  const w=wordAt(x,y);
  if(!w){if(state.sel){clearSel();return true}return false}
  const a=state.sel&&state.sel.anchor;
  const range=document.createRange();
  if(a&&a.node.isConnected){
    if(a.node===w.node&&a.s===w.s&&state.sel.single){clearSel();return true}
    const startA=before(a.node,a.s,w.node,w.s);
    range.setStart(startA?a.node:w.node,startA?a.s:w.s);
    const endA=!before(a.node,a.e,w.node,w.e);
    range.setEnd(endA?a.node:w.node,endA?a.e:w.e);
  }else{range.setStart(w.node,w.s);range.setEnd(w.node,w.e)}
  const text=rangeText(range).replace(/\s+/g,' ').trim();
  const rects=rectsFromRange(range);
  if(!text||!rects.length)return false;
  const anchor=a&&a.node.isConnected?a:w;
  state.sel={text:text.slice(0,2000),rects,anchor,single:anchor===w||(a.node===w.node&&a.s===w.s)};
  refreshHL();showSelBar();
  if(!selTip){selTip=true;toast('Toque em outra palavra para estender a seleção')}
  return true;
}
function clearSel(){
  if(!state.sel)return;
  state.sel=null;barPressed=false;refreshHL();hideSelBar(true);
}
async function createHL(color,withComment){
  const s=state.sel;if(!s||!s.rects.length)return;
  const m={id:uid(),docId:state.cur.id,page:s.rects[0].p,text:s.text,rects:s.rects,color,comment:'',created:Date.now()};
  state.marks.push(m);await store.put('marks',m);
  state.sel=null;barPressed=false;hideSelBar(true);
  refreshHL();
  if(withComment)openMarkSheet(m,true);else toast('Trecho destacado');
}
function renderHL(p){
  const hl=p.querySelector('.hl');if(!hl)return;
  hl.replaceChildren();
  const n=+p.dataset.p;
  for(const m of state.marks)for(const r of m.rects){
    if(r.p!==n)continue;
    const d=document.createElement('div');
    d.className='hlr'+(m.id===state.openMark?' active':'');
    d.style.cssText=`left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%;background:${COLORS[m.color]}`;
    hl.append(d);
  }
  if(state.sel)for(const r of state.sel.rects){
    if(r.p!==n)continue;
    const d=document.createElement('div');
    d.className='hlr selr';
    d.style.cssText=`left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%`;
    hl.append(d);
  }
}
function refreshHL(){
  document.querySelectorAll('.page').forEach(p=>{if(p._done)renderHL(p)});
}

/* ---------- painéis ---------- */
function sheetHead(title,back){
  return el('div',{class:'shead'},
    back?el('button',{class:'ib','aria-label':'Voltar',onclick:back},ico('back')):null,
    el('h2',{},title),
    el('button',{class:'ib','aria-label':'Fechar',onclick:closeSheet},ico('x')));
}
function openSheet(node){
  $('#sheet').replaceChildren(node);
  $('#sheetWrap').classList.add('on');
  if(state.sel){state.sel=null;refreshHL()}
  hideSelBar(true);
}
function closeSheet(){
  $('#sheetWrap').classList.remove('on');
  if(state.openMark){state.openMark=null;refreshHL()}
}

function openMarkSheet(m,focus){
  state.openMark=m.id;refreshHL();
  const w=el('div');
  w.append(sheetHead(`Marcação • página ${m.page}`));
  const q=el('blockquote',{class:'quote',style:`border-color:${SOLID[m.color]}`},clip(m.text,400));
  w.append(q);
  const dots=el('div',{class:'dots'});
  for(const c of Object.keys(COLORS)){
    const b=el('button',{class:'dot'+(c===m.color?' sel':''),style:`background:${SOLID[c]}`,'aria-label':NAMES[c],onclick:async()=>{
      m.color=c;await store.put('marks',m);refreshHL();q.style.borderColor=SOLID[c];
      dots.querySelectorAll('.dot').forEach(d=>d.classList.toggle('sel',d===b));
    }});
    dots.append(b);
  }
  w.append(dots);
  const ta=el('textarea',{rows:4,placeholder:'Escreva um comentário…',id:'cm'});
  ta.value=m.comment||'';
  const save=debounce(()=>{m.comment=ta.value;store.put('marks',m)},300);
  ta.addEventListener('input',save);
  w.append(el('label',{class:'lbl',for:'cm'},'Comentário'),ta);
  let armed=false;
  const del=el('button',{class:'btn danger',onclick:async()=>{
    if(!armed){armed=true;del.textContent='Confirmar exclusão';return}
    state.marks=state.marks.filter(x=>x!==m);await store.del('marks',m.id);closeSheet();refreshHL();toast('Marcação excluída');
  }},ico('trash'),'Excluir');
  w.append(el('div',{class:'actions'},el('button',{class:'btn primary grow',onclick:()=>openAI(m)},ico('spark'),'Perguntar à IA'),del));
  openSheet(w);
  if(focus)setTimeout(()=>ta.focus(),60);
}

function openAI(m){
  state.openMark=m.id;
  const AI=window.LeitorAI;
  const w=el('div');
  w.append(sheetHead('Perguntar à IA',()=>openMarkSheet(m)));
  w.append(el('div',{class:'ctx'},
    el('div',{class:'ctxh'},`Contexto enviado • página ${m.page}`),
    el('div',{class:'ctxt'},clip(m.text,500)),
    m.comment?el('div',{class:'ctxc'},'Meu comentário: '+m.comment):null));
  const log=el('div',{class:'log'});
  const ta=el('textarea',{rows:2,placeholder:'Complemente com sua pergunta (opcional)…','aria-label':'Sua pergunta'});
  const chips=el('div',{class:'chips'});
  (AI?AI.presets:[]).forEach(([l,t])=>chips.append(el('button',{class:'chip',onclick:()=>{ta.value=t;ta.focus()}},l)));
  let busy=false;
  const send=el('button',{class:'btn primary',onclick:async()=>{
    if(busy||!AI)return;
    const ask=ta.value.trim()||'Explique este trecho.';
    const messages=AI.buildMessages({docName:state.cur.name,page:m.page,text:m.text,comment:m.comment,ask});
    log.append(el('div',{class:'bub u'},ask));
    const ans=el('div',{class:'ans'},'…');
    const bub=el('div',{class:'bub a'},ans);
    log.append(bub);ta.value='';bub.scrollIntoView({block:'nearest'});
    busy=true;send.disabled=true;
    try{
      let out='';
      await AI.ask(messages,tok=>{out+=tok;ans.textContent=out},r=>{
        if(!out)ans.textContent=`Carregando a IA… ${Math.round((r.progress||0)*100)}%`;
      });
      if(!out)ans.textContent='(sem resposta)';
    }catch(e){
      if(e.message==='IA_DESLIGADA'){
        ans.textContent='A IA local ainda não está instalada neste aparelho.';
        bub.append(el('button',{class:'btn primary',style:'margin-top:10px',onclick:()=>openAIPanel()},ico('spark'),'Instalar a IA'));
        bub.append(el('details',{},el('summary',{},'Ver o que seria enviado'),el('pre',{},messages.map(x=>x.content).join('\n\n---\n\n'))));
      }else{
        ans.textContent='Não foi possível responder. Toque em Enviar para tentar de novo.';
        bub.append(el('details',{},el('summary',{},'Detalhes'),el('pre',{},String(e&&e.message||e))));
      }
    }finally{busy=false;send.disabled=false}
  }},ico('send'),'Enviar');
  w.append(log,chips,el('div',{class:'sendrow'},ta,send));
  openSheet(w);
}

/* ---------- painel da IA local ---------- */
async function openAIPanel(){
  const AI=window.LeitorAI;
  const w=el('div');
  w.append(sheetHead('IA local'));
  w.append(el('p',{},'Uma IA que roda no próprio celular para traduzir, explicar e resumir os trechos marcados. Depois de instalada, funciona sem internet, e o texto não sai do aparelho.'));
  const body=el('div',{},el('p',{class:'muted'},'Verificando o aparelho…'));
  w.append(body);
  openSheet(w);
  if(!AI){body.replaceChildren(el('p',{},'O módulo de IA não carregou.'));return}
  const live=()=>w.isConnected;

  const progressView=(title)=>{
    const bar=el('i',{style:'width:0%'}),pct=el('b',{},'0%'),info=el('div',{class:'muted'},'');
    body.replaceChildren(
      el('p',{},el('b',{},title)),
      el('div',{class:'bar big'},bar),
      el('div',{class:'prow'},pct,info),
      el('p',{class:'muted'},'Mantenha o app aberto e a tela ligada. Se a conexão cair, toque em Instalar de novo: o que já foi baixado é aproveitado.'));
    return r=>{
      if(!live())return;
      const p=Math.max(0,Math.min(1,r.progress||0));
      bar.style.width=(p*100).toFixed(1)+'%';pct.textContent=Math.round(p*100)+'%';
      const mb=/([\d.]+)\s*MB\s*fetched/i.exec(r.text||'');
      info.textContent=mb?`${Math.round(+mb[1])} MB baixados`:/shader|gpu|loading|cache\[/i.test(r.text||'')&&p>0.98?'Preparando a placa de vídeo…':'';
    };
  };

  const errorView=e=>{
    const msg=String(e&&e.message||e);
    let txt='Não foi possível instalar a IA.';
    if(/fetch|network|Failed to fetch|NetworkError/i.test(msg))txt='A conexão caiu durante o download. Toque em Instalar de novo para continuar de onde parou.';
    else if(/quota|storage|QuotaExceeded/i.test(msg))txt='Falta espaço no celular para o modelo. Libere espaço ou escolha o modelo menor.';
    else if(/memory|out of memory|OOM|device.*lost|lost/i.test(msg))txt='O celular ficou sem memória para este modelo. Feche outros apps ou escolha o modelo menor.';
    else if(/shader-f16|maxStorageBuffer|maxBuffer|limit/i.test(msg))txt='A placa de vídeo do celular não aceitou este modelo. Tente o modelo menor.';
    body.replaceChildren(el('p',{},txt),el('details',{},el('summary',{},'Detalhes técnicos'),el('pre',{},msg)));
    body.append(el('div',{class:'actions'},el('button',{class:'btn primary grow',onclick:()=>draw()},'Voltar')));
  };

  const runTest=async(box)=>{
    const out=el('div',{class:'quote'},'Testando…');box.replaceChildren(el('p',{class:'lbl'},'Teste: traduzir “The little prince”'),out);
    try{
      const r=await AI.test(t=>{if(live())out.textContent=t});
      if(!live())return;
      out.textContent=r.text||'(sem resposta)';
      box.append(el('p',{class:'muted'},`Velocidade: ${r.tokPerSec.toFixed(1).replace('.',',')} pedaços de palavra por segundo.`));
    }catch(e){if(live()){out.textContent='O teste falhou.';box.append(el('details',{},el('summary',{},'Detalhes técnicos'),el('pre',{},String(e&&e.message||e))))}}
  };

  const install=async key=>{
    const m=AI.MODELS.find(x=>x.key===key);
    const onP=progressView(`Baixando ${m.name}…`);
    let lock=null;try{lock=await navigator.wakeLock.request('screen')}catch(e){}
    try{
      await AI.install(key,onP);
      if(!live()){toast('IA instalada');return}
      const box=el('div');
      body.replaceChildren(el('p',{},el('b',{},'IA instalada!')),box,
        el('p',{class:'muted'},'Para usar, abra uma marcação e toque em Perguntar à IA.'),
        el('div',{class:'actions'},el('button',{class:'btn primary grow',onclick:closeSheet},'OK')));
      runTest(box);
    }catch(e){if(live())errorView(e);else toast('A instalação da IA falhou')}
    finally{try{lock&&lock.release()}catch(e){}}
  };

  async function draw(){
    if(!live())return;
    if(AI.status==='loading'&&AI._loading){
      const onP=progressView('Preparando a IA…');if(AI.lastReport)onP(AI.lastReport);
      AI.listeners.add(onP);
      AI._loading.then(()=>{AI.listeners.delete(onP);draw()},e=>{AI.listeners.delete(onP);if(live())errorView(e)});
      return;
    }
    const c=await AI.check();
    if(!live())return;
    if(!c.ok){body.replaceChildren(el('p',{},c.reason));return}
    let id=null;
    try{id=await AI.installedId()}catch(e){body.replaceChildren(el('p',{},'Não foi possível carregar o módulo de IA. Abra o app com internet uma vez e tente de novo.'));return}
    if(!live())return;
    if(id){
      const m=AI.modelOf(id);
      const box=el('div');
      let armed=false;
      const del=el('button',{class:'btn danger grow',onclick:async()=>{
        if(!armed){armed=true;del.textContent='Confirmar remoção';return}
        del.disabled=true;await AI.remove();toast('IA removida do aparelho');draw();
      }},ico('trash'),'Remover');
      body.replaceChildren(
        el('div',{class:'tile',style:'cursor:default'},ico('spark'),el('div',{},el('b',{},`Instalada: ${m?m.name:id}`),el('span',{class:'s'},`${m?m.size:''} no aparelho${AI.status==='ready'?' • pronta':''}`))),
        box,
        el('div',{class:'actions'},
          el('button',{class:'btn grow',onclick:()=>runTest(box)},'Testar'),
          el('button',{class:'btn grow',onclick:()=>chooser(id)},'Trocar'),
          del));
      return;
    }
    chooser(null);
  }

  async function chooser(current){
    let free='';
    try{const e=await navigator.storage.estimate();if(e&&e.quota)free=`Espaço disponível para o app: ${fmtSize(Math.max(0,e.quota-(e.usage||0)))}.`}catch(e){}
    if(!live())return;
    const mem=navigator.deviceMemory||0;
    let pick=AI.MODELS[0].key;
    if(current){const cm=AI.modelOf(current);pick=(AI.MODELS.find(x=>x!==cm)||AI.MODELS[0]).key}
    const tiles=el('div',{class:'tiles'});
    const drawTiles=()=>tiles.replaceChildren(...AI.MODELS.map(m=>el('button',{class:'tile pick'+(m.key===pick?' on':''),onclick:()=>{pick=m.key;drawTiles()}},
      el('span',{class:'radio'}),
      el('div',{},el('b',{},m.name),el('span',{class:'s'},`${m.note} Download de ${m.size}; usa ${String(m.memGB).replace('.',',')} GB de memória.`)))));
    drawTiles();
    body.replaceChildren(
      el('p',{class:'lbl'},current?'Trocar por:':'Escolha o modelo:'),
      tiles,
      el('p',{class:'muted'},[free,'Use o Wi-Fi: o download é grande e acontece uma vez só.',mem&&mem<4?' Este celular tem pouca memória; prefira o modelo menor.':''].filter(Boolean).join(' ')),
      el('div',{class:'actions'},
        current?el('button',{class:'btn grow',onclick:()=>draw()},'Cancelar'):null,
        el('button',{class:'btn primary grow',onclick:()=>install(pick)},ico('download'),current?'Trocar':'Instalar')));
  }

  draw();
}

function openIndex(tab='bm'){
  const w=el('div');
  w.append(sheetHead('Marcadores'));
  const tabs=el('div',{class:'tabs'});
  const body=el('div');
  const tabBtn=(id,label)=>el('button',{class:'tab'+(tab===id?' on':''),onclick:()=>{tab=id;draw()}},label);
  const draw=()=>{
    tabs.replaceChildren(tabBtn('bm',`Páginas (${state.bms.length})`),tabBtn('hl',`Marcações (${state.marks.length})`));
    body.replaceChildren(...(tab==='bm'?bmRows():hlRows()));
  };
  const bmRows=()=>{
    if(!state.bms.length)return [el('p',{class:'muted'},'Nenhuma página marcada. Toque no ícone de marcador, no topo da tela, para marcar a página atual.')];
    return state.bms.map(b=>el('div',{class:'row2'},
      el('button',{class:'main',onclick:()=>{closeSheet();goTo(b.page)}},el('div',{class:'t'},`Página ${b.page}`),el('div',{class:'s'},new Date(b.added).toLocaleDateString('pt-BR'))),
      el('button',{class:'ib','aria-label':'Remover marcador',onclick:async()=>{state.bms=state.bms.filter(x=>x!==b);await store.del('bms',b.id);updateBmBtn();draw()}},ico('x'))));
  };
  const hlRows=()=>{
    if(!state.marks.length)return [el('p',{class:'muted'},'Nenhuma marcação ainda. Selecione um trecho do texto para destacar.')];
    const list=[...state.marks].sort((a,b)=>a.page-b.page||a.rects[0].y-b.rects[0].y);
    return list.map(m=>el('div',{class:'row2'},
      el('span',{class:'swatch',style:`background:${SOLID[m.color]}`}),
      el('button',{class:'main',onclick:()=>{goTo(m.page,m.rects[0].y);openMarkSheet(m)}},el('div',{class:'t'},m.text),el('div',{class:'s'},`Página ${m.page}`))));
  };
  w.append(tabs,body);draw();
  openSheet(w);
}

function openView(){
  const w=el('div');
  w.append(sheetHead('Visualização'));
  const out=el('output',{},Math.round(state.zoom*100)+'%');
  const setZ=z=>{
    z=Math.min(2.4,Math.max(0.6,Math.round(z*10)/10));
    if(z===state.zoom)return;
    const n=state.curPage;state.zoom=z;out.textContent=Math.round(z*100)+'%';
    buildPages();goTo(n);updateCur(true);
  };
  w.append(el('span',{class:'lbl'},'Zoom'),el('div',{class:'zoom'},
    el('button',{class:'btn','aria-label':'Diminuir',onclick:()=>setZ(state.zoom-.2)},'−'),out,
    el('button',{class:'btn','aria-label':'Aumentar',onclick:()=>setZ(state.zoom+.2)},'+'),
    el('button',{class:'btn',onclick:()=>setZ(1)},'Ajustar')));
  w.append(el('label',{class:'lbl',for:'pg'},`Ir para a página (1 a ${state.n})`));
  const inp=el('input',{type:'number',id:'pg',min:'1',max:String(state.n),inputmode:'numeric',placeholder:String(state.curPage)});
  const go=()=>{const n=parseInt(inp.value,10);if(n>=1&&n<=state.n){closeSheet();goTo(n)}else toast('Página fora do intervalo')};
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')go()});
  w.append(el('div',{class:'pgrow'},inp,el('button',{class:'btn primary',onclick:go},'Ir')));
  openSheet(w);
}

/* ---------- eventos ---------- */
function init(){
  $('#btnImport').append(ico('plus'),'Importar');
  $('#btnImport').onclick=openImport;
  $('#btnBackup').append(ico('archive'));$('#btnBackup').onclick=openBackup;
  $('#btnAI').append(ico('spark'));$('#btnAI').onclick=()=>openAIPanel();
  $('#btnBack').append(ico('back'));$('#btnBack').onclick=backFromDoc;
  $('#btnBm').append(ico('bookmark'));$('#btnBm').onclick=toggleBm;
  $('#btnIdx').append(ico('list'));$('#btnIdx').onclick=()=>openIndex();
  $('#btnView').append(ico('aa'));$('#btnView').onclick=openView;
  $('#pill').onclick=openView;
  document.querySelector('.backdrop').onclick=closeSheet;
  buildSelBar();

  if(typeof pdfjsLib!=='undefined'){
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }


  const rd=$('#reader');
  let ticking=false;
  rd.addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{ticking=false;updateCur()})},{passive:true});
  const markAt=(x0,y0)=>{
    const p=document.elementsFromPoint(x0,y0).map(e=>e.closest&&e.closest('.page')).find(Boolean);if(!p)return null;
    const r=p.getBoundingClientRect();
    const x=(x0-r.left)/r.width,y=(y0-r.top)/r.height,n=+p.dataset.p,pad=.006;
    return [...state.marks].reverse().find(m=>m.rects.some(q=>q.p===n&&x>=q.x-pad&&x<=q.x+q.w+pad&&y>=q.y-pad&&y<=q.y+q.h+pad));
  };
  rd.addEventListener('click',e=>{
    if(!state.sel){const hit=markAt(e.clientX,e.clientY);if(hit){openMarkSheet(hit);return}}
    selectAt(e.clientX,e.clientY);
  });
  // toque longo: no Android vira "contextmenu"; seleciona a palavra sem abrir menus do sistema
  rd.addEventListener('contextmenu',e=>{
    if(!e.target.closest('.page'))return;
    e.preventDefault();
    if(!state.sel&&markAt(e.clientX,e.clientY))return;
    selectAt(e.clientX,e.clientY);
  });

  let rt;
  window.addEventListener('resize',()=>{
    clearTimeout(rt);
    rt=setTimeout(()=>{
      if(!state.cur||!$('#rd').classList.contains('on'))return;
      if(Math.abs($('#reader').clientWidth-state.lastW)<40)return;
      const n=state.curPage;buildPages();goTo(n);updateCur(true);
    },250);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});

  window.addEventListener('popstate',()=>{
    if($('#sheetWrap').classList.contains('on')){
      closeSheet();
      if(state.cur){try{history.pushState({d:1},'')}catch(e){}}
      return;
    }
    if(state.cur)closeDoc();
  });
  if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(()=>{})}

  store.open().then(loadDocs).then(renderLibrary);
}
init();
})();
