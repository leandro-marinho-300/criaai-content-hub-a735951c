-- Cria Aí V2 — Client Approval Operational Integration
-- Scope:
--   * reuse the mature client_approvals flow
--   * freeze the exact V2 Production Asset + QA Review sent to the client
--   * block QA BLOCK / pending assets at the database boundary
--   * allow WARN only as an eligible state (UI requires explicit acknowledgement)
--   * preserve legacy approvals with both V2 linkage columns NULL

ALTER TABLE public.client_approvals
  ADD COLUMN IF NOT EXISTS production_asset_version_id UUID,
  ADD COLUMN IF NOT EXISTS production_qa_review_id UUID,
  ADD COLUMN IF NOT EXISTS qa_warn_acknowledged_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_approvals_production_link_pair'
      AND conrelid = 'public.client_approvals'::regclass
  ) THEN
    ALTER TABLE public.client_approvals
      ADD CONSTRAINT client_approvals_production_link_pair
      CHECK (
        (production_asset_version_id IS NULL AND production_qa_review_id IS NULL)
        OR
        (production_asset_version_id IS NOT NULL AND production_qa_review_id IS NOT NULL)
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_approvals_production_asset_project_fkey'
      AND conrelid = 'public.client_approvals'::regclass
  ) THEN
    ALTER TABLE public.client_approvals
      ADD CONSTRAINT client_approvals_production_asset_project_fkey
      FOREIGN KEY (project_id, production_asset_version_id)
      REFERENCES public.creation_production_asset_versions(project_id, id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_approvals_production_qa_project_fkey'
      AND conrelid = 'public.client_approvals'::regclass
  ) THEN
    ALTER TABLE public.client_approvals
      ADD CONSTRAINT client_approvals_production_qa_project_fkey
      FOREIGN KEY (project_id, production_qa_review_id)
      REFERENCES public.creation_production_qa_reviews(project_id, id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS client_approvals_production_asset_idx
  ON public.client_approvals(project_id, production_asset_version_id)
  WHERE production_asset_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_approvals_production_qa_idx
  ON public.client_approvals(project_id, production_qa_review_id)
  WHERE production_qa_review_id IS NOT NULL;


CREATE OR REPLACE FUNCTION public.validate_client_approval_v2_linkage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  linked_qa_asset_version_id UUID;
  linked_qa_status TEXT;
  current_asset_version_id UUID;
  latest_qa_review_id UUID;
  current_production_status TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.production_asset_version_id IS DISTINCT FROM OLD.production_asset_version_id
      OR NEW.production_qa_review_id IS DISTINCT FROM OLD.production_qa_review_id
      OR NEW.qa_warn_acknowledged_at IS DISTINCT FROM OLD.qa_warn_acknowledged_at
    THEN
      RAISE EXCEPTION
        'Client approval V2 linkage is immutable. Create a new approval link for another Production Asset version.';
    END IF;

    RETURN NEW;
  END IF;

  -- Legacy approval: no V2 linkage, existing behavior remains untouched.
  IF NEW.production_asset_version_id IS NULL
    AND NEW.production_qa_review_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  IF NEW.production_asset_version_id IS NULL
    OR NEW.production_qa_review_id IS NULL
  THEN
    RAISE EXCEPTION
      'V2 client approval requires both Production Asset Version and QA Review.';
  END IF;

  SELECT
    cpqr.production_asset_version_id,
    cpqr.overall_status
  INTO
    linked_qa_asset_version_id,
    linked_qa_status
  FROM public.creation_production_qa_reviews AS cpqr
  WHERE cpqr.project_id = NEW.project_id
    AND cpqr.id = NEW.production_qa_review_id;

  IF linked_qa_asset_version_id IS NULL
    OR linked_qa_asset_version_id <> NEW.production_asset_version_id
  THEN
    RAISE EXCEPTION
      'Client approval QA Review must belong to the linked Production Asset Version.';
  END IF;

  SELECT
    cps.current_asset_version_id,
    cps.latest_qa_review_id,
    cps.status
  INTO
    current_asset_version_id,
    latest_qa_review_id,
    current_production_status
  FROM public.creation_production_state AS cps
  WHERE cps.project_id = NEW.project_id;

  IF current_asset_version_id IS NULL
    OR current_asset_version_id <> NEW.production_asset_version_id
    OR latest_qa_review_id IS NULL
    OR latest_qa_review_id <> NEW.production_qa_review_id
  THEN
    RAISE EXCEPTION
      'Client approval must use the current canonical Production Asset and latest QA Review.';
  END IF;

  IF linked_qa_status = 'PASS' AND current_production_status = 'qa_pass' THEN
    RETURN NEW;
  END IF;

  IF linked_qa_status = 'WARN' AND current_production_status = 'qa_warn' THEN
    IF NEW.qa_warn_acknowledged_at IS NULL THEN
      RAISE EXCEPTION
        'QA WARN requires explicit acknowledgement before client approval.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Production Asset is not eligible for client approval. QA must be PASS or explicitly acknowledged WARN.';
END;
$$;

DROP TRIGGER IF EXISTS client_approvals_validate_v2_linkage
  ON public.client_approvals;

CREATE TRIGGER client_approvals_validate_v2_linkage
BEFORE INSERT OR UPDATE OF production_asset_version_id, production_qa_review_id, qa_warn_acknowledged_at
ON public.client_approvals
FOR EACH ROW
EXECUTE FUNCTION public.validate_client_approval_v2_linkage();
