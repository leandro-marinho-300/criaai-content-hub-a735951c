
-- Extend publication_schedule_items
ALTER TABLE public.publication_schedule_items
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_url text,
  ADD COLUMN IF NOT EXISTS publication_notes text,
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb;

-- publication_schedule_outputs
CREATE TABLE IF NOT EXISTS public.publication_schedule_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_item_id uuid NOT NULL REFERENCES public.publication_schedule_items(id) ON DELETE CASCADE,
  output_id uuid NOT NULL REFERENCES public.content_outputs(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_schedule_outputs TO authenticated;
GRANT ALL ON public.publication_schedule_outputs TO service_role;
ALTER TABLE public.publication_schedule_outputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pso_all_own" ON public.publication_schedule_outputs;
CREATE POLICY "pso_all_own" ON public.publication_schedule_outputs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pso_item ON public.publication_schedule_outputs(schedule_item_id);
CREATE INDEX IF NOT EXISTS idx_pso_output ON public.publication_schedule_outputs(output_id);

-- publication_schedule_history
CREATE TABLE IF NOT EXISTS public.publication_schedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_item_id uuid NOT NULL REFERENCES public.publication_schedule_items(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  old_date date,
  old_time text,
  new_date date,
  new_time text,
  old_status text,
  new_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_schedule_history TO authenticated;
GRANT ALL ON public.publication_schedule_history TO service_role;
ALTER TABLE public.publication_schedule_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "psh_all_own" ON public.publication_schedule_history;
CREATE POLICY "psh_all_own" ON public.publication_schedule_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_psh_item ON public.publication_schedule_history(schedule_item_id);

-- brands publication_preferences
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS publication_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
