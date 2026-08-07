// ============================================================================
//  COLE AQUI OS DADOS DO SEU PROJETO NO SUPABASE
// ============================================================================
//
// Onde pegar:
//   supabase.com  ->  seu projeto
//   ->  Project Settings (engrenagem)  ->  API
//
//   URL           = campo "Project URL"
//   CHAVE_PUBLICA = campo "anon public"
//
// ATENCAO: existe tambem uma chave "service_role". NAO use ela aqui.
// Essa chave ignora todas as regras de seguranca e daria acesso total ao
// banco para qualquer pessoa que abrisse o site.
//
// Enquanto os valores nao forem preenchidos, o app funciona normalmente —
// apenas sem login e sem familia, exatamente como sempre funcionou.
//
// ----------------------------------------------------------------------------
// A chave "anon public" NAO e secreta.
//
// Ela e publica por natureza e pode ir para o GitHub sem problema: quem
// protege os dados sao as politicas de seguranca (RLS) definidas no banco,
// nao o sigilo dessa chave. Isso e diferente da chave da Anthropic (a do
// resumo com IA), que e secreta de verdade e por isso fica so no aparelho.
// ----------------------------------------------------------------------------

// Raiz do projeto, sem "/rest/v1/" no fim — o cliente monta os caminhos sozinho.
export const URL_SUPABASE = 'https://dmueqjcueyqyqcfffabb.supabase.co';
export const CHAVE_PUBLICA = 'sb_publishable_ehh9oxZ9xQ4jghuHEdBRKQ_ytlk1Pon';

/** O app so tenta falar com o Supabase depois que isto virar verdadeiro. */
export function configurado() {
  return (
    typeof URL_SUPABASE === 'string' &&
    URL_SUPABASE.startsWith('https://') &&
    !URL_SUPABASE.includes('SEU-PROJETO') &&
    typeof CHAVE_PUBLICA === 'string' &&
    CHAVE_PUBLICA.length > 20 &&
    !CHAVE_PUBLICA.startsWith('SUA_')
  );
}
