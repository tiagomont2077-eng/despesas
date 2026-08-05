// Gerador de resumo em texto que roda no proprio aparelho.
// Sem internet, sem chave, sem custo. E o resumo que aparece SEMPRE;
// o resumo com IA (ia.js) e um extra por cima deste.

import { formatarBRL } from './formatar.js';

const ABERTURA = {
  dia: 'Neste dia',
  semana: 'Nesta semana',
  mes: 'Neste mês',
  ano: 'Neste ano',
};

/** Quanto uma categoria precisa subir para virar observacao. */
const LIMIAR_ALTA = 0.3;

export function textoLocal(dados) {
  if (dados.total === 0) {
    return 'Nenhum gasto lançado neste período.';
  }

  const frases = [];
  const abertura = ABERTURA[dados.periodo] ?? 'No período';
  const quantidade = dados.despesas.length;

  frases.push(
    `${abertura} você gastou ${formatarBRL(dados.total)} ` +
      `em ${quantidade} ${quantidade === 1 ? 'lançamento' : 'lançamentos'}.`,
  );

  const maior = maiorCategoria(dados.porCategoria);
  if (maior) {
    const fatia = Math.round((maior.total / dados.total) * 100);
    frases.push(
      `A maior parte foi em ${maior.rotulo}: ${formatarBRL(maior.total)}, ` +
        `${fatia}% do total.`,
    );
  }

  frases.push(fraseComparacao(dados));

  const observacao = fraseObservacao(dados);
  if (observacao) frases.push(observacao);

  return frases.filter(Boolean).join(' ');
}

function maiorCategoria(porCategoria) {
  return porCategoria.reduce(
    (melhor, atual) => (atual.total > (melhor?.total ?? 0) ? atual : melhor),
    null,
  );
}

function fraseComparacao(dados) {
  const { variacao, nome, comEm, total } = dados.anterior;

  if (variacao === null) {
    return total === 0 ? `Não houve gastos ${comEm} para comparar.` : '';
  }
  const porcento = Math.abs(Math.round(variacao * 100));
  if (porcento === 0) return `O valor ficou quase o mesmo que ${nome}.`;
  return variacao > 0
    ? `Isso é ${porcento}% a mais que ${nome}.`
    : `Isso é ${porcento}% a menos que ${nome} — bom sinal.`;
}

/**
 * Procura a categoria que mais destoou do periodo anterior.
 * So comenta quando a diferenca e grande o bastante para ser util.
 */
function fraseObservacao(dados) {
  const anteriorPorId = new Map(dados.anterior.porCategoria.map((c) => [c.id, c.total]));

  let destaque = null;
  for (const categoria of dados.porCategoria) {
    if (categoria.total === 0) continue;
    const antes = anteriorPorId.get(categoria.id) ?? 0;

    // Categoria que nao existia antes e agora pesa: vale mencionar.
    if (antes === 0) {
      const peso = categoria.total / dados.total;
      if (peso >= 0.2 && dados.anterior.total > 0) {
        return `Chama atenção ${categoria.rotulo}, que não teve gasto ${dados.anterior.comEm}.`;
      }
      continue;
    }

    const alta = (categoria.total - antes) / antes;
    if (alta >= LIMIAR_ALTA && (!destaque || alta > destaque.alta)) {
      destaque = { rotulo: categoria.rotulo, alta };
    }
  }

  if (!destaque) return '';
  return (
    `Você gastou mais em ${destaque.rotulo} do que ${dados.anterior.comEm}: ` +
    `${Math.round(destaque.alta * 100)}% acima.`
  );
}
