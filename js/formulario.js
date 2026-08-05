// Aba "Lancar": formulario de despesa + lista dos gastos de hoje.

import { CATEGORIAS, categoriaPorId, filtrarCategorias } from './categorias.js';
import * as armazem from './armazenamento.js';
import {
  formatarBRL,
  digitosParaCentavos,
  agoraParaInput,
  formatarHora,
  formatarDiaLongo,
  chaveDoDia,
} from './formatar.js';

const el = {};
let categoriaSelecionada = null;
let editandoId = null;
let mostrarAviso = () => {};

export function iniciarFormulario({ aviso }) {
  mostrarAviso = aviso;

  el.form = document.getElementById('form-despesa');
  el.id = document.getElementById('campo-id');
  el.valor = document.getElementById('campo-valor');
  el.erroValor = document.getElementById('erro-valor');
  el.descricao = document.getElementById('campo-descricao');
  el.busca = document.getElementById('campo-busca-categoria');
  el.limparBusca = document.getElementById('limpar-busca');
  el.grade = document.getElementById('grade-categorias');
  el.dicaCategoria = document.getElementById('dica-categoria');
  el.erroCategoria = document.getElementById('erro-categoria');
  el.alternarData = document.getElementById('alternar-data');
  el.blocoData = document.getElementById('bloco-data');
  el.data = document.getElementById('campo-data');
  el.cancelar = document.getElementById('botao-cancelar');
  el.salvar = document.getElementById('botao-salvar');
  el.lista = document.getElementById('lista-hoje');
  el.vazio = document.getElementById('vazio-hoje');
  el.totalHoje = document.getElementById('total-hoje');
  el.dataHoje = document.getElementById('data-hoje');

  montarGrade();
  aplicarFiltro('');

  // Mascara de dinheiro: cada digito digitado vale um centavo.
  el.valor.addEventListener('input', () => {
    const centavos = digitosParaCentavos(el.valor.value);
    el.valor.value = centavos ? formatarBRL(centavos).replace('R$', '').trim() : '';
    esconder(el.erroValor);
  });

  el.busca.addEventListener('input', () => aplicarFiltro(el.busca.value));
  el.busca.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter') return;
    // Enter no filtro nao envia o formulario: confirma a categoria restante.
    evento.preventDefault();
    const visiveis = filtrarCategorias(el.busca.value);
    if (visiveis.length === 1) {
      selecionar(visiveis[0].id);
      el.busca.blur();
    }
  });

  el.limparBusca.addEventListener('click', () => {
    el.busca.value = '';
    aplicarFiltro('');
    el.busca.focus();
  });

  el.alternarData.addEventListener('click', () => {
    const aberto = !el.blocoData.hidden;
    el.blocoData.hidden = aberto;
    el.alternarData.setAttribute('aria-expanded', String(!aberto));
    el.alternarData.textContent = aberto ? 'Alterar data e hora' : 'Usar data e hora de agora';
    if (aberto) el.data.value = agoraParaInput();
  });

  el.form.addEventListener('submit', aoEnviar);
  el.cancelar.addEventListener('click', limparFormulario);

  limparFormulario();
  renderizarLista();
}

// --- Categorias -------------------------------------------------------------

function montarGrade() {
  el.grade.replaceChildren(
    ...CATEGORIAS.map((categoria) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'categoria';
      botao.dataset.id = categoria.id;
      botao.style.setProperty('--cor', categoria.cor);
      botao.setAttribute('role', 'option');
      botao.setAttribute('aria-selected', 'false');
      botao.innerHTML =
        `<span class="categoria__emoji" aria-hidden="true">${categoria.emoji}</span>` +
        `<span>${categoria.rotulo}</span>`;
      botao.addEventListener('click', () => selecionar(categoria.id));
      return botao;
    }),
  );
}

/**
 * Esconde da grade as categorias que nao casam com o texto.
 * Os botoes continuam no DOM: so o `hidden` muda, entao nao ha re-render.
 */
function aplicarFiltro(texto) {
  const visiveis = filtrarCategorias(texto);
  const idsVisiveis = new Set(visiveis.map((c) => c.id));

  for (const botao of el.grade.children) {
    botao.hidden = !idsVisiveis.has(botao.dataset.id);
  }

  el.limparBusca.hidden = !texto;

  if (visiveis.length === 0) {
    el.dicaCategoria.textContent = 'Nenhuma categoria com esse nome. Apague o texto para ver todas.';
    el.dicaCategoria.hidden = false;
  } else if (visiveis.length === 1 && texto) {
    // Sobrou uma so: ja deixa escolhida, o Enter apenas confirma.
    selecionar(visiveis[0].id);
    el.dicaCategoria.textContent = `${visiveis[0].rotulo} selecionada. Toque em Salvar.`;
    el.dicaCategoria.hidden = false;
  } else {
    esconder(el.dicaCategoria);
  }
}

