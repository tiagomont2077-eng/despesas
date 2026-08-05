// As sete categorias fixas do app.
// Cada uma tem cor e emoji proprios para ser reconhecida sem precisar ler o rotulo.

export const CATEGORIAS = [
  { id: 'mensalidade', rotulo: 'Mensalidade', emoji: '🧾', cor: '#6B4E9B' },
  { id: 'comida',      rotulo: 'Comida',      emoji: '🍽️', cor: '#C8562B' },
  { id: 'lazer',       rotulo: 'Lazer',       emoji: '🎉', cor: '#D99A00' },
  { id: 'transporte',  rotulo: 'Transporte',  emoji: '🚌', cor: '#2C6E9B' },
  { id: 'saude',       rotulo: 'Saúde',       emoji: '💊', cor: '#B3446C' },
  { id: 'moradia',     rotulo: 'Moradia',     emoji: '🏠', cor: '#2F6F4E' },
  { id: 'outros',      rotulo: 'Outros',      emoji: '📦', cor: '#6B7280' },
];

const PORID = new Map(CATEGORIAS.map((c) => [c.id, c]));

export function categoriaPorId(id) {
  return PORID.get(id) ?? CATEGORIAS[CATEGORIAS.length - 1];
}

/**
 * Remove acentos e caixa para que "saud", "SAÚDE" e "saúde" encontrem Saúde.
 */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // \p{M} = marcas combinantes (os acentos separados pelo NFD)
    .toLowerCase()
    .trim();
}

/**
 * Filtra as categorias pelo texto digitado. Texto vazio devolve todas.
 */
export function filtrarCategorias(texto) {
  const alvo = normalizar(texto);
  if (!alvo) return CATEGORIAS;
  return CATEGORIAS.filter((c) => normalizar(c.rotulo).includes(alvo));
}
