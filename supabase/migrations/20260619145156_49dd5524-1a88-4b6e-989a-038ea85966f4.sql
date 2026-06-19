ALTER TABLE public.content_projects
  ADD COLUMN IF NOT EXISTS content_development_status text NOT NULL DEFAULT 'draft_auto',
  ADD COLUMN IF NOT EXISTS content_source text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS campaign_content_json jsonb,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS selected_differentiators text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avoid_terms text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.content_outputs
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS imported_content jsonb,
  ADD COLUMN IF NOT EXISTS copy_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;