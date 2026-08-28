-- Creation V2: atomic Design approval for the Render Prompt handoff.
-- Scope:
--   * approve only the current Design Version
--   * require the exact current approved Copy Version
--   * supersede any previous approved Design atomically
--   * keep current/current-approved Design pointers consistent
--   * no Render Prompt persistence and no image generation in this migration
-- No V1 content is migrated or rewritten.

CREATE OR REPLACE FUNCTION public.approve_creation_design(
  p_project_id UUID,
  p_design_version_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_design_version_id UUID;
  previous_approved_version_id UUID;
  current_approved_copy_version_id UUID;
  target_project_id UUID;
  target_copy_version_id UUID;
  target_status TEXT;
  target_approved_at TIMESTAMPTZ;
BEGIN
  IF p_project_id IS NULL OR p_design_version_id IS NULL THEN
    RAISE EXCEPTION 'project_id and design_version_id are required.';
  END IF;

  -- Ownership + V2 Creation anchor.
  PERFORM 1
  FROM public.content_projects AS cp
  JOIN public.creation_core AS cc ON cc.project_id = cp.id
  WHERE cp.id = p_project_id
    AND cp.user_id = auth.uid()
  FOR UPDATE OF cp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creation not found, not V2, or not accessible.';
  END IF;

  SELECT ccs.current_approved_version_id
    INTO current_approved_copy_version_id
  FROM public.creation_copy_state AS ccs
  WHERE ccs.project_id = p_project_id
  FOR SHARE;

  IF current_approved_copy_version_id IS NULL THEN
    RAISE EXCEPTION 'Design approval requires a current approved Copy Version.';
  END IF;

  SELECT cds.current_version_id, cds.current_approved_version_id
    INTO current_design_version_id, previous_approved_version_id
  FROM public.creation_design_state AS cds
  WHERE cds.project_id = p_project_id
  FOR UPDATE;

  IF FOUND
    AND current_design_version_id IS NOT NULL
    AND current_design_version_id <> p_design_version_id
  THEN
    RAISE EXCEPTION 'Only the current Design Version can be approved.';
  END IF;

  SELECT
    cdv.project_id,
    cdv.copy_version_id,
    cdv.approval_status,
    cdv.approved_at
  INTO
    target_project_id,
    target_copy_version_id,
    target_status,
    target_approved_at
  FROM public.creation_design_versions AS cdv
  WHERE cdv.id = p_design_version_id
  FOR UPDATE;

  IF NOT FOUND OR target_project_id <> p_project_id THEN
    RAISE EXCEPTION 'Design Version does not belong to this Creation.';
  END IF;

  IF target_copy_version_id <> current_approved_copy_version_id THEN
    RAISE EXCEPTION 'Design Version is stale because it depends on a Copy Version that is no longer current and approved.';
  END IF;

  IF target_status IN ('rejected', 'superseded') THEN
    RAISE EXCEPTION 'Rejected or superseded Design Versions cannot be approved. Create a new version instead.';
  END IF;

  IF target_status NOT IN ('draft', 'in_review', 'approved') THEN
    RAISE EXCEPTION 'Design Version is not in an approvable state.';
  END IF;

  UPDATE public.creation_design_versions
  SET approval_status = 'superseded'
  WHERE project_id = p_project_id
    AND id <> p_design_version_id
    AND approval_status = 'approved';

  IF target_status <> 'approved' THEN
    target_approved_at := now();

    UPDATE public.creation_design_versions
    SET
      approval_status = 'approved',
      approved_at = target_approved_at
    WHERE id = p_design_version_id;
  END IF;

  INSERT INTO public.creation_design_state (
    project_id,
    current_version_id,
    current_approved_version_id,
    status
  )
  VALUES (
    p_project_id,
    p_design_version_id,
    p_design_version_id,
    'approved'
  )
  ON CONFLICT (project_id) DO UPDATE
  SET
    current_version_id = EXCLUDED.current_version_id,
    current_approved_version_id = EXCLUDED.current_approved_version_id,
    status = EXCLUDED.status;

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'design_version_id', p_design_version_id,
    'previous_approved_version_id', previous_approved_version_id,
    'copy_version_id', target_copy_version_id,
    'approved_at', target_approved_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_creation_design(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_creation_design(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_creation_design(UUID, UUID) TO service_role;
