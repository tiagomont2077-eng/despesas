// Camada de nuvem (Firebase) — OPCIONAL.
//
// Regra de ouro deste modulo: se o Firebase nao estiver configurado, nao
// carregar, falhar ou o aparelho estiver offline, o app inteiro continua
// funcionando como sempre funcionou, em localStorage. Nada aqui pode
// derrubar o resto.
//
// Fase 1: so entrar e sair com a conta Google. Sincronizacao e familia vem
// nas fases seguintes.

import { CONFIG_FIREBASE, configurado } from './config-firebase.js';

const CHAVE_TENTOU_ENTRAR = 'nuvem.tentouEntrar';

let app = null;
let auth = null;
let usuarioAtual = null;
let pronto = false;
const ouvintes = new Set();

/** O modulo esta utilizavel? (configurado + SDK carregado) */
export function disponivel() {
  return pronto && Boolean(auth);
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

/**
 * Inicializa o Firebase. Nunca lanca excecao: qualquer problema apenas
 * deixa `disponivel()` como falso e o app segue local.
 */
export async function iniciarNuvem() {
  if (!configurado()) {
    console.info('Firebase sem configuração — app rodando somente local.');
    return false;
  }
  if (typeof globalThis.firebase === 'undefined') {
    console.warn('SDK do Firebase não carregou — app rodando somente local.');
    return false;
  }

  try {
    app = firebase.initializeApp(CONFIG_FIREBASE);
    auth = firebase.auth();

    // Mantem a sessao entre aberturas do app: a pessoa entra uma vez so.
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    // Em PWA instalado o login acontece por redirecionamento; ao voltar,
    // e aqui que o resultado chega.
    try {
      await auth.getRedirectResult();
    } catch (erro) {
      console.error('Retorno do login falhou:', erro);
      registrarErroDeEntrada(erro);
    } finally {
      localStorage.removeItem(CHAVE_TENTOU_ENTRAR);
    }

    auth.onAuthStateChanged((quem) => {
      usuarioAtual = quem
        ? {
            uid: quem.uid,
            nome: quem.displayName || quem.email || 'Sem nome',
            email: quem.email || '',
            foto: quem.photoURL || '',
          }
        : null;
      avisar();
    });

    pronto = true;
    return true;
  } catch (erro) {
    console.error('Não foi possível iniciar o Firebase:', erro);
    pronto = false;
    return false;
  }
}

/**
 * Entra com a conta Google.
 * Tenta popup primeiro (melhor experiencia no navegador) e cai para
 * redirecionamento quando o popup e bloqueado — que e o caso comum
 * no PWA instalado no celular.
 */
export async function entrar() {
  if (!disponivel()) throw new Error('Conta indisponível neste momento.');

  const provedor = new firebase.auth.GoogleAuthProvider();
  // Sempre perguntar qual conta: em celular compartilhado isso evita
  // lancar gasto na conta da pessoa errada.
  provedor.setCustomParameters({ prompt: 'select_account' });

  try {
    const resultado = await auth.signInWithPopup(provedor);
    return resultado.user;
  } catch (erro) {
    if (precisaRedirecionar(erro)) {
      localStorage.setItem(CHAVE_TENTOU_ENTRAR, '1');
      await auth.signInWithRedirect(provedor);
      return null; // a pagina vai recarregar
    }
    throw new Error(mensagemDeErro(erro));
  }
}

export async function sair() {
  if (!disponivel()) return;
  await auth.signOut();
}

function precisaRedirecionar(erro) {
  return [
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
    'auth/cancelled-popup-request',
  ].includes(erro?.code);
}

function registrarErroDeEntrada(erro) {
  if (!localStorage.getItem(CHAVE_TENTOU_ENTRAR)) return;
  console.error('A entrada por redirecionamento não completou:', erro?.code);
}

/** Mensagens em portugues para o que a pessoa pode de fato resolver. */
export function mensagemDeErro(erro) {
  switch (erro?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/user-cancelled':
      return 'Entrada cancelada.';
    case 'auth/network-request-failed':
      return 'Sem internet para entrar. O app continua funcionando normalmente.';
    case 'auth/unauthorized-domain':
      return 'Este endereço não está autorizado no Firebase.';
    case 'auth/operation-not-allowed':
      return 'O acesso pelo Google não está ativado no Firebase.';
    default:
      return erro?.message || 'Não foi possível entrar agora.';
  }
}
