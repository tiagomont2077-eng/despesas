// Camada de nuvem (Supabase) — OPCIONAL.
//
// Regra de ouro deste modulo: se a nuvem nao estiver configurada, nao carregar,
// falhar ou o aparelho estiver offline, o app inteiro continua funcionando como
// sempre funcionou, em localStorage. Nada aqui pode derrubar o resto.
//
// Fase 1: so entrar e sair, por link enviado no e-mail (sem senha).
// Sincronizacao e visao da familia vem nas fases seguintes.

import { URL_SUPABASE, CHAVE_PUBLICA, configurado } from './config-nuvem.js';

let cliente = null;
let usuarioAtual = null;
let pronto = false;
const ouvintes = new Set();

/** A nuvem esta utilizavel? (configurada + biblioteca carregada) */
export function disponivel() {
  return pronto && Boolean(cliente);
}

export function usuario() {
  return usuarioAtual;
}

/** Avisa a interface sempre que o estado de login mudar. */
export function aoMudarUsuario(callback) {
  ouvintes.add(callback);
  callback(usuarioAtual);
  return () => ouvintes.delete(callback);
}

function avisar() {
  for (const callback of ouvintes) {
    try {
      callback(usuarioAtual);
    } catch (erro) {
      console.error('Ouvinte de login falhou:', erro);
    }
  }
}

function normalizar(sessao) {
  const quem = sessao?.user;
  if (!quem) return null;
  return {
    id: quem.id,
    email: quem.email || '',
    // O nome so existe depois que a pessoa preencher; ate la, usamos o e-mail.
    nome: quem.user_metadata?.nome || quem.email || 'Sem nome',
  };
}

/**
 * Inicializa a nuvem. Nunca lanca excecao: qualquer problema apenas deixa
 * `disponivel()` como falso e o app segue local.
 */
export async function iniciarNuvem() {
  if (!configurado()) {
    console.info('Nuvem sem configuração — app rodando somente local.');
    return false;
  }
  if (typeof globalThis.supabase?.createClient !== 'function') {
    console.warn('Biblioteca do Supabase não carregou — app rodando somente local.');
    return false;
  }

  try {
    cliente = globalThis.supabase.createClient(URL_SUPABASE, CHAVE_PUBLICA, {
      auth: {
        persistSession: true, // a pessoa entra uma vez so
        autoRefreshToken: true,
        // O link do e-mail volta com o token no endereco; isto o consome.
        detectSessionInUrl: true,
      },
    });

    const { data } = await cliente.auth.getSession();
    usuarioAtual = normalizar(data?.session);

    cliente.auth.onAuthStateChange((_evento, sessao) => {
      usuarioAtual = normalizar(sessao);
      avisar();
    });

    pronto = true;
    limparEnderecoDoLink();
    avisar();
    return true;
  } catch (erro) {
    console.error('Não foi possível iniciar a nuvem:', erro);
    pronto = false;
    return false;
  }
}

/**
 * Depois de entrar, o Supabase deixa o token no endereco. Tirar isso da barra
 * evita que a pessoa compartilhe sem querer um link com a propria sessao.
 */
function limparEnderecoDoLink() {
  if (!location.hash.includes('access_token') && !location.search.includes('code=')) return;
  history.replaceState(null, '', location.pathname);
}

/**
 * Envia o link de acesso para o e-mail. Nao existe senha: quem abre o link
 * no proprio celular esta autenticado.
 */
export async function enviarLink(email) {
  if (!disponivel()) throw new Error('Acesso indisponível neste momento.');

  const limpo = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo)) {
    throw new Error('Digite um e-mail válido.');
  }

  const { error } = await cliente.auth.signInWithOtp({
    email: limpo,
    options: {
      // Volta para o proprio app, seja no localhost ou no GitHub Pages.
      emailRedirectTo: new URL('./', location.href).href,
      shouldCreateUser: true,
    },
  });

  if (error) throw new Error(mensagemDeErro(error));
  return limpo;
}

export async function sair() {
  if (!disponivel()) return;
  const { error } = await cliente.auth.signOut();
  if (error) throw new Error(mensagemDeErro(error));
}

/** Usado pelas proximas fases para falar com o banco. */
export function obterCliente() {
  return cliente;
}

/** Mensagens em portugues, focadas no que a pessoa consegue resolver. */
export function mensagemDeErro(erro) {
  const texto = String(erro?.message ?? erro ?? '').toLowerCase();

  if (texto.includes('rate limit') || texto.includes('too many')) {
    return 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.';
  }
  if (texto.includes('failed to fetch') || texto.includes('network')) {
    return 'Sem internet para entrar. O app continua funcionando normalmente.';
  }
  if (texto.includes('invalid') && texto.includes('email')) {
    return 'Esse e-mail não parece válido.';
  }
  if (texto.includes('signups not allowed') || texto.includes('not allowed')) {
    return 'Este e-mail não está autorizado a entrar.';
  }
  return erro?.message || 'Não foi possível entrar agora.';
}
