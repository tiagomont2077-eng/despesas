# Minhas Despesas

Aplicativo de controle de gastos do dia a dia, feito para usar no celular.
Abre e já usa: sem cadastro, sem senha, sem nuvem. Os dados ficam guardados
no próprio aparelho e o app funciona sem internet.

---

## Para quem vai usar o app (instalar no celular)

O app fica em um endereço na internet, mas depois de instalado funciona sem
conexão, como qualquer outro aplicativo do celular.

### Android (Chrome)

1. Abra o endereço do app no Chrome.
2. Toque nos três pontinhos ⋮ no canto superior direito.
3. Toque em **Adicionar à tela inicial** (ou **Instalar aplicativo**).
4. Confirme. O ícone verde da carteira aparece junto com os outros apps.

### iPhone (Safari — precisa ser o Safari)

1. Abra o endereço do app no Safari.
2. Toque no botão de compartilhar (o quadrado com a seta para cima), na barra
   de baixo.
3. Deslize a lista e toque em **Adicionar à Tela de Início**.
4. Toque em **Adicionar**, no canto superior direito.

> No iPhone só funciona pelo Safari. Pelo Chrome do iPhone a opção não aparece.

### Como usar

- **Lançar** — digite quanto foi, com o quê, e toque na categoria. Pronto.
  A data e a hora entram sozinhas; use *Alterar data e hora* se o gasto foi
  em outro dia.
- Na categoria, dá para **tocar direto** num dos sete botões ou **digitar**
  no campo de busca para ir filtrando (digitar "saud" já deixa só Saúde).
- **Resumo** — escolha Dia, Semana, Mês ou Ano e use as setas ‹ › para andar
  no tempo. Mostra o total, a comparação com o período anterior, os gráficos
  e um texto explicando o período.
- **Ajustes** — baixar e restaurar cópia de segurança, e apagar tudo.

### Importante: faça uma cópia de vez em quando

Os dados ficam **só neste aparelho**. Se limpar os dados do navegador,
desinstalar o app ou trocar de celular, eles somem. Em **Ajustes → Baixar
cópia** você salva um arquivo com tudo; **Restaurar cópia** traz de volta.

---

## Para quem mantém o projeto

### Rodar no computador

O app precisa ser servido por um endereço `http://` — abrir o `index.html`
com dois cliques **não funciona**, porque o service worker (o que faz o app
funcionar offline) exige `localhost` ou `https`.

```bash
npx --yes serve . -l 5000
```

Depois abra `http://localhost:5000`.

### Estrutura

```
index.html                 página única, três abas
manifest.webmanifest       o que torna o app instalável
sw.js                      service worker (cache offline)
css/estilo.css
js/
  app.js                   navegação entre abas, avisos, registro do SW
  categorias.js            as 7 categorias + busca sem acento
  armazenamento.js         leitura/escrita no localStorage
  formatar.js              dinheiro em reais e datas
  formulario.js            aba Lançar
  periodos.js              intervalos e agregações por dia/semana/mês/ano
  resumo.js                aba Resumo: total, gráficos, legenda
  texto-resumo.js          o texto do resumo, gerado no aparelho
  ia.js                    resumo com IA (opcional)
  ajustes.js               aba Ajustes
vendor/chart.umd.min.js    Chart.js 4.5.0, guardado local (não CDN)
icons/                     ícones gerados por script
ferramentas/gerar-icones.mjs
```

Não há build, nem `npm install`, nem framework. São arquivos servidos como
estão; os `js/*.js` são módulos ES que o navegador resolve sozinho.

### ⚠️ Ao alterar qualquer arquivo, suba a versão do cache

O `sw.js` guarda o app inteiro em cache. Se você publicar uma alteração sem
mexer na constante `VERSAO`, os celulares que já instalaram o app continuam
abrindo a versão antiga.

```js
// sw.js
const VERSAO = 'despesas-v2';   // <- suba para v3, v4, ...
```

Se você adicionar um arquivo novo em `js/`, inclua o caminho na lista
`ARQUIVOS` do mesmo arquivo — senão ele não fica disponível offline.

### Regenerar os ícones

Só é preciso se você mudar o desenho ou as cores:

```bash
node ferramentas/gerar-icones.mjs
```

### Decisões que valem saber

- **Dinheiro é guardado em centavos**, como número inteiro (`1500` = R$ 15,00).
  Somar valores com casas decimais em ponto flutuante acumula erro de
  arredondamento; com inteiros, não.
- **Datas são texto local** no formato `2026-08-05T09:14`, sem fuso. Os
  filtros de período comparam essas strings diretamente — a ordem alfabética
  desse formato já é a ordem cronológica, então nenhum fuso horário entra na
  conta.
- **`localStorage`, não IndexedDB.** Uma despesa ocupa cerca de 90 bytes; o
  limite de ~5 MB comporta dezenas de milhares de lançamentos. A API síncrona
  é muito mais simples de manter.
- **A semana começa na segunda-feira**, convenção brasileira.

---

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie este projeto para o branch `main`.
2. No repositório: **Settings → Pages → Build and deployment → Source** e
   escolha **GitHub Actions**.
3. Todo `push` no `main` publica sozinho, pelo workflow em
   `.github/workflows/deploy.yml`.

O endereço fica `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Todos os caminhos do projeto são **relativos** (`./js/app.js`), justamente
para o app funcionar dentro dessa subpasta. Se você trocar algum por caminho
absoluto (`/js/app.js`), o app quebra no GitHub Pages.

---

## Resumo com IA (opcional)

O resumo em texto da aba Resumo é gerado **no próprio aparelho** — sem
internet, sem chave, sem custo. Ele aparece sempre.

Por cima disso, dá para ligar um resumo escrito pela IA da Anthropic:

1. Pegue uma chave em <https://console.anthropic.com>.
2. No app: **Ajustes → Resumo com IA**, cole a chave e toque em *Salvar chave*.
3. Na aba Resumo aparece o botão **✨ Resumo com IA**.

Detalhes técnicos:

- Modelo `claude-sonnet-4-6`, endpoint `POST /v1/messages`.
- A chamada sai direto do navegador, o que exige o cabeçalho
  `anthropic-dangerous-direct-browser-access: true` — é ele que libera o CORS.
- **Só números agregados são enviados** (totais por categoria e comparação com
  o período anterior). As descrições dos seus gastos nunca saem do aparelho.
- O texto gerado fica guardado por período, para não pagar duas vezes pelo
  mesmo resumo. Se você lançar mais um gasto no período, ele é gerado de novo.
- O botão some quando não há chave configurada ou quando o celular está sem
  internet. O resumo local continua ali.

### Sobre a segurança da chave

A chave fica no `localStorage` do aparelho. **Quem tiver o celular
desbloqueado consegue lê-la** pelo painel de desenvolvedor do navegador. Isso é
inerente a um app sem servidor — não há onde esconder a chave.

Recomendações: use uma chave dedicada só para isto e configure um limite de
gasto no painel da Anthropic. Se preferir não correr o risco, simplesmente não
configure chave nenhuma: o app funciona inteiro sem ela.

Para trocar de modelo, altere a constante `MODELO` no topo de `js/ia.js`.
