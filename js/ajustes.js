// Aba "Ajustes": copia de seguranca, chave da API e apagar tudo.

import * as armazem from './armazenamento.js';

let mostrarAviso = () => {};
let aoMudarDados = () => {};

export function iniciarAjustes({ aviso, aoMudar }) {
  mostrarAviso = aviso;
  aoMudarDados = aoMudar;

  const exportar = document.getElementById('botao-exportar');
  const importar = document.getElementById('botao-importar');
  const arquivo = document.getElementById('arquivo-importar');
  const apagar = document.getElementById('botao-apagar-tudo');
  const chave = document.getElementById('campo-chave');
  const salvarChave = document.getElementById('botao-salvar-chave');
  const removerChave = document.getElementById('botao-remover-chave');

  exportar.addEventListener('click', baixarCopia);

  importar.addEventListener('click', () => arquivo.click());
  arquivo.addEventListener('change', async () => {
    const escolhido = arquivo.files?.[0];
    if (!escolhido) return;
    try {
      const total = armazem.importar(await escolhido.text());
      mostrarAviso(`${total} lançamento${total === 1 ? '' : 's'} restaurado${total === 1 ? '' : 's'}.`);
      aoMudarDados();
      atualizarContagem();
    } catch (erro) {
      mostrarAviso(erro.message || 'Arquivo inválido.', true);
    } finally {
      // Permite escolher o mesmo arquivo de novo depois.
      arquivo.value = '';
    }
  });

  apagar.addEventListener('click', () => {
    const total = armazem.quantidade();
    if (total === 0) {
      mostrarAviso('Não há nada para apagar.');
      return;
    }
    if (!confirm(`Apagar os ${total} lançamentos deste aparelho? Não dá para desfazer.`)) return;
    armazem.apagarTudo();
    mostrarAviso('Tudo apagado.');
    aoMudarDados();
    atualizarContagem();
  });

  salvarChave.addEventListener('click', () => {
    const valor = chave.value.trim();
    if (!valor) {
      mostrarAviso('Cole a chave antes de salvar.', true);
      return;
    }
    armazem.gravarChaveApi(valor);
    chave.value = '';
    mostrarAviso('Chave salva neste aparelho.');
    atualizarEstadoChave();
  });

  removerChave.addEventListener('click', () => {
    armazem.gravarChaveApi('');
    chave.value = '';
    mostrarAviso('Chave removida.');
    atualizarEstadoChave();
  });

  atualizarContagem();
  atualizarEstadoChave();
}

/** Chamado sempre que a aba Ajustes e aberta. */
export function atualizarAjustes() {
  atualizarContagem();
  atualizarEstadoChave();
}

function atualizarContagem() {
  const total = armazem.quantidade();
  const alvo = document.getElementById('contagem-despesas');
  if (alvo) alvo.textContent = `${total} lançamento${total === 1 ? '' : 's'}`;
}

function atualizarEstadoChave() {
  const estado = document.getElementById('estado-chave');
  if (!estado) return;
  const chave = armazem.lerChaveApi();
  estado.textContent = chave
    ? `Chave guardada: ${mascarar(chave)}`
    : 'Nenhuma chave guardada. O resumo continua funcionando sem ela.';
}

/** Mostra so o comeco e o fim, para conferir sem expor a chave inteira. */
function mascarar(chave) {
  if (chave.length <= 12) return '••••••';
  return `${chave.slice(0, 7)}…${chave.slice(-4)}`;
}

function baixarCopia() {
  const conteudo = armazem.exportar();
  const blob = new Blob([conteudo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const hoje = new Date().toISOString().slice(0, 10);

  const link = document.createElement('a');
  link.href = url;
  link.download = `despesas-${hoje}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  mostrarAviso('Cópia baixada.');
}
