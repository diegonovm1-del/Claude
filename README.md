# Leitor

Leitor pessoal de PDFs, imagens e textos, com marcações coloridas, comentários, marcadores de página e (em breve) IA local para tradução e significados.

Os livros, as marcações e os comentários ficam guardados só no celular. O GitHub hospeda apenas o código do app.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Estrutura das telas |
| `app.css` | Visual |
| `app.js` | Leitor, marcações, marcadores e armazenamento |
| `ai.js` | Módulo da IA (o modelo local entra aqui na próxima etapa) |
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

- Os dados ficam no armazenamento do Chrome. Limpar os dados do site ou do navegador apaga a biblioteca e as marcações. Uma função de backup (exportar e importar) pode ser adicionada depois.
- Para o leitor de PDF, a primeira abertura do app precisa de internet.
