-- Adiciona campos de título de exibição em projetos e título sincronizado em agendamentos
ALTER TABLE public.content_projects
  ADD COLUMN IF NOT EXISTS display_title text,
  ADD COLUMN IF NOT EXISTS title_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS title_source text;

ALTER TABLE public.publication_schedule_items
  ADD COLUMN IF NOT EXISTS title_override boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_content_projects_display_title
  ON public.content_projects (display_title);