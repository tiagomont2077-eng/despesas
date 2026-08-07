// ============================================================================
//  COLE AQUI A CONFIGURACAO DO SEU PROJETO NO FIREBASE
// ============================================================================
//
// Onde pegar:
//   console.firebase.google.com  ->  seu projeto
//   -> engrenagem (Configuracoes do projeto)  ->  aba "Geral"
//   -> role ate "Seus apps"  ->  app da Web  ->  "Configuracao do SDK"
//
// Voce vai ver um bloco parecido com este. Copie SO os valores de dentro
// das aspas e substitua os SEU_... abaixo.
//
// Enquanto os valores nao forem preenchidos, o app funciona normalmente —
// apenas sem login e sem familia, exatamente como antes.
//
// ----------------------------------------------------------------------------
// Esta configuracao NAO e secreta.
//
// No Firebase ela e publica por natureza e pode ir para o GitHub sem problema:
// quem protege os dados sao as regras de seguranca do Firestore, nao o sigilo
// dessas chaves. Isso e diferente da chave da Anthropic (a do resumo com IA),
// que e secreta de verdade e por isso fica so no aparelho, nunca no codigo.
// ----------------------------------------------------------------------------

export const CONFIG_FIREBASE = {
  apiKey: 'SEU_API_KEY',
  authDomain: 'SEU_PROJETO.firebaseapp.com',
  projectId: 'SEU_PROJETO',
  storageBucket: 'SEU_PROJETO.firebasestorage.app',
  messagingSenderId: 'SEU_SENDER_ID',
  appId: 'SEU_APP_ID',
};

/** O app so tenta falar com o Firebase depois que isto virar verdadeiro. */
export function configurado() {
  return (
    typeof CONFIG_FIREBASE.apiKey === 'string' &&
    CONFIG_FIREBASE.apiKey.length > 0 &&
    !CONFIG_FIREBASE.apiKey.startsWith('SEU_')
  );
}
