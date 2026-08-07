-- Esquema e seguranca do banco, para o app de despesas em familia.
--
-- COMO APLICAR:
--   supabase.com -> seu projeto -> SQL Editor -> New query
--   -> cole este arquivo inteiro -> Run
--
-- A ideia central: quem protege os dados sao as POLITICAS (RLS) abaixo.
-- A chave "anon public" que fica no codigo do site e publica de proposito;
-- sem estas politicas, qualquer pessoa leria tudo. Com elas, o proprio
-- servidor recusa o acesso, nao importa o que o app peca.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists familias (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  criado_por     uuid not null references auth.users (id) on delete cascade,
  codigo_convite text not null unique,
  criado_em      timestamptz not null default now()
);

create table if not exists membros (
  familia_id uuid not null references familias (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nome       text not null,
  entrou_em  timestamptz not null default now(),
  primary key (familia_id, usuario_id)
);

-- A parte que a familia soma: valor, categoria e data.
-- Todos os membros leem — e isso que permite os totais por pessoa e categoria.
create table if not exists lancamentos (
  id         uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  valor      integer not null check (valor > 0),   -- CENTAVOS, inteiro
  categoria  text not null,
  data       timestamptz not null,
  criado_em  timestamptz not null default now()
);

-- A parte privada: a descricao ("farmacia", "presente do fulano").
-- Tabela separada porque o RLS controla acesso por LINHA, nunca por coluna.
-- Se a descricao morasse junto do valor, esconde-la seria so o app deixando
-- de mostrar — e qualquer familiar leria por fora.
create table if not exists detalhes (
  lancamento_id uuid primary key references lancamentos (id) on delete cascade,
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  descricao     text not null default ''
);

create index if not exists idx_lancamentos_familia_data
  on lancamentos (familia_id, data desc);

-- ---------------------------------------------------------------------------
-- Funcao auxiliar
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER evita recursao infinita: sem isso, a politica de `membros`
-- consultaria `membros`, que dispararia a politica de novo, sem parar.
create or replace function eh_membro(f uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from membros
    where familia_id = f and usuario_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Ligar a seguranca (sem isto, tudo fica aberto)
-- ---------------------------------------------------------------------------

alter table familias    enable row level security;
alter table membros     enable row level security;
alter table lancamentos enable row level security;
alter table detalhes    enable row level security;

-- ---------------------------------------------------------------------------
-- Politicas
-- ---------------------------------------------------------------------------

-- FAMILIAS -------------------------------------------------------------------

drop policy if exists familias_ler on familias;
create policy familias_ler on familias
  for select using (eh_membro(id));

drop policy if exists familias_criar on familias;
create policy familias_criar on familias
  for insert with check (criado_por = auth.uid());

drop policy if exists familias_editar on familias;
create policy familias_editar on familias
  for update using (criado_por = auth.uid());

-- Apagar familia nao existe pelo app: destrutivo demais para um toque
-- acidental. Se precisar, faz-se pelo painel do Supabase.

-- MEMBROS --------------------------------------------------------------------

drop policy if exists membros_ler on membros;
create policy membros_ler on membros
  for select using (eh_membro(familia_id));

-- Entrar na familia: a pessoa so pode acrescentar A SI MESMA, e precisa
-- saber o codigo do convite. O codigo vai no campo `nome` da chamada RPC —
-- ver a funcao entrar_na_familia abaixo.
drop policy if exists membros_sair on membros;
create policy membros_sair on membros
  for delete using (usuario_id = auth.uid());

drop policy if exists membros_editar_proprio on membros;
create policy membros_editar_proprio on membros
  for update using (usuario_id = auth.uid());

-- LANCAMENTOS ----------------------------------------------------------------

drop policy if exists lancamentos_ler on lancamentos;
create policy lancamentos_ler on lancamentos
  for select using (eh_membro(familia_id));

drop policy if exists lancamentos_criar on lancamentos;
create policy lancamentos_criar on lancamentos
  for insert with check (usuario_id = auth.uid() and eh_membro(familia_id));

drop policy if exists lancamentos_editar on lancamentos;
create policy lancamentos_editar on lancamentos
  for update using (usuario_id = auth.uid());

drop policy if exists lancamentos_apagar on lancamentos;
create policy lancamentos_apagar on lancamentos
  for delete using (usuario_id = auth.uid());

-- DETALHES (privado) ---------------------------------------------------------

drop policy if exists detalhes_ler on detalhes;
create policy detalhes_ler on detalhes
  for select using (usuario_id = auth.uid());

drop policy if exists detalhes_criar on detalhes;
create policy detalhes_criar on detalhes
  for insert with check (usuario_id = auth.uid());

drop policy if exists detalhes_editar on detalhes;
create policy detalhes_editar on detalhes
  for update using (usuario_id = auth.uid());

drop policy if exists detalhes_apagar on detalhes;
create policy detalhes_apagar on detalhes
  for delete using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Entrar numa familia pelo codigo de convite
-- ---------------------------------------------------------------------------

-- Precisa ser uma funcao com SECURITY DEFINER porque quem esta entrando
-- ainda NAO e membro — logo, nao consegue ler a familia para conferir o
-- codigo. A funcao confere por dentro e so entao insere.
create or replace function entrar_na_familia(codigo text, meu_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  if auth.uid() is null then
    raise exception 'Você precisa entrar antes.';
  end if;

  select id into alvo from familias where codigo_convite = codigo;

  if alvo is null then
    raise exception 'Código de convite inválido.';
  end if;

  insert into membros (familia_id, usuario_id, nome)
  values (alvo, auth.uid(), coalesce(nullif(trim(meu_nome), ''), 'Sem nome'))
  on conflict (familia_id, usuario_id) do update set nome = excluded.nome;

  return alvo;
end;
$$;

-- Criar familia ja entrando como membro, numa operacao so.
create or replace function criar_familia(nome_familia text, meu_nome text)
returns table (id uuid, codigo_convite text)
language plpgsql
security definer
set search_path = public
as $$
declare
  nova_id uuid;
  novo_codigo text;
begin
  if auth.uid() is null then
    raise exception 'Você precisa entrar antes.';
  end if;

  -- Codigo curto e legivel, sem caracteres que se confundem (0/O, 1/I).
  novo_codigo := upper(
    translate(substr(encode(gen_random_bytes(8), 'base64'), 1, 8), '01OIl+/=', 'ABCDEFGH')
  );

  insert into familias (nome, criado_por, codigo_convite)
  values (coalesce(nullif(trim(nome_familia), ''), 'Minha família'), auth.uid(), novo_codigo)
  returning familias.id, familias.codigo_convite into nova_id, novo_codigo;

  insert into membros (familia_id, usuario_id, nome)
  values (nova_id, auth.uid(), coalesce(nullif(trim(meu_nome), ''), 'Sem nome'));

  return query select nova_id, novo_codigo;
end;
$$;

grant execute on function entrar_na_familia(text, text) to authenticated;
grant execute on function criar_familia(text, text)     to authenticated;
