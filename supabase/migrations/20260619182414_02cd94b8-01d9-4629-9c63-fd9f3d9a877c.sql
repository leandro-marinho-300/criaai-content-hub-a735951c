
CREATE TABLE public.content_piece_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  output_id uuid NOT NULL REFERENCES public.content_outputs(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  image_width integer,
  image_height integer,
  display_order integer NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_piece_assets TO authenticated;
GRANT ALL ON public.content_piece_assets TO service_role;

ALTER TABLE public.content_piece_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_piece_assets_all_own" ON public.content_piece_assets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX content_piece_assets_project_id_idx ON public.content_piece_assets(project_id);
CREATE INDEX content_piece_assets_output_id_idx ON public.content_piece_assets(output_id);

CREATE TRIGGER content_piece_assets_set_updated_at
  BEFORE UPDATE ON public.content_piece_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Adiciona coluna opcional para título curto da campanha (usado no PDF para o cliente)
ALTER TABLE public.content_projects
  ADD COLUMN IF NOT EXISTS client_pdf_settings jsonb;
