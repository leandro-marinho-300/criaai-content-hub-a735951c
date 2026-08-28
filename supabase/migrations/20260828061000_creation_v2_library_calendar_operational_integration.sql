-- Cria Aí V2 — Library + Calendar Operational Integration
-- Scope:
--   * keep content_projects as the Library operational envelope
--   * pin calendar items to the exact client-approved V2 Production Asset
--   * block actionable scheduling/publication when the approved asset became stale
--   * reuse existing publication_schedule_items / Library / Calendar structures
--   * preserve V1 schedule rows with both V2 linkage columns NULL

ALTER TABLE public.publication_schedule_items
  ADD COLUMN IF NOT EXISTS client_approval_id UUID,
  ADD COLUMN IF NOT EXISTS production_asset_version_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'publication_schedule_items_v2_link_pair'
      AND conrelid = 'public.publication_schedule_items'::regclass
  ) THEN
    ALTER TABLE public.publication_schedule_items
      ADD CONSTRAINT publication_schedule_items_v2_link_pair
      CHECK (
        (client_approval_id IS NULL AND production_asset_version_id IS NULL)
        OR
        (client_approval_id IS NOT NULL AND production_asset_version_id IS NOT NULL)
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'publication_schedule_items_client_approval_fkey'
      AND conrelid = 'public.publication_schedule_items'::regclass
  ) THEN
    ALTER TABLE public.publication_schedule_items
      ADD CONSTRAINT publication_schedule_items_client_approval_fkey
      FOREIGN KEY (client_approval_id)
      REFERENCES public.client_approvals(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'publication_schedule_items_production_asset_fkey'
      AND conrelid = 'public.publication_schedule_items'::regclass
  ) THEN
    ALTER TABLE public.publication_schedule_items
      ADD CONSTRAINT publication_schedule_items_production_asset_fkey
      FOREIGN KEY (production_asset_version_id)
      REFERENCES public.creation_production_asset_versions(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS publication_schedule_items_v2_approval_idx
  ON public.publication_schedule_items(project_id, client_approval_id)
  WHERE client_approval_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS publication_schedule_items_v2_asset_idx
  ON public.publication_schedule_items(project_id, production_asset_version_id)
  WHERE production_asset_version_id IS NOT NULL;

COMMENT ON COLUMN public.publication_schedule_items.client_approval_id IS
  'For Creation V2, freezes the client approval that authorized the scheduled production asset.';

COMMENT ON COLUMN public.publication_schedule_items.production_asset_version_id IS
  'For Creation V2, freezes the exact canonical Production Asset Version used by this calendar item.';


CREATE OR REPLACE FUNCTION public.validate_publication_schedule_v2_linkage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_v2 BOOLEAN;
  requires_current_asset BOOLEAN;

  approval_project_id UUID;
  approval_status_value TEXT;
  approval_revoked_at TIMESTAMPTZ;
  approval_submitted_at TIMESTAMPTZ;
  approval_asset_version_id UUID;
  approval_qa_review_id UUID;
  approval_warn_acknowledged_at TIMESTAMPTZ;
  approval_client_name TEXT;
  approval_client_company TEXT;
  approval_client_email TEXT;

  asset_project_id UUID;
  asset_design_version_id UUID;
  qa_asset_version_id UUID;
  qa_overall_status TEXT;

  current_asset_version_id UUID;
  latest_qa_review_id UUID;
  production_status_value TEXT;
  current_approved_design_version_id UUID;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.creation_core AS cc
    WHERE cc.project_id = NEW.project_id
  ) INTO is_v2;

  IF NOT is_v2 THEN
    RETURN NEW;
  END IF;

  IF (
    (NEW.client_approval_id IS NULL AND NEW.production_asset_version_id IS NOT NULL)
    OR
    (NEW.client_approval_id IS NOT NULL AND NEW.production_asset_version_id IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Creation V2 calendar linkage requires both Client Approval and Production Asset Version.';
  END IF;

  -- A V2 item becomes operational only once it is approved/agendado or is
  -- transitioning to published. A record that is already published remains a
  -- historical snapshot and may be edited without becoming stale retroactively.
  IF NEW.schedule_status IN ('aprovado', 'agendado') THEN
    requires_current_asset := TRUE;
  ELSIF NEW.schedule_status = 'publicado' THEN
    IF TG_OP = 'INSERT' THEN
      requires_current_asset := TRUE;
    ELSE
      requires_current_asset := OLD.schedule_status IS DISTINCT FROM 'publicado';
    END IF;
  ELSE
    requires_current_asset := FALSE;
  END IF;

  IF NEW.client_approval_id IS NULL THEN
    IF requires_current_asset THEN
      RAISE EXCEPTION
        'Creation V2 actionable calendar items require the exact client-approved Production Asset Version.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT
    ca.project_id,
    ca.status,
    ca.revoked_at,
    ca.submitted_at,
    ca.production_asset_version_id,
    ca.production_qa_review_id,
    ca.qa_warn_acknowledged_at,
    ca.client_name,
    ca.client_company,
    ca.client_email
  INTO
    approval_project_id,
    approval_status_value,
    approval_revoked_at,
    approval_submitted_at,
    approval_asset_version_id,
    approval_qa_review_id,
    approval_warn_acknowledged_at,
    approval_client_name,
    approval_client_company,
    approval_client_email
  FROM public.client_approvals AS ca
  WHERE ca.id = NEW.client_approval_id;

  IF approval_project_id IS NULL OR approval_project_id <> NEW.project_id THEN
    RAISE EXCEPTION
      'Calendar Client Approval must belong to the same Creation.';
  END IF;

  IF approval_asset_version_id IS NULL
    OR approval_asset_version_id <> NEW.production_asset_version_id
  THEN
    RAISE EXCEPTION
      'Calendar Production Asset Version must match the exact asset frozen in Client Approval.';
  END IF;

  SELECT cpav.project_id, cpav.design_version_id
  INTO asset_project_id, asset_design_version_id
  FROM public.creation_production_asset_versions AS cpav
  WHERE cpav.id = NEW.production_asset_version_id;

  IF asset_project_id IS NULL OR asset_project_id <> NEW.project_id THEN
    RAISE EXCEPTION
      'Calendar Production Asset Version must belong to the same Creation.';
  END IF;

  -- Cancelled/planning items keep historical linkage without forcing old
  -- approvals to remain current forever. Currentness is required at the moment
  -- the item becomes operational or transitions to published.
  IF NOT requires_current_asset THEN
    IF approval_status_value = 'aprovado' THEN
      NEW.approval_status := 'aprovado';
    ELSIF approval_status_value = 'aprovado_com_ajustes' THEN
      NEW.approval_status := 'aprovado_com_ajustes';
    END IF;

    IF approval_submitted_at IS NOT NULL THEN
      NEW.approved_at := approval_submitted_at;
      NEW.approved_by := COALESCE(
        NULLIF(btrim(approval_client_name), ''),
        NULLIF(btrim(approval_client_company), ''),
        NULLIF(btrim(approval_client_email), '')
      );
    END IF;
    RETURN NEW;
  END IF;

  IF approval_revoked_at IS NOT NULL
    OR approval_status_value NOT IN ('aprovado', 'aprovado_com_ajustes')
    OR approval_submitted_at IS NULL
  THEN
    RAISE EXCEPTION
      'Creation V2 calendar requires an active submitted client approval.';
  END IF;

  IF approval_qa_review_id IS NULL THEN
    RAISE EXCEPTION
      'Creation V2 client approval must freeze a QA Review before scheduling.';
  END IF;

  SELECT cpqr.production_asset_version_id, cpqr.overall_status
  INTO qa_asset_version_id, qa_overall_status
  FROM public.creation_production_qa_reviews AS cpqr
  WHERE cpqr.project_id = NEW.project_id
    AND cpqr.id = approval_qa_review_id;

  IF qa_asset_version_id IS NULL
    OR qa_asset_version_id <> NEW.production_asset_version_id
    OR qa_overall_status NOT IN ('PASS', 'WARN')
  THEN
    RAISE EXCEPTION
      'Creation V2 calendar requires the eligible QA Review frozen in Client Approval.';
  END IF;

  IF qa_overall_status = 'WARN' AND approval_warn_acknowledged_at IS NULL THEN
    RAISE EXCEPTION
      'QA WARN must have been explicitly acknowledged before scheduling.';
  END IF;

  SELECT
    cps.current_asset_version_id,
    cps.latest_qa_review_id,
    cps.status
  INTO
    current_asset_version_id,
    latest_qa_review_id,
    production_status_value
  FROM public.creation_production_state AS cps
  WHERE cps.project_id = NEW.project_id;

  IF current_asset_version_id IS NULL
    OR current_asset_version_id <> NEW.production_asset_version_id
    OR latest_qa_review_id IS NULL
    OR latest_qa_review_id <> approval_qa_review_id
  THEN
    RAISE EXCEPTION
      'The client-approved Production Asset is stale and cannot be scheduled.';
  END IF;

  IF NOT (
    (qa_overall_status = 'PASS' AND production_status_value = 'qa_pass')
    OR
    (qa_overall_status = 'WARN' AND production_status_value = 'qa_warn')
  ) THEN
    RAISE EXCEPTION
      'The current Production state is not eligible for scheduling.';
  END IF;

  SELECT cds.current_approved_version_id
  INTO current_approved_design_version_id
  FROM public.creation_design_state AS cds
  WHERE cds.project_id = NEW.project_id;

  IF current_approved_design_version_id IS NULL
    OR current_approved_design_version_id <> asset_design_version_id
  THEN
    RAISE EXCEPTION
      'The client-approved Production Asset depends on a stale Design Version and cannot be scheduled.';
  END IF;

  NEW.approval_status := CASE approval_status_value
    WHEN 'aprovado' THEN 'aprovado'
    ELSE 'aprovado_com_ajustes'
  END;
  NEW.approved_at := approval_submitted_at;
  NEW.approved_by := COALESCE(
    NULLIF(btrim(approval_client_name), ''),
    NULLIF(btrim(approval_client_company), ''),
    NULLIF(btrim(approval_client_email), '')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publication_schedule_items_validate_v2_linkage
  ON public.publication_schedule_items;

CREATE TRIGGER publication_schedule_items_validate_v2_linkage
BEFORE INSERT OR UPDATE OF
  project_id,
  schedule_status,
  client_approval_id,
  production_asset_version_id,
  approval_status,
  approved_at,
  approved_by
ON public.publication_schedule_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_publication_schedule_v2_linkage();
