// Ponto de entrada: navegacao entre abas, avisos e registro do service worker.

import { iniciarFormulario, renderizarLista } from './formulario.js';
import { iniciarResumo, atualizarResumo } from './resumo.js';
import { iniciarAjustes, atualizarAjustes } from './ajustes.js';

const PAINEIS = {
  lancar: 'painel-lancar',
  resumo: 'painel-resumo',
  ajustes: 'painel-ajustes',
};

let temporizadorAviso = null;

function mostrarAviso(texto, erro = false) {
  const caixa = document.getElementById('aviso');
  caixa.textContent = texto;
  caixa.classList.toggle('aviso--erro', Boolean(erro));
  caixa.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    caixa.hidden = true;
  }, erro ? 4500 : 2200);
}

function trocarAba(nome) {
  for (const [chave, id] of Object.entries(PAINEIS)) {
    document.getElementById(id).hidden = chave !== nome;
  }
  for (const botao of document.querySelectorAll('.aba')) {
    if (botao.dataset.aba === nome) botao.setAttribute('aria-current', 'page');
    else botao.removeAttribute('aria-current');
  }
  if (nome === 'lancar') renderizarLista();
  if (nome === 'resumo') atualizarResumo();
  if (nome === 'ajustes') atualizarAjustes();
  window.scrollTo({ top: 0 });
}

function iniciar() {
  iniciarFormulario({ aviso: mostrarAviso });
  iniciarResumo({ aviso: mostrarAviso });
  iniciarAjustes({
    aviso: mostrarAviso,
    aoMudar: () => {
      renderizarLista();
      atualizarResumo();
    },
  });

  for (const botao of document.querySelectorAll('.aba')) {
    botao.addEventListener('click', () => trocarAba(botao.dataset.aba));
  }

  trocarAba('lancar');

  // O caminho relativo mantem o app funcionando em subpasta (GitHub Pages).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .catch((erro) => console.warn('Service worker não registrado:', erro));
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}
