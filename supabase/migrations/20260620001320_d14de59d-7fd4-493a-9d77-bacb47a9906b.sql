
-- =====================================================
-- Portal de Aprovação do Cliente — Fase 1
-- =====================================================

-- 1) client_approvals: configuração de cada link de aprovação
CREATE TABLE public.client_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  brand_id uuid,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'enviado_para_aprovacao',
  title text NOT NULL,
  introduction_message text,
  include_caption boolean NOT NULL DEFAULT true,
  include_hashtags boolean NOT NULL DEFAULT true,
  include_schedule boolean NOT NULL DEFAULT false,
  allow_piece_approval boolean NOT NULL DEFAULT true,
  allow_piece_comments boolean NOT NULL DEFAULT true,
  allow_schedule_changes boolean NOT NULL DEFAULT false,
  allow_multiple_responses boolean NOT NULL DEFAULT false,
  password_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  client_name text,
  client_email text,
  client_role text,
  client_company text,
  decision text,
  general_comment text,
  schedule_decision text,
  requested_date date,
  requested_time text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_approvals_user ON public.client_approvals(user_id);
CREATE INDEX idx_client_approvals_project ON public.client_approvals(project_id);
CREATE INDEX idx_client_approvals_token ON public.client_approvals(token_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_approvals TO authenticated;
GRANT ALL ON public.client_approvals TO service_role;

ALTER TABLE public.client_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own approvals"
  ON public.client_approvals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_client_approvals_updated_at
  BEFORE UPDATE ON public.client_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) client_approval_items: decisão por peça
CREATE TABLE public.client_approval_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.client_approvals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  output_id uuid REFERENCES public.content_outputs(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  decision text NOT NULL DEFAULT 'pending',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_approval_items_approval ON public.client_approval_items(approval_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_approval_items TO authenticated;
GRANT ALL ON public.client_approval_items TO service_role;

ALTER TABLE public.client_approval_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own approval items"
  ON public.client_approval_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_client_approval_items_updated_at
  BEFORE UPDATE ON public.client_approval_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) client_approval_events: histórico
CREATE TABLE public.client_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.client_approvals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_approval_events_approval ON public.client_approval_events(approval_id);

GRANT SELECT, INSERT ON public.client_approval_events TO authenticated;
GRANT ALL ON public.client_approval_events TO service_role;

ALTER TABLE public.client_approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own approval events"
  ON public.client_approval_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own approval events"
  ON public.client_approval_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
