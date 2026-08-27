-- Creation V2: atomic Strategy approval + frozen Brand Snapshot.
-- Scope:
--   * at most one approved Strategy Version per Creation
--   * freeze current Brand state at the exact approval transaction
--   * update current/current-approved Strategy pointers atomically
--   * supersede any previously approved Strategy Version without rewriting history
-- No V1 content is migrated or rewritten by this migration.

CREATE UNIQUE INDEX IF NOT EXISTS creation_strategy_versions_one_approved_per_project_idx
  ON public.creation_strategy_versions(project_id)
  WHERE approval_status = 'approved';


-- Canonical Brand Snapshot ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.build_creation_brand_snapshot_json(
  p_brand_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  snapshot JSONB;
BEGIN
  IF p_brand_id IS NULL THEN
    RETURN jsonb_build_object(
      'brand_id', NULL,
      'brand_status', 'no_brand_assigned',
      'identity', NULL,
      'facts', NULL,
      'audience', NULL,
      'voice', NULL,
      'visual', NULL,
      'rules', NULL,
      'editorial', NULL,
      'contact', NULL,
      'asset_references', jsonb_build_object(
        'logo_reference_kind', 'none',
        'legacy_logo_url', NULL
      )
    );
  END IF;

  SELECT jsonb_build_object(
    'brand_id', b.id,
    'brand_status', CASE WHEN b.is_active THEN 'active' ELSE 'inactive' END,
    'identity', jsonb_build_object(
      'name', b.name,
      'segment', b.segment,
      'description', b.description
    ),
    'facts', jsonb_build_object(
      'products_services', b.products_services,
      'service_region', b.service_region,
      'differentiators', b.differentiators
    ),
    'audience', jsonb_build_object(
      'primary', b.audience,
      'age_range', b.age_range,
      'needs', b.audience_needs,
      'difficulties', b.audience_difficulties,
      'values', b.audience_values,
      'language', b.audience_language
    ),
    'voice', jsonb_build_object(
      'personality', b.personality,
      'tone_of_voice', b.tone_of_voice,
      'recommended_words', b.recommended_words,
      'prohibited_words', b.prohibited_words
    ),
    'visual', jsonb_build_object(
      'primary_color', b.primary_color,
      'secondary_color', b.secondary_color,
      'additional_colors', b.additional_colors,
      'fonts', b.fonts,
      'visual_style', b.visual_style,
      'graphic_elements', b.graphic_elements,
      'visual_references', b.visual_references
    ),
    'rules', jsonb_build_object(
      'allowed_topics', b.allowed_topics,
      'avoided_topics', b.avoided_topics,
      'legal_information', b.legal_information,
      'forbidden_inventions', b.forbidden_inventions
    ),
    'editorial', jsonb_build_object(
      'social_goal', b.social_goal,
      'priority_services', b.priority_services,
      'calls_to_action', b.calls_to_action,
      'frequently_asked_questions', b.frequently_asked_questions,
      'important_dates', b.important_dates,
      'publication_preferences', b.publication_preferences
    ),
    'contact', jsonb_build_object(
      'website', b.website,
      'instagram', b.instagram,
      'whatsapp', b.whatsapp
    ),
    -- logo_url is currently a long-lived signed URL in the V1 brand model.
    -- It is preserved only as a legacy reference and is not treated as a
    -- durable canonical asset. Durable Brand Assets remain a later concern.
    'asset_references', jsonb_build_object(
      'logo_reference_kind', CASE
        WHEN b.logo_url IS NULL OR btrim(b.logo_url) = '' THEN 'none'
        ELSE 'legacy_signed_url'
      END,
      'legacy_logo_url', NULLIF(btrim(b.logo_url), '')
    )
  )
  INTO snapshot
  FROM public.brands AS b
  WHERE b.id = p_brand_id;

  IF snapshot IS NULL THEN
    RAISE EXCEPTION 'Brand not found or not accessible.';
  END IF;

  RETURN snapshot;
END;
$$;


-- Direct inserts must obey the same lifecycle as the approval RPC.
CREATE OR REPLACE FUNCTION public.validate_creation_brand_snapshot_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  strategy_status TEXT;
  project_brand_id UUID;
  current_brand_updated_at TIMESTAMPTZ;
  expected_snapshot JSONB;
BEGIN
  SELECT csv.approval_status
    INTO strategy_status
  FROM public.creation_strategy_versions AS csv
  WHERE csv.id = NEW.strategy_version_id
    AND csv.project_id = NEW.project_id;

  IF strategy_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Brand Snapshot can only be frozen for an approved Strategy Version.';
  END IF;

  SELECT cp.brand_id
    INTO project_brand_id
  FROM public.content_projects AS cp
  WHERE cp.id = NEW.project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creation project not found or not accessible.';
  END IF;

  IF NEW.brand_id IS DISTINCT FROM project_brand_id THEN
    RAISE EXCEPTION 'Brand Snapshot must use the Brand currently assigned to the Creation.';
  END IF;

  IF NEW.brand_id IS NOT NULL THEN
    SELECT b.updated_at
      INTO current_brand_updated_at
    FROM public.brands AS b
    WHERE b.id = NEW.brand_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Brand not found or not accessible.';
    END IF;

    IF NEW.brand_updated_at IS DISTINCT FROM current_brand_updated_at THEN
      RAISE EXCEPTION 'Brand Snapshot brand_updated_at must match the current Brand version.';
    END IF;
  ELSIF NEW.brand_updated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Brand Snapshot without a Brand cannot have brand_updated_at.';
  END IF;

  expected_snapshot := public.build_creation_brand_snapshot_json(NEW.brand_id);

  IF NEW.snapshot_json IS DISTINCT FROM expected_snapshot THEN
    RAISE EXCEPTION 'Brand Snapshot payload must match the canonical current Brand state.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_brand_snapshots_validate_insert
  ON public.creation_brand_snapshots;
CREATE TRIGGER creation_brand_snapshots_validate_insert
BEFORE INSERT ON public.creation_brand_snapshots
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_brand_snapshot_insert();


-- Atomic approval ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_creation_strategy(
  p_project_id UUID,
  p_strategy_version_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  project_brand_id UUID;
  target_status TEXT;
  target_project_id UUID;
  target_approved_at TIMESTAMPTZ;
  current_version_id UUID;
  previous_approved_version_id UUID;
  snapshot_id UUID;
  snapshot_payload JSONB;
  current_brand_updated_at TIMESTAMPTZ;
BEGIN
  IF p_project_id IS NULL OR p_strategy_version_id IS NULL THEN
    RAISE EXCEPTION 'project_id and strategy_version_id are required.';
  END IF;

  -- Ownership + V2 Creation anchor, locked for the approval transaction.
  SELECT cp.brand_id
    INTO project_brand_id
  FROM public.content_projects AS cp
  JOIN public.creation_core AS cc
    ON cc.project_id = cp.id
  WHERE cp.id = p_project_id
    AND cp.user_id = auth.uid()
  FOR UPDATE OF cp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creation not found, not V2, or not accessible.';
  END IF;

  SELECT css.current_version_id, css.current_approved_version_id
    INTO current_version_id, previous_approved_version_id
  FROM public.creation_strategy_state AS css
  WHERE css.project_id = p_project_id
  FOR UPDATE;

  IF FOUND
    AND current_version_id IS NOT NULL
    AND current_version_id <> p_strategy_version_id
  THEN
    RAISE EXCEPTION 'Only the current Strategy Version can be approved.';
  END IF;

  SELECT csv.project_id, csv.approval_status, csv.approved_at
    INTO target_project_id, target_status, target_approved_at
  FROM public.creation_strategy_versions AS csv
  WHERE csv.id = p_strategy_version_id
  FOR UPDATE;

  IF NOT FOUND OR target_project_id <> p_project_id THEN
    RAISE EXCEPTION 'Strategy Version does not belong to this Creation.';
  END IF;

  IF target_status IN ('rejected', 'superseded') THEN
    RAISE EXCEPTION 'Rejected or superseded Strategy Versions cannot be approved. Create a new version instead.';
  END IF;

  IF target_status NOT IN ('draft', 'in_review', 'approved') THEN
    RAISE EXCEPTION 'Strategy Version is not in an approvable state.';
  END IF;

  -- Lock the current Brand so the snapshot reflects one exact Brand version.
  IF project_brand_id IS NOT NULL THEN
    SELECT b.updated_at
      INTO current_brand_updated_at
    FROM public.brands AS b
    WHERE b.id = project_brand_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Assigned Brand not found or not accessible.';
    END IF;
  ELSE
    current_brand_updated_at := NULL;
  END IF;

  -- If another version was approved, retire it first inside the same transaction.
  UPDATE public.creation_strategy_versions
  SET approval_status = 'superseded'
  WHERE project_id = p_project_id
    AND id <> p_strategy_version_id
    AND approval_status = 'approved';

  IF target_status <> 'approved' THEN
    target_approved_at := now();

    UPDATE public.creation_strategy_versions
    SET
      approval_status = 'approved',
      approved_at = target_approved_at
    WHERE id = p_strategy_version_id;
  END IF;

  -- Re-running the same approval is idempotent: reuse the frozen snapshot.
  SELECT cbs.id
    INTO snapshot_id
  FROM public.creation_brand_snapshots AS cbs
  WHERE cbs.strategy_version_id = p_strategy_version_id;

  IF snapshot_id IS NULL THEN
    snapshot_payload := public.build_creation_brand_snapshot_json(project_brand_id);

    INSERT INTO public.creation_brand_snapshots (
      project_id,
      strategy_version_id,
      brand_id,
      brand_updated_at,
      snapshot_schema_version,
      snapshot_json
    )
    VALUES (
      p_project_id,
      p_strategy_version_id,
      project_brand_id,
      current_brand_updated_at,
      '1.0',
      snapshot_payload
    )
    RETURNING id INTO snapshot_id;
  END IF;

  INSERT INTO public.creation_strategy_state (
    project_id,
    current_version_id,
    current_approved_version_id,
    status
  )
  VALUES (
    p_project_id,
    p_strategy_version_id,
    p_strategy_version_id,
    'approved'
  )
  ON CONFLICT (project_id) DO UPDATE
  SET
    current_version_id = EXCLUDED.current_version_id,
    current_approved_version_id = EXCLUDED.current_approved_version_id,
    status = 'approved';

  RETURN jsonb_build_object(
    'project_id', p_project_id,
    'strategy_version_id', p_strategy_version_id,
    'previous_approved_version_id', previous_approved_version_id,
    'brand_snapshot_id', snapshot_id,
    'approved_at', target_approved_at,
    'brand_id', project_brand_id,
    'brand_updated_at', current_brand_updated_at,
    'snapshot_schema_version', '1.0'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_creation_brand_snapshot_json(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_creation_brand_snapshot_json(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_creation_strategy(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_creation_strategy(UUID, UUID) TO authenticated;
