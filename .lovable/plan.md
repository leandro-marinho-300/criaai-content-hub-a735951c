# Módulo "Calendário de Postagens"

Vou implementar o calendário editorial em fases priorizando o núcleo funcional. Dada a extensão do briefing (32 seções), divido a entrega entre **MVP funcional completo** (entrega imediata) e **refinamentos** (deixados como TODO marcado, prontos para próxima iteração).

## Escopo desta entrega

### Núcleo (entrega completa)
- Nova rota `/app/calendar` no menu lateral (entre Biblioteca e Modelos).
- Três visões: **Mês**, **Semana**, **Agenda**. Última visão salva em `localStorage`.
- Cabeçalho: navegação ant/prox/hoje, seletor de visão, "Nova publicação", "Conteúdos sem data", filtros.
- Filtros: marca, canal, formato, status, aprovação. "Limpar filtros". Combinação livre.
- Cores por **Marca** ou **Status** (toggle persistido). Ícone + texto sempre presentes.
- Cards com horário, marca, título, formato, canal, status, miniatura (compactos em telas pequenas).
- Drawer de detalhes: dados principais, conteúdo (legenda/hashtags/peças), aprovação, planejamento, ações (editar, reagendar, abrir projeto, duplicar, marcar publicado/aprovado/agendado/cancelado, excluir).
- Formulário "Nova publicação": avulsa OU a partir de projeto (carrega marca/título/formato/legenda/hashtags/artes).
- Painel **Conteúdos sem data**: projetos com peças mas sem `confirmed_date`. Drag para o calendário OU clique p/ escolher data (mobile-friendly).
- Drag-and-drop (desktop) com confirmação de reagendamento; alternativa "Alterar data" via modal (mobile).
- Estado calculado `is_overdue` (sem persistir mudança).
- Marcar como publicado: data/hora real, URL opcional, observações. Desfazer publicação com confirmação.
- Botão "Adicionar ao calendário" na página de resultado do projeto — detecta unidades de publicação (1 carrossel = 1 item, 1 sequência stories = 1 item, etc.) e cria itens em lote.
- Integração com PDF do cliente: sincronizar `suggested_date`/`confirmed_date` ao salvar configurações do PDF (sem duplicar — `upsert` por `project_id + publication_unit`).
- Dashboard: bloco "Próximas publicações" (5) + métricas (agendadas semana, aguardando aprovação, atrasadas, publicadas mês, sem data).
- Estados vazios bem desenhados.
- RLS por `user_id`. Modo claro/escuro. Responsividade (Agenda como default em mobile).
- Histórico básico (tabela + registro em ações chave).

### Banco de dados (migração não-destrutiva)
Tabela `publication_schedule_items` já existe; vou **adicionar**:
- `format text`, `description text`, `timezone text default 'America/Sao_Paulo'`,
- `internal_notes text`, `assigned_to uuid`, `published_at timestamptz`,
- `cancelled_at timestamptz`, `publication_url text`, `publication_notes text`,
- `checklist jsonb default '{}'`.

Novas tabelas:
- `publication_schedule_outputs` — vínculo item ↔ `content_outputs` (peças/páginas), com `display_order`.
- `publication_schedule_history` — histórico de ações.

Marca:
- `brands.publication_preferences jsonb` — canais, dias, horários, frequência, intervalo. Editor simples na página de edição da marca.

Todas com `GRANT` para `authenticated`/`service_role` e RLS `auth.uid() = user_id`.

### Refinamentos deixados como TODO marcado
Os seguintes itens ficam estruturados (campos no schema, espaço na UI) mas com implementação mínima nesta entrega — para evitar inflar o PR e priorizar o uso real:

- **Planejar período** (distribuição automática determinística): UI inicial com formulário e prévia, algoritmo simples (round-robin por dias/horários permitidos). Sem otimização avançada.
- **Detecção de conflitos**: implemento as 3 mais críticas (mesma marca+canal+horário; duplicação exata; falta de arte aprovada). Demais ficam como TODO comentado.
- **Checklist pré-publicação**: estrutura `jsonb` + UI no drawer. Cálculo de progresso. Sem auto-marcação inteligente além do óbvio (tem arte? tem legenda? aprovado?).
- **Notificações internas**: bloco no dashboard mostrando alertas calculados em query (sem tabela de notificações nem sino global). Sino global fica TODO.
- **Separar Stories em horários diferentes**: editor permite, mas a unidade default é uma só. Documentado no drawer.
- **Miniaturas otimizadas**: uso direto da signed URL existente; sem geração de thumbnails dedicados.

## Arquivos novos

