
CREATE TABLE public.content_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  theme TEXT,
  content_pillar TEXT,
  objective TEXT,
  recommended_format TEXT,
  angle TEXT,
  target_audience TEXT,
  audience_problem TEXT,
  central_message TEXT,
  hook TEXT,
  suggested_cta TEXT,
  required_information TEXT[] NOT NULL DEFAULT '{}',
  visual_direction TEXT,
  reason_to_publish TEXT,
  source_elements TEXT[] NOT NULL DEFAULT '{}',
  novelty_score INTEGER NOT NULL DEFAULT 0,
  novelty_badge TEXT,
  template_key TEXT,
  status TEXT NOT NULL DEFAULT 'nova',
  source_type TEXT NOT NULL DEFAULT 'lab',
  converted_project_id UUID REFERENCES public.content_projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_ideas TO authenticated;
GRANT ALL ON public.content_ideas TO service_role;

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ideas"
  ON public.content_ideas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_content_ideas_updated_at
  BEFORE UPDATE ON public.content_ideas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX content_ideas_user_brand_idx ON public.content_ideas(user_id, brand_id);
CREATE INDEX content_ideas_status_idx ON public.content_ideas(user_id, status);
