
-- 1) Adicionar coluna include_in_client_pdf
ALTER TABLE public.content_piece_assets
  ADD COLUMN IF NOT EXISTS include_in_client_pdf BOOLEAN NOT NULL DEFAULT TRUE;

-- 2) Tabela de planejamento de publicação (calendário editorial futuro)
CREATE TABLE IF NOT EXISTS public.publication_schedule_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  publication_unit TEXT NOT NULL,         -- ex: carousel, story_sequence, whatsapp_status, reel, feed_post, banner, other
  channel TEXT,                            -- ex: instagram_feed, instagram_story, whatsapp, etc
  title TEXT,
  suggested_date DATE,
  suggested_time TEXT,
  confirmed_date DATE,
  confirmed_time TEXT,
  schedule_status TEXT NOT NULL DEFAULT 'sem_data',
    -- valores: sem_data | sugerido | aguardando_aprovacao | aprovado | agendado | publicado | cancelado
  client_notes TEXT,
  approval_status TEXT,                    -- aprovado | aprovado_com_alteracoes | nova_versao | nao_aprovado
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_schedule_items TO authenticated;
GRANT ALL ON public.publication_schedule_items TO service_role;

ALTER TABLE public.publication_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own schedule items"
  ON public.publication_schedule_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_psi_user ON public.publication_schedule_items(user_id);
CREATE INDEX IF NOT EXISTS idx_psi_project ON public.publication_schedule_items(project_id);
CREATE INDEX IF NOT EXISTS idx_psi_brand ON public.publication_schedule_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_psi_status ON public.publication_schedule_items(schedule_status);

CREATE TRIGGER set_updated_at_publication_schedule_items
  BEFORE UPDATE ON public.publication_schedule_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
