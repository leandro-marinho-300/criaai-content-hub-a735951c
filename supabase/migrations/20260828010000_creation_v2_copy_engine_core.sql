-- Creation V2: canonical Copy Engine core.
-- Scope:
--   * immutable Copy Versions tied to one approved Strategy + frozen Brand Snapshot
--   * version lineage for revisions (approved copy edits create a new version)
--   * current/current-approved Copy pointers
--   * atomic Copy approval
--   * no Post/Reel-specific copy fields yet; adapters use format_extension later
-- No V1 content is migrated or rewritten by this migration.


-- Canonical payload validation ------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_valid_creation_copy_core_payload(
  p_payload JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    jsonb_typeof(p_payload) = 'object'
    AND p_payload ? 'primary_message'
    AND jsonb_typeof(p_payload -> 'primary_message') = 'string'
    AND length(btrim(p_payload ->> 'primary_message')) > 0
    AND p_payload ? 'supporting_points'
    AND jsonb_typeof(p_payload -> 'supporting_points') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_payload -> 'supporting_points') AS item
      WHERE jsonb_typeof(item) <> 'string'
        OR length(btrim(item #>> '{}')) = 0
    )
    AND p_payload ? 'cta'
    AND (
      jsonb_typeof(p_payload -> 'cta') = 'null'
      OR (
        jsonb_typeof(p_payload -> 'cta') = 'object'
        AND (p_payload -> 'cta') ? 'intent'
        AND (p_payload -> 'cta') ? 'wording'
        AND (
          jsonb_typeof(p_payload -> 'cta' -> 'intent') = 'null'
          OR (
            jsonb_typeof(p_payload -> 'cta' -> 'intent') = 'string'
            AND length(btrim(p_payload -> 'cta' ->> 'intent')) > 0
          )
        )
        AND (
          jsonb_typeof(p_payload -> 'cta' -> 'wording') = 'null'
          OR (
            jsonb_typeof(p_payload -> 'cta' -> 'wording') = 'string'
            AND length(btrim(p_payload -> 'cta' ->> 'wording')) > 0
          )
        )
      )
    );
$$;


-- Immutable Copy Versions -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creation_copy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  strategy_version_id UUID NOT NULL,
  brand_snapshot_id UUID NOT NULL REFERENCES public.creation_brand_snapshots(id) ON DELETE RESTRICT,
  based_on_version_id UUID,
  version_number INTEGER NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  core_payload JSONB NOT NULL,
  format_extension JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creation_copy_versions_project_version_unique UNIQUE (project_id, version_number),
  CONSTRAINT creation_copy_versions_project_id_id_unique UNIQUE (project_id, id),
  CONSTRAINT creation_copy_versions_version_positive CHECK (version_number >= 1),
  CONSTRAINT creation_copy_versions_schema_not_blank CHECK (length(btrim(schema_version)) > 0),
  CONSTRAINT creation_copy_versions_core_valid CHECK (
    public.is_valid_creation_copy_core_payload(core_payload)
  ),
  CONSTRAINT creation_copy_versions_format_object CHECK (
    jsonb_typeof(format_extension) = 'object'
  ),
  CONSTRAINT creation_copy_versions_provenance_object CHECK (
    jsonb_typeof(provenance) = 'object'
  ),
  CONSTRAINT creation_copy_versions_status_valid CHECK (
    approval_status IN ('draft', 'in_review', 'approved', 'rejected', 'superseded')
  ),
  CONSTRAINT creation_copy_versions_approved_at_consistent CHECK (
    (approval_status IN ('approved', 'superseded') AND approved_at IS NOT NULL)
    OR
    (approval_status IN ('draft', 'in_review', 'rejected') AND approved_at IS NULL)
  ),
  CONSTRAINT creation_copy_versions_strategy_project_fkey
    FOREIGN KEY (project_id, strategy_version_id)
    REFERENCES public.creation_strategy_versions(project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT creation_copy_versions_lineage_project_fkey
    FOREIGN KEY (project_id, based_on_version_id)
    REFERENCES public.creation_copy_versions(project_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS creation_copy_versions_project_idx
  ON public.creation_copy_versions(project_id, version_number DESC);

CREATE INDEX IF NOT EXISTS creation_copy_versions_strategy_idx
  ON public.creation_copy_versions(project_id, strategy_version_id);

CREATE UNIQUE INDEX IF NOT EXISTS creation_copy_versions_one_approved_per_project_idx
  ON public.creation_copy_versions(project_id)
  WHERE approval_status = 'approved';


CREATE OR REPLACE FUNCTION public.validate_creation_copy_version_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  strategy_status TEXT;
  snapshot_project_id UUID;
  snapshot_strategy_version_id UUID;
  source_project_id UUID;
  source_status TEXT;
BEGIN
  SELECT csv.approval_status
    INTO strategy_status
  FROM public.creation_strategy_versions AS csv
  WHERE csv.id = NEW.strategy_version_id
    AND csv.project_id = NEW.project_id;

  IF strategy_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Copy Version requires an approved Strategy Version.';
  END IF;

  SELECT cbs.project_id, cbs.strategy_version_id
    INTO snapshot_project_id, snapshot_strategy_version_id
  FROM public.creation_brand_snapshots AS cbs
  WHERE cbs.id = NEW.brand_snapshot_id;

  IF snapshot_project_id IS NULL
    OR snapshot_project_id <> NEW.project_id
    OR snapshot_strategy_version_id <> NEW.strategy_version_id
  THEN
    RAISE EXCEPTION 'Copy Version Brand Snapshot must belong to the same Creation and Strategy Version.';
  END IF;

  IF NEW.based_on_version_id IS NOT NULL THEN
    SELECT ccv.project_id, ccv.approval_status
      INTO source_project_id, source_status
    FROM public.creation_copy_versions AS ccv
    WHERE ccv.id = NEW.based_on_version_id;

    IF source_project_id IS NULL OR source_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'Copy revision source must belong to the same Creation.';
    END IF;

    IF source_status NOT IN ('approved', 'superseded') THEN
      RAISE EXCEPTION 'Copy revision source must be an approved or previously approved version.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_copy_versions_validate_insert
  ON public.creation_copy_versions;
CREATE TRIGGER creation_copy_versions_validate_insert
BEFORE INSERT ON public.creation_copy_versions
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_copy_version_insert();


CREATE OR REPLACE FUNCTION public.guard_creation_copy_version_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Canonical Copy content and lineage are immutable once created.
  -- Only approval workflow metadata may change.
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.strategy_version_id IS DISTINCT FROM OLD.strategy_version_id
    OR NEW.brand_snapshot_id IS DISTINCT FROM OLD.brand_snapshot_id
    OR NEW.based_on_version_id IS DISTINCT FROM OLD.based_on_version_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
    OR NEW.core_payload IS DISTINCT FROM OLD.core_payload
    OR NEW.format_extension IS DISTINCT FROM OLD.format_extension
    OR NEW.provenance IS DISTINCT FROM OLD.provenance
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Copy version content is immutable. Create a new version instead.';
  END IF;

  IF OLD.approval_status = 'approved'
    AND NEW.approval_status NOT IN ('approved', 'superseded')
  THEN
    RAISE EXCEPTION 'An approved Copy Version can only remain approved or become superseded.';
  END IF;

  IF OLD.approval_status = 'superseded'
    AND NEW.approval_status <> 'superseded'
  THEN
    RAISE EXCEPTION 'A superseded Copy Version cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_copy_versions_guard_update
  ON public.creation_copy_versions;
CREATE TRIGGER creation_copy_versions_guard_update
BEFORE UPDATE ON public.creation_copy_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_creation_copy_version_update();

DROP TRIGGER IF EXISTS creation_copy_versions_set_updated_at
  ON public.creation_copy_versions;
CREATE TRIGGER creation_copy_versions_set_updated_at
BEFORE UPDATE ON public.creation_copy_versions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Canonical Copy state --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creation_copy_state (
  project_id UUID PRIMARY KEY REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  current_version_id UUID REFERENCES public.creation_copy_versions(id) ON DELETE SET NULL,
  current_approved_version_id UUID REFERENCES public.creation_copy_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creation_copy_state_status_valid CHECK (
    status IN ('not_started', 'drafting', 'in_review', 'approved', 'needs_revision')
  )
);

CREATE OR REPLACE FUNCTION public.validate_creation_copy_state()
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
    FROM public.creation_copy_versions
    WHERE id = NEW.current_version_id;

    IF referenced_project_id IS NULL OR referenced_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'current_version_id must belong to the same Creation.';
    END IF;
  END IF;

  IF NEW.current_approved_version_id IS NOT NULL THEN
    SELECT project_id, approval_status
      INTO referenced_project_id, approved_status
    FROM public.creation_copy_versions
    WHERE id = NEW.current_approved_version_id;

    IF referenced_project_id IS NULL OR referenced_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'current_approved_version_id must belong to the same Creation.';
    END IF;

    IF approved_status <> 'approved' THEN
      RAISE EXCEPTION 'current_approved_version_id must reference an approved Copy Version.';
    END IF;
  END IF;

  IF NEW.status = 'approved' AND NEW.current_approved_version_id IS NULL THEN
    RAISE EXCEPTION 'Approved Copy state requires current_approved_version_id.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_copy_state_validate
  ON public.creation_copy_state;
CREATE TRIGGER creation_copy_state_validate
BEFORE INSERT OR UPDATE ON public.creation_copy_state
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_copy_state();

DROP TRIGGER IF EXISTS creation_copy_state_set_updated_at
  ON public.creation_copy_state;
CREATE TRIGGER creation_copy_state_set_updated_at
BEFORE UPDATE ON public.creation_copy_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Atomic Copy approval --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_creation_copy(
  p_project_id UUID,
  p_copy_version_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_copy_version_id UUID;
  previous_approved_version_id UUID;
  current_strategy_version_id UUID;
  target_project_id UUID;
  target_strategy_version_id UUID;
  target_brand_snapshot_id UUID;
  target_status TEXT;
  target_approved_at TIMESTAMPTZ;
  snapshot_strategy_version_id UUID;
BEGIN
  IF p_project_id IS NULL OR p_copy_version_id IS NULL THEN
    RAISE EXCEPTION 'project_id and copy_version_id are required.';
  END IF;

  -- Ownership + V2 anchor.
  PERFORM 1
  FROM public.content_projects AS cp
  JOIN public.creation_core AS cc ON cc.project_id = cp.id
  WHERE cp.id = p_project_id
    AND cp.user_id = auth.uid()
  FOR UPDATE OF cp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creation not found, not V2, or not accessible.';
  END IF;

  SELECT css.current_approved_version_id
    INTO current_strategy_version_id
  FROM public.creation_strategy_state AS css
  WHERE css.project_id = p_project_id
  FOR SHARE;

  IF current_strategy_version_id IS NULL THEN
    RAISE EXCEPTION 'Copy approval requires a current approved Strategy Version.';
  END IF;

  SELECT ccs.current_version_id, ccs.current_approved_version_id
    INTO current_copy_version_id, previous_approved_version_id
  FROM public.creation_copy_state AS ccs
  WHERE ccs.project_id = p_project_id
  FOR UPDATE;

  IF FOUND
    AND current_copy_version_id IS NOT NULL
    AND current_copy_version_id <> p_copy_version_id
  THEN
    RAISE EXCEPTION 'Only the current Copy Version can be approved.';
  END IF;

  SELECT
    ccv.project_id,
    ccv.strategy_version_id,
    ccv.brand_snapshot_id,
    ccv.approval_status,
    ccv.approved_at
  INTO
    target_project_id,
    target_strategy_version_id,
    target_brand_snapshot_id,
    target_status,
    target_approved_at
  FROM public.creation_copy_versions AS ccv
  WHERE ccv.id = p_copy_version_id
  FOR UPDATE;

  IF NOT FOUND OR target_project_id <> p_project_id THEN
    RAISE EXCEPTION 'Copy Version does not belong to this Creation.';
  END IF;

  IF target_strategy_version_id <> current_strategy_version_id THEN
    RAISE EXCEPTION 'Copy Version is based on a Strategy Version that is no longer current and approved.';
  END IF;

  SELECT cbs.strategy_version_id
    INTO snapshot_strategy_version_id
  FROM public.creation_brand_snapshots AS cbs
  WHERE cbs.id = target_brand_snapshot_id
    AND cbs.project_id = p_project_id;

  IF snapshot_strategy_version_id IS NULL
    OR snapshot_strategy_version_id <> target_strategy_version_id
  THEN
    RAISE EXCEPTION 'Copy Version Brand Snapshot is inconsistent with its Strategy Version.';
  END IF;

  IF target_status IN ('rejected', 'superseded') THEN
    RAISE EXCEPTION 'Rejected or superseded Copy Versions cannot be approved. Create a new version instead.';
  END IF;

  IF target_status NOT IN ('draft', 'in_review', 'approved') THEN
    RAISE EXCEPTION 'Copy Version is not in an approvable state.';
  END IF;

  UPDATE public.creation_copy_versions
  SET approval_status = 'superseded'
  WHERE project_id = p_project_id
    AND id <> p_copy_version_id
    AND approval_status = 'approved';

  IF target_status <> 'approved' THEN
    target_approved_at := now();

    UPDATE public.creation_copy_versions
    SET
      approval_status = 'approved',
      approved_at = target_approved_at
    WHERE id = p_copy_version_id;
  END IF;

  INSERT INTO public.creation_copy_state (
    project_id,
    current_version_id,
    current_approved_version_id,
    status
  )
  VALUES (
    p_project_id,
    p_copy_version_id,
    p_copy_version_id,
    'approved'
  )
  ON CONFLICT (project_id) DO UPDATE
  SET
    current_version_id = EXCLUDED.current_version_id,
    current_approved_version_id = EXCLUDED.current_approved_version_id,
    status = EXCLUDED.status;

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'copy_version_id', p_copy_version_id,
    'previous_approved_version_id', previous_approved_version_id,
    'strategy_version_id', target_strategy_version_id,
    'brand_snapshot_id', target_brand_snapshot_id,
    'approved_at', target_approved_at
  );
END;
$$;


-- Row Level Security ---------------------------------------------------------

ALTER TABLE public.creation_copy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_copy_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.creation_copy_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.creation_copy_state TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_creation_copy(UUID, UUID) TO authenticated;

GRANT ALL ON public.creation_copy_versions TO service_role;
GRANT ALL ON public.creation_copy_state TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_creation_copy(UUID, UUID) TO service_role;

DROP POLICY IF EXISTS "creation_copy_versions_select_own"
  ON public.creation_copy_versions;
CREATE POLICY "creation_copy_versions_select_own"
ON public.creation_copy_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_copy_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_copy_versions_insert_own"
  ON public.creation_copy_versions;
CREATE POLICY "creation_copy_versions_insert_own"
ON public.creation_copy_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_copy_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_copy_versions_update_own"
  ON public.creation_copy_versions;
CREATE POLICY "creation_copy_versions_update_own"
ON public.creation_copy_versions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_copy_versions.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_copy_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_copy_state_select_own"
  ON public.creation_copy_state;
CREATE POLICY "creation_copy_state_select_own"
ON public.creation_copy_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_copy_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_copy_state_insert_own"
  ON public.creation_copy_state;
CREATE POLICY "creation_copy_state_insert_own"
ON public.creation_copy_state
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_copy_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_copy_state_update_own"
  ON public.creation_copy_state;
CREATE POLICY "creation_copy_state_update_own"
ON public.creation_copy_state
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_copy_state.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_copy_state.project_id
      AND cp.user_id = auth.uid()
  )
);
