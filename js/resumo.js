// Aba "Resumo": seletor de periodo, total, texto e os dois graficos.

import { PERIODOS, calcular, mover } from './periodos.js';
import { listar, remover } from './armazenamento.js';
import { formatarBRL, formatarDiaLongo, chaveDoDia, inputParaData } from './formatar.js';
import { criarLinha } from './lancamento.js';
import { textoLocal } from './texto-resumo.js';
import { iniciarIA, aoTrocarPeriodo as avisarIA } from './ia.js';

/** Quantos lancamentos o historico mostra por vez. */
const POR_PAGINA = 30;

const el = {};
let periodoAtual = 'mes';
let referencia = new Date();
let graficoPizza = null;
let graficoBarras = null;
let ultimoCalculo = null;
let visiveis = POR_PAGINA;
let mostrarAviso = () => {};
let pedirEdicao = () => {};
let avisarMudanca = () => {};

export function iniciarResumo({ aviso, aoEditar, aoMudarDados }) {
  mostrarAviso = aviso;
  pedirEdicao = aoEditar;
  avisarMudanca = aoMudarDados;
  el.seletor = document.querySelector('.seletor-periodo');
  el.rotulo = document.getElementById('rotulo-periodo');
  el.anterior = document.getElementById('periodo-anterior');
  el.proximo = document.getElementById('periodo-proximo');
  el.total = document.getElementById('total-periodo');
  el.comparacao = document.getElementById('comparacao-periodo');
  el.texto = document.getElementById('texto-resumo');
  el.graficos = document.getElementById('area-graficos');
  el.vazio = document.getElementById('vazio-periodo');
  el.legenda = document.getElementById('legenda-categorias');
  el.pizza = document.getElementById('grafico-pizza');
  el.barras = document.getElementById('grafico-barras');
  el.areaHistorico = document.getElementById('area-historico');
  el.historico = document.getElementById('historico');
  el.contagem = document.getElementById('contagem-historico');
  el.verMais = document.getElementById('ver-mais');

  el.seletor.replaceChildren(
    ...PERIODOS.map((p) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'periodo';
      botao.dataset.periodo = p.id;
      botao.textContent = p.rotulo;
      botao.setAttribute('aria-pressed', String(p.id === periodoAtual));
      botao.addEventListener('click', () => {
        periodoAtual = p.id;
        referencia = new Date();
        // Trocar de periodo recomeca o historico do topo.
        visiveis = POR_PAGINA;
        atualizarResumo();
      });
      return botao;
    }),
  );

  el.anterior.addEventListener('click', () => {
    referencia = mover(periodoAtual, referencia, -1);
    visiveis = POR_PAGINA;
    atualizarResumo();
  });
  el.proximo.addEventListener('click', () => {
    referencia = mover(periodoAtual, referencia, 1);
    visiveis = POR_PAGINA;
    atualizarResumo();
  });

  el.verMais.addEventListener('click', () => {
    visiveis += POR_PAGINA;
    atualizarResumo();
  });

  iniciarIA({ aviso, obterCalculo: () => ultimoCalculo });
}

export function atualizarResumo() {
  const dados = calcular(periodoAtual, referencia, listar());
  ultimoCalculo = dados;

  for (const botao of el.seletor.children) {
    botao.setAttribute('aria-pressed', String(botao.dataset.periodo === periodoAtual));
  }

  el.rotulo.textContent = dados.rotulo;
  el.total.textContent = formatarBRL(dados.total);
  // Nao deixa navegar para o futuro: nao ha gasto para ver la.
  el.proximo.disabled = dados.fim >= new Date();

  escreverComparacao(dados);
  el.texto.textContent = textoLocal(dados);
  avisarIA(dados);

  const vazio = dados.total === 0;
  el.graficos.hidden = vazio;
  el.areaHistorico.hidden = vazio;
  el.vazio.hidden = !vazio;

  if (vazio) {
    destruirGraficos();
    el.legenda.replaceChildren();
    el.historico.replaceChildren();
    el.verMais.hidden = true;
    return;
  }

  desenharPizza(dados);
  desenharBarras(dados);
  desenharLegenda(dados);
  desenharHistorico(dados);
}

// --- Historico --------------------------------------------------------------

/**
 * Lista os lancamentos do periodo, do mais recente para o mais antigo,
 * agrupados por dia com subtotal. Mostra `visiveis` por vez.
 */
function desenharHistorico(dados) {
  const ordenadas = dados.despesas.slice().sort((a, b) => b.data.localeCompare(a.data));
  const total = ordenadas.length;
  const naTela = ordenadas.slice(0, visiveis);
  const restantes = total - naTela.length;

  el.contagem.textContent =
    restantes > 0
      ? `${naTela.length} de ${total}`
      : `${total} ${total === 1 ? 'lançamento' : 'lançamentos'}`;

  // No periodo "Dia" o cabecalho de dia repetiria o rotulo que ja esta na tela.
  const agrupar = dados.periodo !== 'dia';
  el.historico.replaceChildren(
    ...(agrupar ? gruposPorDia(naTela) : [listaDe(naTela)]),
  );

  el.verMais.hidden = restantes <= 0;
  if (restantes > 0) {
    el.verMais.textContent = `Ver mais ${Math.min(POR_PAGINA, restantes)} de ${restantes}`;
  }
}

