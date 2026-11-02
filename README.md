# Leitor

Leitor pessoal de PDFs, imagens e textos, com marcações coloridas, comentários, marcadores de página e IA local para tradução e significados.

Os livros, as marcações e os comentários ficam guardados só no celular. O GitHub hospeda apenas o código do app.

## Como marcar um trecho

- Toque numa palavra para selecioná-la (o toque longo também funciona).
- Toque em outra palavra para estender a seleção até ela.
- Escolha uma cor ou **Comentar** na barra que aparece embaixo.
- Toque na mesma palavra de novo, ou fora do texto, para cancelar.

O app usa a própria seleção, sem o menu do Android e sem o "Tocar para pesquisar" do Chrome.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Estrutura das telas |
| `app.css` | Visual |
| `app.js` | Leitor, marcações, marcadores e armazenamento |
| `ai.js` | Módulo da IA local (instalar, perguntar, remover) |
| `ai-worker.js` | Roda a IA fora da tela principal |
| `webllm.js` e `webllm.LICENSE` | Biblioteca WebLLM 0.2.86 (Apache 2.0), que roda o modelo no celular |
| `sw.js` | Faz o app funcionar sem internet |
| `manifest.webmanifest` e `icon-*.png` | Instalação como app e ícone |

Todos ficam na raiz do repositório, sem pastas, para facilitar o envio pelo celular.

## Publicar no GitHub Pages

O código já está neste repositório (`diegonovm1-del/claude`).

1. Deixe o repositório **Public** em **Settings → General → Danger Zone → Change visibility** (o GitHub Pages gratuito exige repositório público; só o código fica visível, nunca os seus livros).
2. Vá em **Settings → Pages**. Em **Source**, escolha **Deploy from a branch**, depois a branch **main** e a pasta **/ (root)**, e toque em **Save**.
3. Espere um ou dois minutos. O endereço será `https://diegonovm1-del.github.io/claude/`.
4. Abra esse endereço no Chrome do Android, toque no menu ⋮ e escolha **Instalar app** (ou **Adicionar à tela inicial**).

Depois de aberto uma vez, o app funciona sem internet.

## Atualizar o app

1. Substitua os arquivos alterados no repositório.
2. Em `sw.js`, aumente a versão (por exemplo, de `v1` para `v2`) e envie também esse arquivo.
3. Feche e abra o app duas vezes para a versão nova entrar.

## Cuidados

- Os dados ficam no armazenamento do Chrome (IndexedDB). Limpar os dados do site ou do navegador apaga a biblioteca e as marcações. Faça backups de vez em quando.

## IA local

Na Biblioteca, toque no ícone de estrela.

1. Escolha o modelo: **Qwen2.5 1.5B** (recomendado, ~1 GB de download) ou **Qwen2.5 0.5B** (mais leve, ~300 MB).
2. Toque em **Instalar**, de preferência no Wi-Fi, e mantenha o app aberto até terminar. Se a conexão cair, toque em Instalar de novo: o download continua de onde parou.
3. No fim, o app faz um teste rápido e mostra a velocidade.
4. Para usar, abra uma marcação e toque em **Perguntar à IA**.

Depois de instalada, a IA funciona sem internet e o texto não sai do celular. Na primeira pergunta depois de abrir o app, ela leva alguns segundos para carregar.

Requisitos: Chrome com WebGPU ligado (em `chrome://gpu`, a linha WebGPU deve dizer "Hardware accelerated") e memória livre para o modelo. Os modelos ficam no armazenamento do Chrome e não entram no backup. Pelo mesmo painel dá para testar, trocar ou remover o modelo.

## Backup

Na Biblioteca, toque no ícone de caixa ao lado de **Importar**.

- **Baixar backup** salva um arquivo `.leitor` na pasta Downloads. Com **Incluir os arquivos** marcado, ele leva os PDFs, imagens e textos junto. Desmarcado, leva só marcações, comentários e marcadores e fica pequeno.
- **Restaurar backup** junta o conteúdo do arquivo ao que já está no aparelho, sem apagar nada. Restaurar o mesmo backup duas vezes não duplica nada.
- Um backup sem os arquivos só recupera as marcações de documentos que já estão na biblioteca. Se for preciso, importe o PDF de novo e depois restaure o backup.
- Com a biblioteca vazia, o botão **Restaurar backup** também aparece na tela inicial.

Guarde o arquivo de backup fora do celular (Google Drive, e-mail) para ele não se perder junto com o aparelho.
- Para o leitor de PDF, a primeira abertura do app precisa de internet.
