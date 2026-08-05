// Formatacao de dinheiro e datas em portugues do Brasil.
// Regra do app: dinheiro circula sempre como numero inteiro de CENTAVOS.
// A conversao para "R$ 15,00" acontece so na hora de mostrar na tela.

const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** 1500 -> "R$ 15,00" */
export function formatarBRL(centavos) {
  return MOEDA.format((Number(centavos) || 0) / 100);
}

/**
 * Converte o que foi digitado no campo de valor em centavos.
 * A mascara trata cada digito como centavo: digitar 1,5,0,0 vira R$ 15,00.
 */
export function digitosParaCentavos(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  if (!digitos) return 0;
  // Limite de seguranca: evita estourar o inteiro seguro com colagem acidental.
  return Math.min(Number(digitos.slice(0, 12)), Number.MAX_SAFE_INTEGER);
}

/** Data atual no formato que o <input type="datetime-local"> espera. */
export function agoraParaInput() {
  return dataParaInput(new Date());
}

/** Date -> "2026-08-05T09:14" no fuso LOCAL (nao usa toISOString, que e UTC). */
export function dataParaInput(data) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}` +
    `T${p(data.getHours())}:${p(data.getMinutes())}`
  );
}

/** "2026-08-05T09:14" -> Date no fuso local. */
export function inputParaData(texto) {
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? new Date() : data;
}

const HORA = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

const DIA_LONGO = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function formatarHora(texto) {
  return HORA.format(inputParaData(texto));
}

export function formatarDiaLongo(data) {
  const texto = DIA_LONGO.format(data);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Chave "2026-08-05" usada para agrupar lancamentos por dia. */
export function chaveDoDia(texto) {
  return String(texto ?? '').slice(0, 10);
}
