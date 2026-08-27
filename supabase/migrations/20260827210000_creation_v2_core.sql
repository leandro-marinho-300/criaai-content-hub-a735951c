-- Foundation V2: canonical Creation aggregate anchor.
-- content_projects remains the operational envelope and the Creation ID.
-- A row in creation_core identifies a project as participating in the V2 architecture.

CREATE TABLE IF NOT EXISTS public.creation_core (
  project_id UUID PRIMARY KEY REFERENCES public.content_projects(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL DEFAULT '2.0',
  aggregate_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creation_core_schema_version_not_blank CHECK (length(btrim(schema_version)) > 0),
  CONSTRAINT creation_core_aggregate_version_positive CHECK (aggregate_version >= 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creation_core TO authenticated;
GRANT ALL ON public.creation_core TO service_role;

ALTER TABLE public.creation_core ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creation_core_all_own" ON public.creation_core;
CREATE POLICY "creation_core_all_own"
ON public.creation_core
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_core.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_core.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP TRIGGER IF EXISTS creation_core_set_updated_at ON public.creation_core;
CREATE TRIGGER creation_core_set_updated_at
BEFORE UPDATE ON public.creation_core
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
