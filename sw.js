// Service worker: guarda o app inteiro em cache para funcionar sem internet.
//
// Ao alterar qualquer arquivo da lista abaixo, suba o numero da versao —
// e isso que faz o navegador buscar a versao nova.

const VERSAO = 'despesas-v2';

// Caminhos relativos: o app pode viver numa subpasta (GitHub Pages).
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilo.css',
  './js/app.js',
  './js/armazenamento.js',
  './js/categorias.js',
  './js/formatar.js',
  './js/formulario.js',
  './js/periodos.js',
  './js/resumo.js',
  './js/texto-resumo.js',
  './js/ia.js',
  './js/ajustes.js',
  './vendor/chart.umd.min.js',
  './icons/icone-192.png',
  './icons/icone-512.png',
  './icons/icone-mascara-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then(async (cache) => {
      // addAll falha inteiro se um arquivo faltar; individualmente e mais tolerante.
      await Promise.all(
        ARQUIVOS.map((caminho) =>
          cache.add(caminho).catch((erro) => console.warn('Fora do cache:', caminho, erro)),
        ),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;

  // So mexemos em GET. POST para a API nunca deve passar por aqui.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // A API da Anthropic precisa ir direto para a rede, sem interferencia.
  if (url.hostname.endsWith('anthropic.com')) return;

  // Recursos de outras origens tambem passam direto.
  if (url.origin !== self.location.origin) return;

  // Navegacao: tenta a rede e, sem conexao, devolve a pagina guardada.
  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(VERSAO);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }),
    );
    return;
  }

  // Demais arquivos: cache primeiro, rede como reserva.
  evento.respondWith(
    caches.match(request).then(
      (guardado) =>
        guardado ||
        fetch(request).then(async (resposta) => {
          if (resposta.ok && resposta.type === 'basic') {
            const cache = await caches.open(VERSAO);
            cache.put(request, resposta.clone());
          }
          return resposta;
        }),
    ),
  );
});
