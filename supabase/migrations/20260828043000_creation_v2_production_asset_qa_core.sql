-- Creation V2: Production Asset + QA core.
-- Scope:
--   * reuse the existing content_piece_assets / piece-assets Storage flow
--   * canonically link uploaded production assets to an approved Design Version
--   * immutable Production Asset versions with lineage
--   * QA reviews across factual / strategic / brand / visual-technical axes
--   * PASS / WARN / BLOCK overall result derived from the four axes
--   * no OCR/CV and no client approval in this migration


-- Production Asset versions --------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creation_production_asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  design_version_id UUID NOT NULL,
  piece_asset_id UUID NOT NULL REFERENCES public.content_piece_assets(id) ON DELETE RESTRICT,
  based_on_version_id UUID,
  version_number INTEGER NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT creation_production_asset_versions_project_version_unique
    UNIQUE (project_id, version_number),
  CONSTRAINT creation_production_asset_versions_project_id_id_unique
    UNIQUE (project_id, id),
  CONSTRAINT creation_production_asset_versions_piece_asset_unique
    UNIQUE (piece_asset_id),
  CONSTRAINT creation_production_asset_versions_version_positive
    CHECK (version_number >= 1),
  CONSTRAINT creation_production_asset_versions_schema_not_blank
    CHECK (length(btrim(schema_version)) > 0),
  CONSTRAINT creation_production_asset_versions_provenance_object
    CHECK (jsonb_typeof(provenance) = 'object'),
  CONSTRAINT creation_production_asset_versions_design_project_fkey
    FOREIGN KEY (project_id, design_version_id)
    REFERENCES public.creation_design_versions(project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT creation_production_asset_versions_lineage_project_fkey
    FOREIGN KEY (project_id, based_on_version_id)
    REFERENCES public.creation_production_asset_versions(project_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS creation_production_asset_versions_project_idx
  ON public.creation_production_asset_versions(project_id, version_number DESC);

CREATE INDEX IF NOT EXISTS creation_production_asset_versions_design_idx
  ON public.creation_production_asset_versions(project_id, design_version_id);


CREATE OR REPLACE FUNCTION public.validate_creation_production_asset_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  design_status TEXT;
  current_approved_design_version_id UUID;
  piece_asset_project_id UUID;
  source_project_id UUID;
  source_design_version_id UUID;
BEGIN
  SELECT cdv.approval_status
    INTO design_status
  FROM public.creation_design_versions AS cdv
  WHERE cdv.id = NEW.design_version_id
    AND cdv.project_id = NEW.project_id;

  SELECT cds.current_approved_version_id
    INTO current_approved_design_version_id
  FROM public.creation_design_state AS cds
  WHERE cds.project_id = NEW.project_id;

  IF design_status IS DISTINCT FROM 'approved'
    OR current_approved_design_version_id IS NULL
    OR current_approved_design_version_id <> NEW.design_version_id
  THEN
    RAISE EXCEPTION 'Production Asset requires the current approved Design Version.';
  END IF;

  SELECT cpa.project_id
    INTO piece_asset_project_id
  FROM public.content_piece_assets AS cpa
  WHERE cpa.id = NEW.piece_asset_id;

  IF piece_asset_project_id IS NULL OR piece_asset_project_id <> NEW.project_id THEN
    RAISE EXCEPTION 'Piece Asset must belong to the same Creation.';
  END IF;

  IF NEW.based_on_version_id IS NOT NULL THEN
    SELECT cpav.project_id, cpav.design_version_id
      INTO source_project_id, source_design_version_id
    FROM public.creation_production_asset_versions AS cpav
    WHERE cpav.id = NEW.based_on_version_id;

    IF source_project_id IS NULL OR source_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'Production revision source must belong to the same Creation.';
    END IF;

    IF source_design_version_id <> NEW.design_version_id THEN
      RAISE EXCEPTION 'Production revisions must preserve the same Design Version. A changed Design starts a new production lineage.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_production_asset_versions_validate_insert
  ON public.creation_production_asset_versions;
CREATE TRIGGER creation_production_asset_versions_validate_insert
BEFORE INSERT ON public.creation_production_asset_versions
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_production_asset_insert();


CREATE OR REPLACE FUNCTION public.guard_creation_production_asset_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Production Asset versions are immutable. Register a new asset version instead.';
END;
$$;

DROP TRIGGER IF EXISTS creation_production_asset_versions_guard_update
  ON public.creation_production_asset_versions;
CREATE TRIGGER creation_production_asset_versions_guard_update
BEFORE UPDATE ON public.creation_production_asset_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_creation_production_asset_update();


-- QA ------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.creation_qa_overall_status(
  p_factual TEXT,
  p_strategic TEXT,
  p_brand TEXT,
  p_visual_technical TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN 'BLOCK' IN (p_factual, p_strategic, p_brand, p_visual_technical) THEN 'BLOCK'
    WHEN 'WARN' IN (p_factual, p_strategic, p_brand, p_visual_technical) THEN 'WARN'
    ELSE 'PASS'
  END;
$$;


CREATE TABLE IF NOT EXISTS public.creation_production_qa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  production_asset_version_id UUID NOT NULL,
  review_number INTEGER NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  factual_status TEXT NOT NULL,
  strategic_status TEXT NOT NULL,
  brand_status TEXT NOT NULL,
  visual_technical_status TEXT NOT NULL,
  overall_status TEXT NOT NULL,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT creation_production_qa_reviews_project_asset_review_unique
    UNIQUE (project_id, production_asset_version_id, review_number),
  CONSTRAINT creation_production_qa_reviews_project_id_id_unique
    UNIQUE (project_id, id),
  CONSTRAINT creation_production_qa_reviews_review_positive
    CHECK (review_number >= 1),
  CONSTRAINT creation_production_qa_reviews_schema_not_blank
    CHECK (length(btrim(schema_version)) > 0),
  CONSTRAINT creation_production_qa_reviews_factual_status_valid
    CHECK (factual_status IN ('PASS', 'WARN', 'BLOCK')),
  CONSTRAINT creation_production_qa_reviews_strategic_status_valid
    CHECK (strategic_status IN ('PASS', 'WARN', 'BLOCK')),
  CONSTRAINT creation_production_qa_reviews_brand_status_valid
    CHECK (brand_status IN ('PASS', 'WARN', 'BLOCK')),
  CONSTRAINT creation_production_qa_reviews_visual_technical_status_valid
    CHECK (visual_technical_status IN ('PASS', 'WARN', 'BLOCK')),
  CONSTRAINT creation_production_qa_reviews_overall_status_valid
    CHECK (overall_status IN ('PASS', 'WARN', 'BLOCK')),
  CONSTRAINT creation_production_qa_reviews_overall_consistent
    CHECK (
      overall_status = public.creation_qa_overall_status(
        factual_status,
        strategic_status,
        brand_status,
        visual_technical_status
      )
    ),
  CONSTRAINT creation_production_qa_reviews_findings_array
    CHECK (jsonb_typeof(findings) = 'array'),
  CONSTRAINT creation_production_qa_reviews_provenance_object
    CHECK (jsonb_typeof(provenance) = 'object'),
  CONSTRAINT creation_production_qa_reviews_asset_project_fkey
    FOREIGN KEY (project_id, production_asset_version_id)
    REFERENCES public.creation_production_asset_versions(project_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS creation_production_qa_reviews_asset_idx
  ON public.creation_production_qa_reviews(
    project_id,
    production_asset_version_id,
    review_number DESC
  );


CREATE OR REPLACE FUNCTION public.guard_creation_production_qa_review_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'QA Reviews are immutable. Create a new review instead.';
END;
$$;

DROP TRIGGER IF EXISTS creation_production_qa_reviews_guard_update
  ON public.creation_production_qa_reviews;
CREATE TRIGGER creation_production_qa_reviews_guard_update
BEFORE UPDATE ON public.creation_production_qa_reviews
FOR EACH ROW EXECUTE FUNCTION public.guard_creation_production_qa_review_update();


-- Current Production state ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creation_production_state (
  project_id UUID PRIMARY KEY REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  current_asset_version_id UUID,
  latest_qa_review_id UUID,
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT creation_production_state_status_valid
    CHECK (
      status IN ('not_started', 'qa_pending', 'qa_pass', 'qa_warn', 'qa_blocked')
    ),
  CONSTRAINT creation_production_state_asset_project_fkey
    FOREIGN KEY (project_id, current_asset_version_id)
    REFERENCES public.creation_production_asset_versions(project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT creation_production_state_qa_project_fkey
    FOREIGN KEY (project_id, latest_qa_review_id)
    REFERENCES public.creation_production_qa_reviews(project_id, id)
    ON DELETE RESTRICT
);


CREATE OR REPLACE FUNCTION public.validate_creation_production_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  qa_asset_version_id UUID;
BEGIN
  IF NEW.status = 'not_started' AND NEW.current_asset_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'not_started Production state cannot reference an asset.';
  END IF;

  IF NEW.status <> 'not_started' AND NEW.current_asset_version_id IS NULL THEN
    RAISE EXCEPTION 'Started Production state requires current_asset_version_id.';
  END IF;

  IF NEW.latest_qa_review_id IS NOT NULL THEN
    SELECT cpqr.production_asset_version_id
      INTO qa_asset_version_id
    FROM public.creation_production_qa_reviews AS cpqr
    WHERE cpqr.id = NEW.latest_qa_review_id
      AND cpqr.project_id = NEW.project_id;

    IF qa_asset_version_id IS NULL OR qa_asset_version_id <> NEW.current_asset_version_id THEN
      RAISE EXCEPTION 'latest_qa_review_id must belong to current_asset_version_id.';
    END IF;
  END IF;

  IF NEW.status IN ('qa_pass', 'qa_warn', 'qa_blocked')
    AND NEW.latest_qa_review_id IS NULL
  THEN
    RAISE EXCEPTION 'QA-complete Production state requires latest_qa_review_id.';
  END IF;

  IF NEW.status = 'qa_pending' AND NEW.latest_qa_review_id IS NOT NULL THEN
    RAISE EXCEPTION 'qa_pending Production state cannot reference a completed QA Review.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_production_state_validate
  ON public.creation_production_state;
CREATE TRIGGER creation_production_state_validate
BEFORE INSERT OR UPDATE ON public.creation_production_state
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_production_state();

DROP TRIGGER IF EXISTS creation_production_state_set_updated_at
  ON public.creation_production_state;
CREATE TRIGGER creation_production_state_set_updated_at
BEFORE UPDATE ON public.creation_production_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE OR REPLACE FUNCTION public.sync_creation_production_state_after_asset()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.creation_production_state (
    project_id,
    current_asset_version_id,
    latest_qa_review_id,
    status
  )
  VALUES (
    NEW.project_id,
    NEW.id,
    NULL,
    'qa_pending'
  )
  ON CONFLICT (project_id) DO UPDATE SET
    current_asset_version_id = EXCLUDED.current_asset_version_id,
    latest_qa_review_id = NULL,
    status = 'qa_pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_production_asset_versions_sync_state
  ON public.creation_production_asset_versions;
CREATE TRIGGER creation_production_asset_versions_sync_state
AFTER INSERT ON public.creation_production_asset_versions
FOR EACH ROW EXECUTE FUNCTION public.sync_creation_production_state_after_asset();


CREATE OR REPLACE FUNCTION public.sync_creation_production_state_after_qa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.creation_production_state
  SET
    latest_qa_review_id = NEW.id,
    status = CASE NEW.overall_status
      WHEN 'PASS' THEN 'qa_pass'
      WHEN 'WARN' THEN 'qa_warn'
      ELSE 'qa_blocked'
    END
  WHERE project_id = NEW.project_id
    AND current_asset_version_id = NEW.production_asset_version_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_production_qa_reviews_sync_state
  ON public.creation_production_qa_reviews;
CREATE TRIGGER creation_production_qa_reviews_sync_state
AFTER INSERT ON public.creation_production_qa_reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_creation_production_state_after_qa();


-- Row Level Security ---------------------------------------------------------

ALTER TABLE public.creation_production_asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_production_qa_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_production_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.creation_production_asset_versions TO authenticated;
GRANT SELECT, INSERT ON public.creation_production_qa_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.creation_production_state TO authenticated;

GRANT ALL ON public.creation_production_asset_versions TO service_role;
GRANT ALL ON public.creation_production_qa_reviews TO service_role;
GRANT ALL ON public.creation_production_state TO service_role;

DROP POLICY IF EXISTS "creation_production_asset_versions_select_own"
  ON public.creation_production_asset_versions;
CREATE POLICY "creation_production_asset_versions_select_own"
ON public.creation_production_asset_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_production_asset_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_production_asset_versions_insert_own"
  ON public.creation_production_asset_versions;
CREATE POLICY "creation_production_asset_versions_insert_own"
ON public.creation_production_asset_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_production_asset_versions.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_production_qa_reviews_select_own"
  ON public.creation_production_qa_reviews;
CREATE POLICY "creation_production_qa_reviews_select_own"
ON public.creation_production_qa_reviews
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_production_qa_reviews.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_production_qa_reviews_insert_own"
  ON public.creation_production_qa_reviews;
CREATE POLICY "creation_production_qa_reviews_insert_own"
ON public.creation_production_qa_reviews
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_production_qa_reviews.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_production_state_select_own"
  ON public.creation_production_state;
CREATE POLICY "creation_production_state_select_own"
ON public.creation_production_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_production_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_production_state_insert_own"
  ON public.creation_production_state;
CREATE POLICY "creation_production_state_insert_own"
ON public.creation_production_state
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_production_state.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_production_state_update_own"
  ON public.creation_production_state;
CREATE POLICY "creation_production_state_update_own"
ON public.creation_production_state
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_production_state.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_production_state.project_id
      AND cp.user_id = auth.uid()
  )
);
