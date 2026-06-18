# Cria Aí — Estúdio de Conteúdo (Fase 1)

PWA responsivo multimarcas para gerar prompts profissionais de conteúdo de redes sociais de forma **determinística** (sem IA nesta fase). Stack: TanStack Start + Tailwind v4 + Lovable Cloud (Supabase) + shadcn/ui.

## Identidade visual

- Tema escuro padrão (grafite/preto suave) + tema claro alternativo.
- Tokens em `src/styles.css` (oklch):
  - `--background` grafite quase preto, `--card` cinza escuro, `--foreground` branco suave.
  - `--primary` laranja (destaque/CTA), `--accent` roxo sutil (ações criativas).
  - Cantos arredondados (`--radius: 0.75rem`), sombras suaves.
- Tipografia: Inter (corpo) + Space Grotesk (títulos), carregadas via `<link>` em `__root.tsx`.
- Ícones: `lucide-react`.

## Estrutura de rotas (TanStack Router)

```
src/routes/
  __root.tsx                 (shell + Toaster + Auth listener)
  index.tsx                  (redireciona p/ /app ou /auth)
  auth.tsx                   (login, signup, recuperar senha, mostrar/ocultar)
  reset-password.tsx         (definir nova senha)
  _authenticated/
    route.tsx                (gate gerenciado, ssr:false)
    app.tsx                  (layout app: sidebar + topbar + Outlet)
    app.index.tsx            (Dashboard / Início)
    app.brands.index.tsx     (Minhas Marcas — listagem)
    app.brands.new.tsx       (Cadastro)
    app.brands.$brandId.edit.tsx
    app.content.new.tsx      (Wizard 7 etapas)
    app.content.$projectId.result.tsx   (Resultado / blocos)
    app.library.tsx          (Biblioteca + filtros + cards/tabela)
    app.templates.tsx        (Modelos)
    app.settings.tsx         (Configurações)
```

## Banco de dados (migrations)

Tabelas conforme spec: `profiles`, `brands`, `brand_assets`, `content_projects`, `content_outputs`, `prompt_templates`.
- RLS habilitada em todas; políticas `auth.uid() = user_id`.
- GRANTs para `authenticated` + `service_role`.
- Trigger `handle_new_user` cria `profiles` no signup.
- Storage bucket privado `brand-assets` (RLS por `user_id` na pasta).
- Seed de 16 modelos do sistema em `prompt_templates` (is_system_template=true) via migration.

## Gerador determinístico

`src/lib/promptBuilder.ts`:
- Entrada: `{ brand, project, formats, outputs, mode }`.
- Helpers: `sanitize`, `joinList`, `section(title, body)` — omite seções vazias.
- Blocos gerados: resumo do briefing, estratégia, conceito criativo, textos, layouts, carrossel, stories, reel, legendas, hashtags, engajamento, prompt visual, auditoria, **prompt mestre**.
- Modo Seguro adiciona regras estritas anti-invenção; Modo Rápido encurta.
- Retorna `{ blocks: Block[], masterPrompt: string }`.
- Cobertura por testes manuais via UI; sem dependência externa.

## Componentes principais

- `BrandCard`, `BrandForm` (abas: Dados, Público, Identidade, Conteúdo, Arquivos) com `TagInput` para listas.
- `ContentWizard` com `StepIndicator` e estado em `useReducer`; autosave (debounced) em `content_projects` com `status='draft'`.
- `ResultBlock` (copiar, editar, salvar, favoritar, restaurar) usando `content_outputs`.
- `LibraryFilters` + alternância cards/tabela.
- `TemplateCard` + editor.
- `ConfirmDialog`, `Toaster` (sonner), `CopyButton` com feedback visual.

## Auth e segurança

- Email/senha + "permanecer conectado" (persistSession default já cobre; toggle define `localStorage` vs `sessionStorage`).
- `_authenticated/route.tsx` gerenciado pela integração.
- RLS estrita; uploads validados (tipo/tamanho ≤ 5MB); sanitização de strings; sem chaves no front.

## PWA

- `public/manifest.webmanifest` com nome, ícones, theme color laranja, `display: standalone`.
- Tags no `__root.tsx` head (manifest + apple-touch-icon + theme-color).
- Sem service worker nesta fase (apenas instalável).

## UX

- Autosave de rascunhos; confirmação antes de excluir; toasts; etapas recolhíveis no mobile; campos grandes.
- SEO mínimo: `head()` por rota com título/descrição em PT-BR.
- `sitemap.xml` + `robots.txt` para rotas públicas (`/`, `/auth`).

## Fora do escopo (Fase 1)

Geração de imagens, IA, calendário, postagem automática, colaboração, billing.

## Ordem de execução

1. Habilitar Lovable Cloud.
2. Migrations (tabelas + RLS + GRANTs + trigger + seed de modelos) + bucket de storage.
3. Design system (`styles.css`) + fontes + manifest PWA.
4. Auth (login/signup/reset).
5. Layout app + Dashboard.
6. CRUD de Marcas + uploads.
7. `promptBuilder.ts` + Wizard + Resultado.
8. Biblioteca + Modelos + Configurações.
9. Sitemap/robots + revisão responsiva.

Aprovando, começo pela ativação do Cloud e migrations.
