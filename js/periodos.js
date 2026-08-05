// Calculo de intervalos (dia/semana/mes/ano) e agregacao dos gastos.
//
// As datas gravadas sao strings locais "2026-08-05T09:14". Comparamos como
// TEXTO, nao como Date: a ordem alfabetica desse formato ja e a ordem
// cronologica, e assim nenhum fuso horario entra na conta.

import { CATEGORIAS } from './categorias.js';

export const PERIODOS = [
  { id: 'dia', rotulo: 'Dia' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'ano', rotulo: 'Ano' },
];

const p2 = (n) => String(n).padStart(2, '0');

/** Date -> "2026-08-05T09:14" no horario local. */
function marca(data) {
  return (
    `${data.getFullYear()}-${p2(data.getMonth() + 1)}-${p2(data.getDate())}` +
    `T${p2(data.getHours())}:${p2(data.getMinutes())}`
  );
}

function inicioDoDia(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fimDoDia(data) {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Segunda-feira da semana de `data` (convencao brasileira). */
function inicioDaSemana(data) {
  const d = inicioDoDia(data);
  const diaSemana = (d.getDay() + 6) % 7; // domingo(0) vira 6
  d.setDate(d.getDate() - diaSemana);
  return d;
}

function somarDias(data, dias) {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

function somarMeses(data, meses) {
  const d = new Date(data);
  // Dia 1 antes de somar: evita 31/03 - 1 mes virar 03/03.
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  return d;
}

// --- Limites de cada periodo ------------------------------------------------

function limites(periodo, referencia) {
  switch (periodo) {
    case 'dia':
      return { inicio: inicioDoDia(referencia), fim: fimDoDia(referencia) };
    case 'semana': {
      const inicio = inicioDaSemana(referencia);
      return { inicio, fim: fimDoDia(somarDias(inicio, 6)) };
    }
    case 'mes': {
      const inicio = inicioDoDia(referencia);
      inicio.setDate(1);
      const fim = fimDoDia(somarDias(somarMeses(inicio, 1), -1));
      return { inicio, fim };
    }
    case 'ano': {
      const inicio = new Date(referencia.getFullYear(), 0, 1);
      const fim = fimDoDia(new Date(referencia.getFullYear(), 11, 31));
      return { inicio, fim };
    }
    default:
      throw new Error(`Período desconhecido: ${periodo}`);
  }
}

/** Avanca (+1) ou volta (-1) um periodo inteiro a partir da referencia. */
export function mover(periodo, referencia, direcao) {
  switch (periodo) {
    case 'dia':
      return somarDias(referencia, direcao);
    case 'semana':
      return somarDias(referencia, 7 * direcao);
    case 'mes':
      return somarMeses(referencia, direcao);
    case 'ano':
      return new Date(referencia.getFullYear() + direcao, referencia.getMonth(), 1);
    default:
      return referencia;
  }
}

// --- Rotulos ----------------------------------------------------------------

const fmtDiaLongo = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const fmtMesAno = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const fmtMesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function rotulo(periodo, inicio, fim) {
  switch (periodo) {
    case 'dia':
      return maiuscula(fmtDiaLongo.format(inicio));
    case 'semana':
      return `${fmtDiaMes.format(inicio)} a ${fmtDiaMes.format(fim)}`;
    case 'mes':
      return maiuscula(fmtMesAno.format(inicio));
    case 'ano':
      return String(inicio.getFullYear());
    default:
      return '';
  }
}

/**
 * Nome do periodo anterior em duas formas, para as frases sairem em portugues
 * correto sem "em o" / "em a":
 *   nome -> vai depois de "que":  "...a mais que o dia anterior"
 *   comEm -> ja traz a preposicao: "...nao teve gasto no dia anterior"
 * Meses ficam em minuscula, como manda o portugues no meio da frase.
 */
function rotuloAnterior(periodo, inicioAnterior) {
  switch (periodo) {
    case 'dia':
      return { nome: 'o dia anterior', comEm: 'no dia anterior' };
    case 'semana':
      return { nome: 'a semana passada', comEm: 'na semana passada' };
    case 'mes': {
      const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(inicioAnterior);
      return { nome: mes, comEm: `em ${mes}` };
    }
    case 'ano': {
      const ano = String(inicioAnterior.getFullYear());
      return { nome: ano, comEm: `em ${ano}` };
    }
    default:
      return { nome: 'o período anterior', comEm: 'no período anterior' };
  }
}

// --- Agregacao --------------------------------------------------------------

function noIntervalo(despesas, inicio, fim) {
  const de = marca(inicio);
  const ate = marca(fim);
  return despesas.filter((d) => d.data >= de && d.data <= ate);
}

function somar(despesas) {
  return despesas.reduce((total, d) => total + d.valor, 0);
}

/** Total por categoria, sempre na ordem fixa das 7, incluindo zeros. */
function porCategoria(despesas) {
  const mapa = new Map(CATEGORIAS.map((c) => [c.id, 0]));
  for (const d of despesas) {
    mapa.set(d.categoria, (mapa.get(d.categoria) ?? 0) + d.valor);
  }
  return CATEGORIAS.map((c) => ({
    id: c.id,
    rotulo: c.rotulo,
    cor: c.cor,
    emoji: c.emoji,
    total: mapa.get(c.id) ?? 0,
  }));
}

/**
 * Serie do grafico de barras. Os intervalos mudam conforme o periodo:
 *   dia    -> os ultimos 7 dias terminando na referencia
 *   semana -> os 7 dias da semana
 *   mes    -> cada dia do mes
 *   ano    -> os 12 meses
 */
function serie(periodo, referencia, inicio, fim, despesas) {
  const pontos = [];

  if (periodo === 'ano') {
    for (let mes = 0; mes < 12; mes++) {
      const iniMes = new Date(inicio.getFullYear(), mes, 1);
      const fimMes = fimDoDia(somarDias(somarMeses(iniMes, 1), -1));
      pontos.push({
        rotulo: fmtMesCurto.format(iniMes).replace('.', ''),
        total: somar(noIntervalo(despesas, iniMes, fimMes)),
      });
    }
    return { titulo: 'Mês a mês', pontos };
  }

  let primeiroDia;
  let quantidadeDias;
  let titulo;

  if (periodo === 'dia') {
    primeiroDia = somarDias(inicioDoDia(referencia), -6);
    quantidadeDias = 7;
    titulo = 'Últimos 7 dias';
  } else if (periodo === 'semana') {
    primeiroDia = inicio;
    quantidadeDias = 7;
    titulo = 'Dia a dia da semana';
  } else {
    primeiroDia = inicio;
    quantidadeDias = Math.round((fim - inicio) / 86400000) + 1;
    titulo = 'Dia a dia do mês';
  }

  for (let i = 0; i < quantidadeDias; i++) {
    const dia = somarDias(primeiroDia, i);
    pontos.push({
      rotulo:
        periodo === 'mes'
          ? String(dia.getDate())
          : fmtDiaMes.format(dia).replace('.', ''),
      total: somar(noIntervalo(despesas, inicioDoDia(dia), fimDoDia(dia))),
    });
  }

  return { titulo, pontos };
}

/**
 * Junta tudo que a aba Resumo precisa para um periodo.
 * `despesas` e a lista completa; o filtro acontece aqui dentro.
 */
export function calcular(periodo, referencia, despesas) {
  const { inicio, fim } = limites(periodo, referencia);
  const doPeriodo = noIntervalo(despesas, inicio, fim);

  const referenciaAnterior = mover(periodo, referencia, -1);
  const anterior = limites(periodo, referenciaAnterior);
  const doAnterior = noIntervalo(despesas, anterior.inicio, anterior.fim);

  const total = somar(doPeriodo);
  const totalAnterior = somar(doAnterior);

  return {
    periodo,
    inicio,
    fim,
    rotulo: rotulo(periodo, inicio, fim),
    despesas: doPeriodo,
    total,
    porCategoria: porCategoria(doPeriodo),
    serie: serie(periodo, referencia, inicio, fim, despesas),
    anterior: {
      ...rotuloAnterior(periodo, anterior.inicio),
      total: totalAnterior,
      porCategoria: porCategoria(doAnterior),
      // null quando nao havia gasto antes: nao da para calcular "X% a mais".
      variacao: totalAnterior > 0 ? (total - totalAnterior) / totalAnterior : null,
    },
  };
}
