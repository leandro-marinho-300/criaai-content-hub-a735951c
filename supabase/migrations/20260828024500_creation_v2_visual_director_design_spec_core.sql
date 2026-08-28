-- Creation V2: Visual Director + canonical Design Spec core.
-- Scope:
--   * immutable Design Versions tied to the exact approved Copy Version
--   * version lineage for future Design revisions
--   * current/current-approved Design pointers
--   * Design freshness derived from source copy_version_id (no duplicated stale flag)
--   * no Render Prompt, image generation or Post UI integration yet
-- No V1 content is migrated or rewritten by this migration.


-- Canonical Design Spec payload validation -----------------------------------

CREATE OR REPLACE FUNCTION public.is_valid_creation_design_payload(
  p_payload JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    jsonb_typeof(p_payload) = 'object'

    AND p_payload ? 'visual_system'
    AND jsonb_typeof(p_payload -> 'visual_system') = 'string'
    AND length(btrim(p_payload ->> 'visual_system')) > 0

    AND p_payload ? 'composition_concept'
    AND jsonb_typeof(p_payload -> 'composition_concept') = 'string'
    AND length(btrim(p_payload ->> 'composition_concept')) > 0

    AND p_payload ? 'visual_gesture'
    AND jsonb_typeof(p_payload -> 'visual_gesture') = 'string'
    AND length(btrim(p_payload ->> 'visual_gesture')) > 0

    AND p_payload ? 'typography_behavior'
    AND jsonb_typeof(p_payload -> 'typography_behavior') = 'string'
    AND length(btrim(p_payload ->> 'typography_behavior')) > 0

    AND p_payload ? 'imagery_mode'
    AND jsonb_typeof(p_payload -> 'imagery_mode') = 'string'
    AND length(btrim(p_payload ->> 'imagery_mode')) > 0

    AND p_payload ? 'intervention_level'
    AND jsonb_typeof(p_payload -> 'intervention_level') = 'string'
    AND length(btrim(p_payload ->> 'intervention_level')) > 0

    AND p_payload ? 'palette'
    AND jsonb_typeof(p_payload -> 'palette') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload -> 'palette') AS item
      WHERE jsonb_typeof(item) <> 'string'
        OR length(btrim(item #>> '{}')) = 0
    )

    AND p_payload ? 'asset_requirements'
    AND jsonb_typeof(p_payload -> 'asset_requirements') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload -> 'asset_requirements') AS item
      WHERE jsonb_typeof(item) <> 'object'
        OR NOT (item ? 'role')
        OR jsonb_typeof(item -> 'role') <> 'string'
        OR length(btrim(item ->> 'role')) = 0
        OR NOT (item ? 'requirement')
        OR jsonb_typeof(item -> 'requirement') <> 'string'
        OR length(btrim(item ->> 'requirement')) = 0
        OR NOT (item ? 'mandatory')
        OR jsonb_typeof(item -> 'mandatory') <> 'boolean'
        OR NOT (item ? 'source_preference')
        OR (
          jsonb_typeof(item -> 'source_preference') <> 'null'
          AND (
            jsonb_typeof(item -> 'source_preference') <> 'string'
            OR length(btrim(item ->> 'source_preference')) = 0
          )
        )
    )

    AND p_payload ? 'anti_genericity'
    AND jsonb_typeof(p_payload -> 'anti_genericity') = 'object'
    AND (p_payload -> 'anti_genericity') ? 'distinctive_choice'
    AND jsonb_typeof(p_payload -> 'anti_genericity' -> 'distinctive_choice') = 'string'
    AND length(btrim(p_payload -> 'anti_genericity' ->> 'distinctive_choice')) > 0
    AND (p_payload -> 'anti_genericity') ? 'avoid'
    AND jsonb_typeof(p_payload -> 'anti_genericity' -> 'avoid') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload -> 'anti_genericity' -> 'avoid') AS item
      WHERE jsonb_typeof(item) <> 'string'
        OR length(btrim(item #>> '{}')) = 0
    )

    AND p_payload ? 'restrictions'
    AND jsonb_typeof(p_payload -> 'restrictions') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload -> 'restrictions') AS item
      WHERE jsonb_typeof(item) <> 'string'
        OR length(btrim(item #>> '{}')) = 0
    )

    AND p_payload ? 'dependencies'
    AND jsonb_typeof(p_payload -> 'dependencies') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload -> 'dependencies') AS item
      WHERE jsonb_typeof(item) <> 'string'
        OR length(btrim(item #>> '{}')) = 0
    )

    AND p_payload ? 'information_to_confirm'
    AND jsonb_typeof(p_payload -> 'information_to_confirm') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload -> 'information_to_confirm') AS item
      WHERE jsonb_typeof(item) <> 'string'
        OR length(btrim(item #>> '{}')) = 0
    );
$$;


-- Immutable Design Versions --------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creation_design_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  copy_version_id UUID NOT NULL,
  based_on_version_id UUID,
  version_number INTEGER NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  design_payload JSONB NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT creation_design_versions_project_version_unique
    UNIQUE (project_id, version_number),
  CONSTRAINT creation_design_versions_project_id_id_unique
    UNIQUE (project_id, id),
  CONSTRAINT creation_design_versions_version_positive
    CHECK (version_number >= 1),
  CONSTRAINT creation_design_versions_schema_not_blank
    CHECK (length(btrim(schema_version)) > 0),
  CONSTRAINT creation_design_versions_payload_valid
    CHECK (public.is_valid_creation_design_payload(design_payload)),
  CONSTRAINT creation_design_versions_provenance_object
    CHECK (jsonb_typeof(provenance) = 'object'),
  CONSTRAINT creation_design_versions_status_valid
    CHECK (
      approval_status IN ('draft', 'in_review', 'approved', 'rejected', 'superseded')
    ),
  CONSTRAINT creation_design_versions_approved_at_consistent
    CHECK (
      (approval_status IN ('approved', 'superseded') AND approved_at IS NOT NULL)
      OR
      (approval_status IN ('draft', 'in_review', 'rejected') AND approved_at IS NULL)
    ),
  CONSTRAINT creation_design_versions_copy_project_fkey
    FOREIGN KEY (project_id, copy_version_id)
    REFERENCES public.creation_copy_versions(project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT creation_design_versions_lineage_project_fkey
    FOREIGN KEY (project_id, based_on_version_id)
    REFERENCES public.creation_design_versions(project_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS creation_design_versions_project_idx
  ON public.creation_design_versions(project_id, version_number DESC);

CREATE INDEX IF NOT EXISTS creation_design_versions_copy_idx
  ON public.creation_design_versions(project_id, copy_version_id);

CREATE UNIQUE INDEX IF NOT EXISTS creation_design_versions_one_approved_per_project_idx
  ON public.creation_design_versions(project_id)
  WHERE approval_status = 'approved';


CREATE OR REPLACE FUNCTION public.validate_creation_design_version_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  copy_status TEXT;
  current_approved_copy_version_id UUID;
  source_project_id UUID;
  source_copy_version_id UUID;
  source_status TEXT;
BEGIN
  SELECT ccv.approval_status
    INTO copy_status
  FROM public.creation_copy_versions AS ccv
  WHERE ccv.id = NEW.copy_version_id
    AND ccv.project_id = NEW.project_id;

  SELECT ccs.current_approved_version_id
    INTO current_approved_copy_version_id
  FROM public.creation_copy_state AS ccs
  WHERE ccs.project_id = NEW.project_id;

  IF copy_status IS DISTINCT FROM 'approved'
    OR current_approved_copy_version_id IS NULL
    OR current_approved_copy_version_id <> NEW.copy_version_id
  THEN
    RAISE EXCEPTION 'Design Version requires the current approved Copy Version.';
  END IF;

  IF NEW.based_on_version_id IS NOT NULL THEN
    SELECT cdv.project_id, cdv.copy_version_id, cdv.approval_status
      INTO source_project_id, source_copy_version_id, source_status
    FROM public.creation_design_versions AS cdv
    WHERE cdv.id = NEW.based_on_version_id;

    IF source_project_id IS NULL OR source_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'Design revision source must belong to the same Creation.';
    END IF;

    IF source_copy_version_id <> NEW.copy_version_id THEN
      RAISE EXCEPTION 'Design revisions must preserve the same source Copy Version. A changed Copy starts a new Design lineage.';
    END IF;

    IF source_status NOT IN ('approved', 'superseded') THEN
      RAISE EXCEPTION 'Design revision source must be an approved or previously approved Design Version.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_design_versions_validate_insert
  ON public.creation_design_versions;
CREATE TRIGGER creation_design_versions_validate_insert
BEFORE INSERT ON public.creation_design_versions
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_design_version_insert();


CREATE OR REPLACE FUNCTION public.guard_creation_design_version_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Canonical Design content and lineage are immutable once created.
  -- Approval metadata is the only mutable part of a Design Version.
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.copy_version_id IS DISTINCT FROM OLD.copy_version_id
    OR NEW.based_on_version_id IS DISTINCT FROM OLD.based_on_version_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
    OR NEW.design_payload IS DISTINCT FROM OLD.design_payload
    OR NEW.provenance IS DISTINCT FROM OLD.provenance
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Design version content is immutable. Create a new version instead.';
  END IF;

  IF OLD.approval_status = 'approved'
    AND NEW.approval_status NOT IN ('approved', 'superseded')
  THEN
    RAISE EXCEPTION 'An approved Design Version can only remain approved or become superseded.';
  END IF;

  IF OLD.approval_status = 'superseded'
    AND NEW.approval_status <> 'superseded'
  THEN
    RAISE EXCEPTION 'A superseded Design Version cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_design_versions_guard_update
  ON public.creation_design_versions;
CREATE TRIGGER creation_design_versions_guard_update
BEFORE UPDATE ON public.creation_design_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_creation_design_version_update();

DROP TRIGGER IF EXISTS creation_design_versions_set_updated_at
  ON public.creation_design_versions;
CREATE TRIGGER creation_design_versions_set_updated_at
BEFORE UPDATE ON public.creation_design_versions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Canonical Design state -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creation_design_state (
  project_id UUID PRIMARY KEY REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  current_version_id UUID REFERENCES public.creation_design_versions(id) ON DELETE SET NULL,
  current_approved_version_id UUID REFERENCES public.creation_design_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT creation_design_state_status_valid
    CHECK (
      status IN ('not_started', 'drafting', 'in_review', 'approved', 'needs_revision')
    )
);

CREATE OR REPLACE FUNCTION public.validate_creation_design_state()
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
    FROM public.creation_design_versions
    WHERE id = NEW.current_version_id;

    IF referenced_project_id IS NULL OR referenced_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'current_version_id must belong to the same Creation.';
    END IF;
  END IF;

  IF NEW.current_approved_version_id IS NOT NULL THEN
    SELECT project_id, approval_status
      INTO referenced_project_id, approved_status
    FROM public.creation_design_versions
    WHERE id = NEW.current_approved_version_id;

    IF referenced_project_id IS NULL OR referenced_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'current_approved_version_id must belong to the same Creation.';
    END IF;

    IF approved_status <> 'approved' THEN
      RAISE EXCEPTION 'current_approved_version_id must reference an approved Design Version.';
    END IF;
  END IF;

  IF NEW.status = 'approved' AND NEW.current_approved_version_id IS NULL THEN
    RAISE EXCEPTION 'Approved Design state requires current_approved_version_id.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_design_state_validate
  ON public.creation_design_state;
CREATE TRIGGER creation_design_state_validate
BEFORE INSERT OR UPDATE ON public.creation_design_state
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_design_state();

DROP TRIGGER IF EXISTS creation_design_state_set_updated_at
  ON public.creation_design_state;
CREATE TRIGGER creation_design_state_set_updated_at
BEFORE UPDATE ON public.creation_design_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Row Level Security ---------------------------------------------------------

ALTER TABLE public.creation_design_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_design_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.creation_design_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.creation_design_state TO authenticated;

GRANT ALL ON public.creation_design_versions TO service_role;
GRANT ALL ON public.creation_design_state TO service_role;

DROP POLICY IF EXISTS "creation_design_versions_select_own"
  ON public.creation_design_versions;
CREATE POLICY "creation_design_versions_select_own"
ON public.creation_design_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_design_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_design_versions_insert_own"
  ON public.creation_design_versions;
CREATE POLICY "creation_design_versions_insert_own"
ON public.creation_design_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_design_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_design_versions_update_own"
  ON public.creation_design_versions;
CREATE POLICY "creation_design_versions_update_own"
ON public.creation_design_versions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_design_versions.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_design_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_design_state_select_own"
  ON public.creation_design_state;
CREATE POLICY "creation_design_state_select_own"
ON public.creation_design_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_design_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_design_state_insert_own"
  ON public.creation_design_state;
CREATE POLICY "creation_design_state_insert_own"
ON public.creation_design_state
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_design_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_design_state_update_own"
  ON public.creation_design_state;
CREATE POLICY "creation_design_state_update_own"
ON public.creation_design_state
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_design_state.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_design_state.project_id
      AND cp.user_id = auth.uid()
  )
);
