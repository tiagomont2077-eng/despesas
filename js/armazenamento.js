// Persistencia local. Uma unica chave no localStorage guarda tudo.
//
// Formato gravado:
//   { versao: 1, despesas: [ { id, descricao, valor, categoria, data } ] }
//
// - valor  : inteiro em CENTAVOS
// - data   : "2026-08-05T09:14" (horario local, sem fuso)

import { CATEGORIAS } from './categorias.js';

const CHAVE = 'despesas.v1';
const CHAVE_API = 'configuracao.chaveApi';
const VERSAO = 1;

const IDS_VALIDOS = new Set(CATEGORIAS.map((c) => c.id));

function vazio() {
  return { versao: VERSAO, despesas: [] };
}

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return vazio();
    const dados = JSON.parse(bruto);
    if (!dados || !Array.isArray(dados.despesas)) return vazio();
    return { versao: dados.versao ?? VERSAO, despesas: dados.despesas };
  } catch (erro) {
    // JSON corrompido nao pode derrubar o app: melhor comecar limpo do que travar.
    console.error('Nao foi possivel ler os dados salvos:', erro);
    return vazio();
  }
}

function gravar(dados) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
    return true;
  } catch (erro) {
    console.error('Nao foi possivel salvar:', erro);
    return false;
  }
}

function novoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Garante que um registro vindo de fora (import/backup) tem forma valida. */
function saneia(bruta) {
  if (!bruta || typeof bruta !== 'object') return null;
  const valor = Math.round(Number(bruta.valor));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const data = String(bruta.data ?? '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(data)) return null;
  return {
    id: String(bruta.id || novoId()),
    descricao: String(bruta.descricao ?? '').slice(0, 120).trim(),
    valor,
    categoria: IDS_VALIDOS.has(bruta.categoria) ? bruta.categoria : 'outros',
    data: data.slice(0, 16),
  };
}

/** Todas as despesas, da mais recente para a mais antiga. */
export function listar() {
  return ler().despesas.slice().sort((a, b) => b.data.localeCompare(a.data));
}

export function adicionar({ descricao, valor, categoria, data }) {
  const registro = saneia({ id: novoId(), descricao, valor, categoria, data });
  if (!registro) throw new Error('Lançamento inválido.');
  const dados = ler();
  dados.despesas.push(registro);
  if (!gravar(dados)) throw new Error('Não foi possível salvar no aparelho.');
  return registro;
}

export function atualizar(id, campos) {
  const dados = ler();
  const i = dados.despesas.findIndex((d) => d.id === id);
  if (i === -1) return null;
  const registro = saneia({ ...dados.despesas[i], ...campos, id });
  if (!registro) throw new Error('Lançamento inválido.');
  dados.despesas[i] = registro;
  if (!gravar(dados)) throw new Error('Não foi possível salvar no aparelho.');
  return registro;
}

export function remover(id) {
  const dados = ler();
  const antes = dados.despesas.length;
  dados.despesas = dados.despesas.filter((d) => d.id !== id);
  if (dados.despesas.length === antes) return false;
  return gravar(dados);
}

export function apagarTudo() {
  return gravar(vazio());
}

export function quantidade() {
  return ler().despesas.length;
}

// --- Backup -----------------------------------------------------------------

export function exportar() {
  return JSON.stringify(ler(), null, 2);
}

/**
 * Le um backup e SUBSTITUI os dados atuais.
 * Devolve quantos lancamentos foram importados.
 */
export function importar(textoJson) {
  const dados = JSON.parse(textoJson);
  const lista = Array.isArray(dados) ? dados : dados?.despesas;
  if (!Array.isArray(lista)) throw new Error('Arquivo de backup não reconhecido.');
  const despesas = lista.map(saneia).filter(Boolean);
  if (!gravar({ versao: VERSAO, despesas })) {
    throw new Error('Não foi possível salvar no aparelho.');
  }
  return despesas.length;
}

// --- Chave da API (opcional, usada so pelo resumo com IA) -------------------

export function lerChaveApi() {
  try {
    return localStorage.getItem(CHAVE_API) || '';
  } catch {
    return '';
  }
}

export function gravarChaveApi(chave) {
  try {
    const limpa = String(chave ?? '').trim();
    if (limpa) localStorage.setItem(CHAVE_API, limpa);
    else localStorage.removeItem(CHAVE_API);
    return true;
  } catch {
    return false;
  }
}