function gruposPorDia(despesas) {
  const porDia = new Map();
  for (const despesa of despesas) {
    const dia = chaveDoDia(despesa.data);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(despesa);
  }

  return [...porDia.entries()].map(([dia, doDia]) => {
    const grupo = document.createElement('div');
    grupo.className = 'historico__grupo';

    const subtotal = doDia.reduce((soma, d) => soma + d.valor, 0);

    const cabecalho = document.createElement('div');
    cabecalho.className = 'historico__dia';
    const nome = document.createElement('strong');
    nome.textContent = formatarDiaLongo(inputParaData(`${dia}T12:00`));
    const valor = document.createElement('span');
    valor.textContent = formatarBRL(subtotal);
    cabecalho.append(nome, valor);

    grupo.append(cabecalho, listaDe(doDia));
    return grupo;
  });
}

function listaDe(despesas) {
  const lista = document.createElement('ul');
  lista.className = 'lancamentos';
  lista.append(...despesas.map(linhaDoHistorico));
  return lista;
}

function linhaDoHistorico(despesa) {
  return criarLinha(despesa, {
    aoEditar: (alvo) => pedirEdicao(alvo),
    aoExcluir: (alvo) => {
      remover(alvo.id);
      // Apagar muda o total, os graficos e o texto — redesenha tudo.
      atualizarResumo();
      avisarMudanca();
      mostrarAviso('Gasto excluído.');
    },
  });
}

function escreverComparacao(dados) {
  const { variacao, nome, comEm } = dados.anterior;
  el.comparacao.className = 'comparacao';

  if (dados.total === 0) {
    el.comparacao.textContent = '';
    return;
  }
  if (variacao === null) {
    el.comparacao.textContent = `Sem gastos ${comEm} para comparar.`;
    return;
  }
  const porcento = Math.abs(Math.round(variacao * 100));
  if (porcento === 0) {
    el.comparacao.textContent = `Quase o mesmo que ${nome}.`;
    return;
  }
  const subiu = variacao > 0;
  el.comparacao.classList.add(subiu ? 'comparacao--subiu' : 'comparacao--desceu');
  el.comparacao.textContent = `${porcento}% ${subiu ? 'a mais' : 'a menos'} que ${nome}`;
}

// --- Graficos ---------------------------------------------------------------

/** Sem Chart.js (falha de carregamento) o resto do app continua funcionando. */
function temChart() {
  return typeof globalThis.Chart !== 'undefined';
}

function destruirGraficos() {
  graficoPizza?.destroy();
  graficoBarras?.destroy();
  graficoPizza = null;
  graficoBarras = null;
}

function desenharPizza(dados) {
  if (!temChart()) return;
  const comGasto = dados.porCategoria.filter((c) => c.total > 0);

  graficoPizza?.destroy();
  graficoPizza = new Chart(el.pizza, {
    type: 'doughnut',
    data: {
      labels: comGasto.map((c) => c.rotulo),
      datasets: [
        {
          data: comGasto.map((c) => c.total / 100),
          backgroundColor: comGasto.map((c) => c.cor),
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      // A legenda propria embaixo mostra valor e percentual; a do Chart seria redundante.
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${formatarBRL(item.raw * 100)}`,
          },
        },
      },
    },
  });
}

function desenharBarras(dados) {
  if (!temChart()) return;
  const { pontos, titulo } = dados.serie;
  document.getElementById('titulo-barras').textContent = titulo;

  graficoBarras?.destroy();
  graficoBarras = new Chart(el.barras, {
    type: 'bar',
    data: {
      labels: pontos.map((p) => p.rotulo),
      datasets: [
        {
          data: pontos.map((p) => p.total / 100),
          backgroundColor: '#2F6F4E',
          borderRadius: 6,
          maxBarThickness: 42,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (item) => ` ${formatarBRL(item.raw * 100)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: true, maxRotation: 0 } },
        y: {
          beginAtZero: true,
          grid: { color: '#E2DDD4' },
          ticks: {
            // Eixo em reais inteiros: "R$ 1.240,00" nao caberia no celular.
            callback: (valor) => `R$ ${Math.round(valor)}`,
            maxTicksLimit: 5,
          },
        },
      },
    },
  });
}

function desenharLegenda(dados) {
  const comGasto = dados.porCategoria.filter((c) => c.total > 0);

  el.legenda.replaceChildren(
    ...comGasto.map((categoria) => {
      const item = document.createElement('li');
      item.className = 'legenda__item';

      const ponto = document.createElement('span');
      ponto.className = 'legenda__ponto';
      ponto.style.background = categoria.cor;
      ponto.setAttribute('aria-hidden', 'true');

      const nome = document.createElement('span');
      nome.className = 'legenda__nome';
      nome.textContent = `${categoria.emoji} ${categoria.rotulo}`;

      const valor = document.createElement('span');
      valor.className = 'legenda__valor';
      valor.textContent = formatarBRL(categoria.total);

      const fatia = document.createElement('span');
      fatia.className = 'legenda__fatia';
      fatia.textContent = `${Math.round((categoria.total / dados.total) * 100)}%`;

      item.append(ponto, nome, valor, fatia);
      return item;
    }),
  );
}
