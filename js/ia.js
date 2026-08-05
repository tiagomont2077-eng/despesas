// Resumo com IA — extra OPCIONAL sobre o resumo local.
//
// Chama a API da Anthropic direto do navegador. Isso exige o cabecalho
// "anthropic-dangerous-direct-browser-access", que e o que libera o CORS.
// Sem chave configurada ou sem internet, o botao nem aparece.

import { lerChaveApi } from './armazenamento.js';
import { formatarBRL } from './formatar.js';

const MODELO = 'claude-sonnet-4-6';
const ENDERECO = 'https://api.anthropic.com/v1/messages';
const PREFIXO_CACHE = 'resumoIA.';

const INSTRUCOES = [
  'Você resume gastos pessoais para uma pessoa não familiarizada com tecnologia.',
  'Escreva em português do Brasil, em 2 a 4 frases curtas, com tom acolhedor e direto.',
  'Use apenas os números fornecidos; nunca invente valores nem categorias.',
  'Aponte a categoria de maior peso, compare com o período anterior quando houver dado,',
  'e termine com uma observação prática. Não dê conselhos de investimento.',
].join(' ');

const el = {};
let obterCalculo = () => null;
let mostrarAviso = () => {};
let calculoAtual = null;

export function iniciarIA({ aviso, obterCalculo: obter }) {
  mostrarAviso = aviso;
  obterCalculo = obter;

  el.area = document.getElementById('area-ia');
  el.botao = document.getElementById('botao-ia');
  el.texto = document.getElementById('texto-ia');
  el.estado = document.getElementById('estado-ia');

  el.botao.addEventListener('click', gerar);

  // Se a conexao cair ou voltar, o botao some ou reaparece sozinho.
  window.addEventListener('online', () => atualizarVisibilidade());
  window.addEventListener('offline', () => atualizarVisibilidade());
}

/** Chamado pela aba Resumo sempre que o periodo muda. */
export function aoTrocarPeriodo(dados) {
  calculoAtual = dados;
  atualizarVisibilidade();

  esconder(el.estado);
  const guardado = lerCache(dados);
  if (guardado) {
    el.texto.textContent = guardado;
    el.texto.hidden = false;
    el.botao.textContent = '✨ Gerar de novo';
  } else {
    el.texto.hidden = true;
    el.texto.textContent = '';
    el.botao.textContent = '✨ Resumo com IA';
  }
}

function atualizarVisibilidade() {
  const disponivel = Boolean(lerChaveApi()) && navigator.onLine && (calculoAtual?.total ?? 0) > 0;
  if (el.area) el.area.hidden = !disponivel;
}

// --- Cache ------------------------------------------------------------------

// A chave inclui o total: se ela lancar mais um gasto no mesmo periodo,
// o texto guardado deixa de valer e um novo e gerado.
function chaveCache(dados) {
  const inicio = dados.inicio.toISOString().slice(0, 10);
  return `${PREFIXO_CACHE}${dados.periodo}.${inicio}.${dados.total}`;
}

function lerCache(dados) {
  try {
    return localStorage.getItem(chaveCache(dados)) || '';
  } catch {
    return '';
  }
}

function gravarCache(dados, texto) {
  try {
    localStorage.setItem(chaveCache(dados), texto);
  } catch {
    // Cache cheio nao e motivo para falhar: o texto ja esta na tela.
  }
}

// --- Chamada ----------------------------------------------------------------

/**
 * Monta o texto enviado a API. Vao apenas NUMEROS AGREGADOS —
 * as descricoes dos gastos nunca saem do aparelho.
 */
function montarPergunta(dados) {
  const linhas = [
    `Período: ${dados.rotulo}`,
    `Total gasto: ${formatarBRL(dados.total)}`,
    `Quantidade de lançamentos: ${dados.despesas.length}`,
    '',
    'Gasto por categoria neste período:',
  ];

  for (const categoria of dados.porCategoria) {
    if (categoria.total === 0) continue;
    const fatia = Math.round((categoria.total / dados.total) * 100);
    linhas.push(`- ${categoria.rotulo}: ${formatarBRL(categoria.total)} (${fatia}%)`);
  }

  linhas.push('', `Período anterior (${dados.anterior.rotulo}):`);
  if (dados.anterior.total === 0) {
    linhas.push('- Nenhum gasto registrado.');
  } else {
    linhas.push(`- Total: ${formatarBRL(dados.anterior.total)}`);
    for (const categoria of dados.anterior.porCategoria) {
      if (categoria.total === 0) continue;
      linhas.push(`- ${categoria.rotulo}: ${formatarBRL(categoria.total)}`);
    }
  }

  linhas.push('', 'Escreva o resumo desse período.');
  return linhas.join('\n');
}

async function gerar() {
  const dados = obterCalculo();
  if (!dados || dados.total === 0) return;

  const chave = lerChaveApi();
  if (!chave) {
    mostrarAviso('Configure a chave da API em Ajustes.', true);
    return;
  }

  el.botao.disabled = true;
  mostrar(el.estado, 'Gerando resumo…');

  try {
    const resposta = await fetch(ENDERECO, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01',
        // Sem este cabecalho o navegador bloqueia a chamada por CORS.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 400,
        system: INSTRUCOES,
        messages: [{ role: 'user', content: montarPergunta(dados) }],
      }),
    });

    if (!resposta.ok) {
      throw new Error(await mensagemDeErro(resposta));
    }

    const corpo = await resposta.json();

    if (corpo.stop_reason === 'refusal') {
      throw new Error('A IA não quis responder a esse pedido.');
    }

    const texto = (corpo.content ?? [])
      .filter((bloco) => bloco.type === 'text')
      .map((bloco) => bloco.text)
      .join('\n')
      .trim();

    if (!texto) throw new Error('A IA respondeu vazio. Tente de novo.');

    el.texto.textContent = texto;
    el.texto.hidden = false;
    el.botao.textContent = '✨ Gerar de novo';
    gravarCache(dados, texto);
    esconder(el.estado);

    if (corpo.stop_reason === 'max_tokens') {
      mostrar(el.estado, 'O texto ficou longo e foi cortado no fim.');
    }
  } catch (erro) {
    // O resumo local continua na tela; a IA e so um extra.
    mostrar(el.estado, erro.message || 'Não foi possível gerar agora.');
    mostrarAviso(erro.message || 'Não foi possível gerar agora.', true);
  } finally {
    el.botao.disabled = false;
  }
}

async function mensagemDeErro(resposta) {
  switch (resposta.status) {
    case 401:
      return 'Chave inválida. Confira em Ajustes.';
    case 403:
      return 'Essa chave não tem permissão para usar a API.';
    case 429:
      return 'Muitas requisições. Espere alguns instantes e tente de novo.';
    case 400: {
      const corpo = await resposta.json().catch(() => null);
      return corpo?.error?.message || 'A API recusou o pedido.';
    }
    default:
      if (resposta.status >= 500) return 'A API está indisponível agora. Tente mais tarde.';
      return `Erro ${resposta.status} ao falar com a API.`;
  }
}

// --- Auxiliares -------------------------------------------------------------

function mostrar(elemento, texto) {
  elemento.textContent = texto;
  elemento.hidden = false;
}

function esconder(elemento) {
  elemento.textContent = '';
  elemento.hidden = true;
}