- `src/lib/calendar.ts` — tipos (`ScheduleItem`, `ScheduleStatus`, `ApprovalStatus`, `ChannelKind`), helpers de status/cor/ícone, `computeIsOverdue`, label/PT-BR.
- `src/lib/scheduleQueries.ts` — funções de leitura/escrita (`listScheduleItems`, `upsertScheduleItem`, `rescheduleItem`, `markPublished`, `undoPublished`, `deleteItem`, `recordHistory`, `listUndated`).
- `src/lib/publicationUnits.ts` — deriva unidades de publicação de um projeto (carrossel→1, sequência stories→1, status WhatsApp→1, etc.) e mapeia `content_outputs` para vínculos.
- `src/lib/periodPlanner.ts` — distribuição determinística round-robin.
- `src/components/calendar/calendar-page.tsx` — shell com header, filtros, view switcher.
- `src/components/calendar/calendar-month.tsx` — grade mensal.
- `src/components/calendar/calendar-week.tsx` — grade semanal com horários.
- `src/components/calendar/calendar-agenda.tsx` — lista agrupada por data.
- `src/components/calendar/schedule-card.tsx` — card compacto/expandido com popover.
- `src/components/calendar/schedule-drawer.tsx` — drawer de detalhes + ações.
- `src/components/calendar/schedule-form-dialog.tsx` — criar/editar publicação (avulsa ou via projeto).
- `src/components/calendar/undated-panel.tsx` — painel lateral / sheet.
- `src/components/calendar/reschedule-dialog.tsx` — confirmação de reagendamento.
- `src/components/calendar/mark-published-dialog.tsx`.
- `src/components/calendar/calendar-filters.tsx`.
- `src/components/calendar/plan-period-dialog.tsx`.
- `src/components/calendar/add-to-calendar-dialog.tsx` — usado na página de resultado.
- `src/routes/_authenticated/app.calendar.tsx`.
- `supabase/migrations/<ts>_calendar_module.sql`.

## Arquivos alterados

- `src/components/app-sidebar.tsx` — novo item "Calendário" (ícone `CalendarCheck`) entre Biblioteca e Modelos.
- `src/routes/_authenticated/app.content.$projectId.result.tsx` — botão "Adicionar ao calendário" + dialog.
- `src/routes/_authenticated/app.content.$projectId.client-pdf.tsx` — ao salvar config, sincronizar `publication_schedule_items` (upsert idempotente).
- `src/routes/_authenticated/app.index.tsx` — bloco "Próximas publicações" e métricas (agendadas semana / aguardando / atrasadas / publicadas mês / sem data).
- `src/routes/_authenticated/app.brands.$brandId.edit.tsx` + `src/components/brand-form.tsx` — seção "Preferências de publicação" (canais, dias, horários, frequência).
- `src/integrations/supabase/types.ts` — regenerado após a migração.
- `src/routeTree.gen.ts` — regenerado.

## Estrutura do schema (resumo)

```sql
ALTER TABLE publication_schedule_items
  ADD COLUMN format text,
  ADD COLUMN description text,
  ADD COLUMN timezone text DEFAULT 'America/Sao_Paulo',
  ADD COLUMN internal_notes text,
  ADD COLUMN assigned_to uuid,
  ADD COLUMN published_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN publication_url text,
  ADD COLUMN publication_notes text,
  ADD COLUMN checklist jsonb NOT NULL DEFAULT '{}';

CREATE TABLE publication_schedule_outputs (
  id uuid PK, user_id uuid, schedule_item_id uuid FK CASCADE,
  output_id uuid FK content_outputs CASCADE,
  display_order int DEFAULT 0, created_at timestamptz
);

CREATE TABLE publication_schedule_history (
  id uuid PK, user_id uuid, schedule_item_id uuid FK CASCADE,
  action_type text, old_date date, old_time text, new_date date, new_time text,
  old_status text, new_status text, notes text, created_at timestamptz
);

ALTER TABLE brands ADD COLUMN publication_preferences jsonb DEFAULT '{}';
```

Tudo com `GRANT SELECT/INSERT/UPDATE/DELETE ... TO authenticated`, `GRANT ALL ... TO service_role`, RLS habilitado, política `auth.uid() = user_id`.

## Considerações de segurança/RLS

- Calendário lê apenas itens do próprio usuário.
- Vínculo com `content_outputs` valida `user_id` na inserção.
- Miniaturas via signed URL existente (`pieceAssets.ts`). Sem URLs públicas.
- Histórico nunca exposto fora do dono.

## Itens FORA do escopo (conforme briefing seção 29)

Postagem automática, integrações com Meta/Instagram/WhatsApp/Facebook/LinkedIn, análise de engajamento, recomendação de melhor horário, aprovação por link público, e-mail/push.

---

Posso prosseguir com essa entrega? Se quiser, posso restringir ainda mais o primeiro PR (por exemplo, apenas Mês + Agenda + criação manual + drawer, deixando Semana, planejar-período e drag-and-drop para um segundo passo) — é uma feature grande e dividir reduz risco de regressão.
