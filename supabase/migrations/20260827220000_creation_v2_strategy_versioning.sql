-- Foundation V2: Strategy Versioning + Brand Snapshot.
-- Scope:
--   * immutable strategy content versions linked to a Creation
--   * mutable strategy workflow state with current/current-approved pointers
--   * frozen Brand Snapshot associated 1:1 with a Strategy Version
-- No V1 content is migrated or rewritten by this migration.

CREATE TABLE IF NOT EXISTS public.creation_strategy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  objective TEXT,
  approach TEXT,
  format TEXT,
  concept TEXT,
  audience TEXT,
  strategy_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creation_strategy_versions_project_version_unique UNIQUE (project_id, version_number),
  CONSTRAINT creation_strategy_versions_project_id_id_unique UNIQUE (project_id, id),
  CONSTRAINT creation_strategy_versions_version_positive CHECK (version_number >= 1),
  CONSTRAINT creation_strategy_versions_schema_not_blank CHECK (length(btrim(schema_version)) > 0),
  CONSTRAINT creation_strategy_versions_payload_object CHECK (jsonb_typeof(strategy_payload) = 'object'),
  CONSTRAINT creation_strategy_versions_provenance_object CHECK (jsonb_typeof(provenance) = 'object'),
  CONSTRAINT creation_strategy_versions_status_valid CHECK (
    approval_status IN ('draft', 'in_review', 'approved', 'rejected', 'superseded')
  ),
  CONSTRAINT creation_strategy_versions_approved_at_consistent CHECK (
    (approval_status IN ('approved', 'superseded') AND approved_at IS NOT NULL)
    OR
    (approval_status IN ('draft', 'in_review', 'rejected') AND approved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS creation_strategy_versions_project_idx
  ON public.creation_strategy_versions(project_id, version_number DESC);

CREATE INDEX IF NOT EXISTS creation_strategy_versions_approval_idx
  ON public.creation_strategy_versions(project_id, approval_status);

CREATE OR REPLACE FUNCTION public.guard_creation_strategy_version_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Canonical strategy content is immutable once the version is created.
  -- Only workflow metadata may change.
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
    OR NEW.objective IS DISTINCT FROM OLD.objective
    OR NEW.approach IS DISTINCT FROM OLD.approach
    OR NEW.format IS DISTINCT FROM OLD.format
    OR NEW.concept IS DISTINCT FROM OLD.concept
    OR NEW.audience IS DISTINCT FROM OLD.audience
    OR NEW.strategy_payload IS DISTINCT FROM OLD.strategy_payload
    OR NEW.provenance IS DISTINCT FROM OLD.provenance
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Strategy version content is immutable. Create a new version instead.';
  END IF;

  IF OLD.approval_status = 'approved'
    AND NEW.approval_status NOT IN ('approved', 'superseded')
  THEN
    RAISE EXCEPTION 'An approved strategy version can only remain approved or become superseded.';
  END IF;

  IF OLD.approval_status = 'superseded'
    AND NEW.approval_status <> 'superseded'
  THEN
    RAISE EXCEPTION 'A superseded strategy version cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_strategy_versions_guard_update
  ON public.creation_strategy_versions;
CREATE TRIGGER creation_strategy_versions_guard_update
BEFORE UPDATE ON public.creation_strategy_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_creation_strategy_version_update();

DROP TRIGGER IF EXISTS creation_strategy_versions_set_updated_at
  ON public.creation_strategy_versions;
CREATE TRIGGER creation_strategy_versions_set_updated_at
BEFORE UPDATE ON public.creation_strategy_versions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.creation_strategy_state (
  project_id UUID PRIMARY KEY REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  current_version_id UUID REFERENCES public.creation_strategy_versions(id) ON DELETE SET NULL,
  current_approved_version_id UUID REFERENCES public.creation_strategy_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creation_strategy_state_status_valid CHECK (
    status IN ('not_started', 'drafting', 'in_review', 'approved', 'needs_revision')
  )
);

CREATE OR REPLACE FUNCTION public.validate_creation_strategy_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  referenced_project_id UUID;
  approved_status TEXT;
BEGIN
  IF NEW.current_version_id IS NOT NULL THEN
    SELECT project_id
      INTO referenced_project_id
    FROM public.creation_strategy_versions
    WHERE id = NEW.current_version_id;

    IF referenced_project_id IS NULL OR referenced_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'current_version_id must belong to the same Creation.';
    END IF;
  END IF;

  IF NEW.current_approved_version_id IS NOT NULL THEN
    SELECT project_id, approval_status
      INTO referenced_project_id, approved_status
    FROM public.creation_strategy_versions
    WHERE id = NEW.current_approved_version_id;

    IF referenced_project_id IS NULL OR referenced_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'current_approved_version_id must belong to the same Creation.';
    END IF;

    IF approved_status <> 'approved' THEN
      RAISE EXCEPTION 'current_approved_version_id must reference an approved Strategy Version.';
    END IF;
  END IF;

  IF NEW.status = 'approved' AND NEW.current_approved_version_id IS NULL THEN
    RAISE EXCEPTION 'Approved strategy state requires current_approved_version_id.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_strategy_state_validate
  ON public.creation_strategy_state;
CREATE TRIGGER creation_strategy_state_validate
BEFORE INSERT OR UPDATE ON public.creation_strategy_state
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_strategy_state();

DROP TRIGGER IF EXISTS creation_strategy_state_set_updated_at
  ON public.creation_strategy_state;
CREATE TRIGGER creation_strategy_state_set_updated_at
BEFORE UPDATE ON public.creation_strategy_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.creation_brand_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  strategy_version_id UUID NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  brand_updated_at TIMESTAMPTZ,
  snapshot_schema_version TEXT NOT NULL DEFAULT '1.0',
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creation_brand_snapshots_strategy_unique UNIQUE (strategy_version_id),
  CONSTRAINT creation_brand_snapshots_schema_not_blank CHECK (
    length(btrim(snapshot_schema_version)) > 0
  ),
  CONSTRAINT creation_brand_snapshots_json_object CHECK (
    jsonb_typeof(snapshot_json) = 'object'
  ),
  CONSTRAINT creation_brand_snapshots_strategy_project_fkey
    FOREIGN KEY (project_id, strategy_version_id)
    REFERENCES public.creation_strategy_versions(project_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS creation_brand_snapshots_project_idx
  ON public.creation_brand_snapshots(project_id);


-- Row Level Security ---------------------------------------------------------

ALTER TABLE public.creation_strategy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_strategy_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_brand_snapshots ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.creation_strategy_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.creation_strategy_state TO authenticated;
GRANT SELECT, INSERT ON public.creation_brand_snapshots TO authenticated;

GRANT ALL ON public.creation_strategy_versions TO service_role;
GRANT ALL ON public.creation_strategy_state TO service_role;
GRANT ALL ON public.creation_brand_snapshots TO service_role;

DROP POLICY IF EXISTS "creation_strategy_versions_select_own"
  ON public.creation_strategy_versions;
CREATE POLICY "creation_strategy_versions_select_own"
ON public.creation_strategy_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_strategy_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_strategy_versions_insert_own"
  ON public.creation_strategy_versions;
CREATE POLICY "creation_strategy_versions_insert_own"
ON public.creation_strategy_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_strategy_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_strategy_versions_update_own"
  ON public.creation_strategy_versions;
CREATE POLICY "creation_strategy_versions_update_own"
ON public.creation_strategy_versions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_strategy_versions.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_strategy_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_strategy_state_select_own"
  ON public.creation_strategy_state;
CREATE POLICY "creation_strategy_state_select_own"
ON public.creation_strategy_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_strategy_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_strategy_state_insert_own"
  ON public.creation_strategy_state;
CREATE POLICY "creation_strategy_state_insert_own"
ON public.creation_strategy_state
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_strategy_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_strategy_state_update_own"
  ON public.creation_strategy_state;
CREATE POLICY "creation_strategy_state_update_own"
ON public.creation_strategy_state
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_strategy_state.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_strategy_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_brand_snapshots_select_own"
  ON public.creation_brand_snapshots;
CREATE POLICY "creation_brand_snapshots_select_own"
ON public.creation_brand_snapshots
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_brand_snapshots.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_brand_snapshots_insert_own"
  ON public.creation_brand_snapshots;
CREATE POLICY "creation_brand_snapshots_insert_own"
ON public.creation_brand_snapshots
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_brand_snapshots.project_id
      AND cp.user_id = auth.uid()
  )
);