function selecionar(id) {
  categoriaSelecionada = id;
  for (const botao of el.grade.children) {
    botao.setAttribute('aria-selected', String(botao.dataset.id === id));
  }
  esconder(el.erroCategoria);
}

// --- Salvar -----------------------------------------------------------------

function aoEnviar(evento) {
  evento.preventDefault();

  const valor = digitosParaCentavos(el.valor.value);
  let valido = true;

  if (valor <= 0) {
    mostrar(el.erroValor, 'Informe quanto foi gasto.');
    valido = false;
  }
  if (!categoriaSelecionada) {
    mostrar(el.erroCategoria, 'Escolha uma categoria.');
    valido = false;
  }
  if (!valido) return;

  const registro = {
    descricao: el.descricao.value.trim(),
    valor,
    categoria: categoriaSelecionada,
    data: el.data.value || agoraParaInput(),
  };

  try {
    if (editandoId) {
      armazem.atualizar(editandoId, registro);
      mostrarAviso('Gasto atualizado.');
    } else {
      armazem.adicionar(registro);
      mostrarAviso('Gasto salvo!');
    }
  } catch (erro) {
    mostrarAviso(erro.message || 'Não foi possível salvar.', true);
    return;
  }

  limparFormulario();
  renderizarLista();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limparFormulario() {
  editandoId = null;
  el.id.value = '';
  el.valor.value = '';
  el.descricao.value = '';
  el.busca.value = '';
  el.data.value = agoraParaInput();
  el.blocoData.hidden = true;
  el.alternarData.setAttribute('aria-expanded', 'false');
  el.alternarData.textContent = 'Alterar data e hora';
  el.cancelar.hidden = true;
  el.salvar.textContent = 'Salvar';
  categoriaSelecionada = null;
  for (const botao of el.grade.children) botao.setAttribute('aria-selected', 'false');
  aplicarFiltro('');
  esconder(el.erroValor);
  esconder(el.erroCategoria);
}

function editar(despesa) {
  editandoId = despesa.id;
  el.id.value = despesa.id;
  el.valor.value = formatarBRL(despesa.valor).replace('R$', '').trim();
  el.descricao.value = despesa.descricao;
  el.data.value = despesa.data;
  el.blocoData.hidden = false;
  el.alternarData.setAttribute('aria-expanded', 'true');
  el.alternarData.textContent = 'Usar data e hora de agora';
  el.busca.value = '';
  aplicarFiltro('');
  selecionar(despesa.categoria);
  el.cancelar.hidden = false;
  el.salvar.textContent = 'Salvar alterações';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Lista de hoje ----------------------------------------------------------

export function renderizarLista() {
  const hoje = chaveDoDia(agoraParaInput());
  el.dataHoje.textContent = formatarDiaLongo(new Date());

  const doDia = armazem.listar().filter((d) => chaveDoDia(d.data) === hoje);
  const total = doDia.reduce((soma, d) => soma + d.valor, 0);
  el.totalHoje.textContent = formatarBRL(total);

  el.vazio.hidden = doDia.length > 0;
  el.lista.replaceChildren(...doDia.map(linha));
}

function linha(despesa) {
  const categoria = categoriaPorId(despesa.categoria);
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
  descricao.textContent = despesa.descricao || categoria.rotulo;
  const meta = document.createElement('div');
  meta.className = 'lancamento__meta';
  meta.textContent = `${categoria.rotulo} · ${formatarHora(despesa.data)}`;
  corpo.append(descricao, meta);

  const valor = document.createElement('span');
  valor.className = 'lancamento__valor';
  valor.textContent = formatarBRL(despesa.valor);

  const acoes = document.createElement('div');
  acoes.className = 'lancamento__acoes';

  const botaoEditar = document.createElement('button');
  botaoEditar.type = 'button';
  botaoEditar.className = 'lancamento__acao';
  botaoEditar.textContent = '✏️';
  botaoEditar.setAttribute(
    'aria-label',
    `Editar ${despesa.descricao || categoria.rotulo}, ${formatarBRL(despesa.valor)}`,
  );
  botaoEditar.addEventListener('click', () => editar(despesa));

  const botaoExcluir = document.createElement('button');
  botaoExcluir.type = 'button';
  botaoExcluir.className = 'lancamento__acao';
  botaoExcluir.textContent = '🗑️';
  botaoExcluir.setAttribute(
    'aria-label',
    `Excluir ${despesa.descricao || categoria.rotulo}, ${formatarBRL(despesa.valor)}`,
  );
  botaoExcluir.addEventListener('click', () => {
    const nome = despesa.descricao || categoria.rotulo;
    if (!confirm(`Excluir "${nome}" de ${formatarBRL(despesa.valor)}?`)) return;
    armazem.remover(despesa.id);
    if (editandoId === despesa.id) limparFormulario();
    renderizarLista();
    mostrarAviso('Gasto excluído.');
  });

  acoes.append(botaoEditar, botaoExcluir);
  item.append(marca, corpo, valor, acoes);
  return item;
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
