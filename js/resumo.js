// Aba "Resumo": seletor de periodo, total, texto e os dois graficos.

import { PERIODOS, calcular, mover } from './periodos.js';
import { listar } from './armazenamento.js';
import { formatarBRL } from './formatar.js';
import { textoLocal } from './texto-resumo.js';
import { iniciarIA, aoTrocarPeriodo as avisarIA } from './ia.js';

const el = {};
let periodoAtual = 'mes';
let referencia = new Date();
let graficoPizza = null;
let graficoBarras = null;
let ultimoCalculo = null;

export function iniciarResumo({ aviso }) {
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
        atualizarResumo();
      });
      return botao;
    }),
  );

  el.anterior.addEventListener('click', () => {
    referencia = mover(periodoAtual, referencia, -1);
    atualizarResumo();
  });
  el.proximo.addEventListener('click', () => {
    referencia = mover(periodoAtual, referencia, 1);
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
  el.vazio.hidden = !vazio;

  if (vazio) {
    destruirGraficos();
    el.legenda.replaceChildren();
    return;
  }

  desenharPizza(dados);
  desenharBarras(dados);
  desenharLegenda(dados);
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
