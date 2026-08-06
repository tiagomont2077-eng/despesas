// A linha de um lancamento na tela, usada em dois lugares:
// a lista de "hoje" na aba Lancar e o historico na aba Resumo.
//
// Nao decide o que fazer ao editar nem ao excluir — quem chama passa isso.

import { categoriaPorId } from './categorias.js';
import { formatarBRL, formatarHora } from './formatar.js';

/**
 * @param {object} despesa
 * @param {{ aoEditar: (d) => void, aoExcluir: (d) => void }} acoes
 *        `aoExcluir` so e chamado depois da pessoa confirmar.
 */
export function criarLinha(despesa, { aoEditar, aoExcluir }) {
  const categoria = categoriaPorId(despesa.categoria);
  const nome = despesa.descricao || categoria.rotulo;

  const item = document.createElement('li');
  item.className = 'lancamento';

  const marca = document.createElement('span');
  marca.className = 'lancamento__marca';
  marca.style.background = `color-mix(in srgb, ${categoria.cor} 18%, white)`;
  marca.textContent = categoria.emoji;
  marca.setAttribute('aria-hidden', 'true');

  const corpo = document.createElement('div');
  corpo.className = 'lancamento__corpo';

  const descricao = document.createElement('div');
  descricao.className = 'lancamento__descricao';
  descricao.textContent = nome;

  const meta = document.createElement('div');
  meta.className = 'lancamento__meta';
  meta.textContent = `${categoria.rotulo} · ${formatarHora(despesa.data)}`;

  corpo.append(descricao, meta);

  const valor = document.createElement('span');
  valor.className = 'lancamento__valor';
  valor.textContent = formatarBRL(despesa.valor);

  const acoes = document.createElement('div');
  acoes.className = 'lancamento__acoes';
  acoes.append(
    botao('✏️', `Editar ${nome}, ${formatarBRL(despesa.valor)}`, () => aoEditar(despesa)),
    botao('🗑️', `Excluir ${nome}, ${formatarBRL(despesa.valor)}`, () => {
      // A confirmacao mora aqui: vale nos dois lugares que usam a linha.
      if (!confirm(`Excluir "${nome}" de ${formatarBRL(despesa.valor)}?`)) return;
      aoExcluir(despesa);
    }),
  );

  item.append(marca, corpo, valor, acoes);
  return item;
}

function botao(emoji, rotulo, aoClicar) {
  const elemento = document.createElement('button');
  elemento.type = 'button';
  elemento.className = 'lancamento__acao';
  elemento.textContent = emoji;
  elemento.setAttribute('aria-label', rotulo);
  elemento.addEventListener('click', aoClicar);
  return elemento;
}
