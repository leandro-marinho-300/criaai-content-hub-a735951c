-- V2: AI Task Gateway — external_manual executor.
-- Scope:
--   * persist executor-independent task contracts/runs
--   * MVP execution origin is external_manual only at the application layer
--   * preserve exact prompt, inputs, expected schema, imported response,
--     validation result and provenance
-- No provider API, queue, background job or V1 data migration is introduced.

CREATE TABLE IF NOT EXISTS public.creation_ai_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.creation_core(project_id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  contract_version TEXT NOT NULL DEFAULT '1.0',
  execution_origin TEXT NOT NULL DEFAULT 'external_manual',
  input_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  brand_snapshot_id UUID REFERENCES public.creation_brand_snapshots(id) ON DELETE SET NULL,
  rule_pack_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_version TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  expected_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_json JSONB,
  response_text TEXT,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_imported_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT creation_ai_task_runs_task_type_valid CHECK (
    task_type IN ('strategy', 'copy', 'visual_direction', 'revision', 'qualitative_qa')
  ),
  CONSTRAINT creation_ai_task_runs_contract_version_not_blank CHECK (
    length(btrim(contract_version)) > 0
  ),
  CONSTRAINT creation_ai_task_runs_execution_origin_not_blank CHECK (
    length(btrim(execution_origin)) > 0
  ),
  CONSTRAINT creation_ai_task_runs_prompt_version_not_blank CHECK (
    length(btrim(prompt_version)) > 0
  ),
  CONSTRAINT creation_ai_task_runs_prompt_text_not_blank CHECK (
    length(btrim(prompt_text)) > 0
  ),
  CONSTRAINT creation_ai_task_runs_input_versions_object CHECK (
    jsonb_typeof(input_versions) = 'object'
  ),
  CONSTRAINT creation_ai_task_runs_rule_pack_versions_object CHECK (
    jsonb_typeof(rule_pack_versions) = 'object'
  ),
  CONSTRAINT creation_ai_task_runs_expected_schema_object CHECK (
    jsonb_typeof(expected_schema) = 'object'
  ),
  CONSTRAINT creation_ai_task_runs_validation_errors_array CHECK (
    jsonb_typeof(validation_errors) = 'array'
  ),
  CONSTRAINT creation_ai_task_runs_provenance_object CHECK (
    jsonb_typeof(provenance) = 'object'
  ),
  CONSTRAINT creation_ai_task_runs_validation_status_valid CHECK (
    validation_status IN ('pending', 'valid', 'invalid')
  ),
  CONSTRAINT creation_ai_task_runs_response_import_consistent CHECK (
    (
      response_imported_at IS NULL
      AND response_json IS NULL
      AND (response_text IS NULL OR length(btrim(response_text)) = 0)
    )
    OR
    (
      response_imported_at IS NOT NULL
      AND (
        response_json IS NOT NULL
        OR (response_text IS NOT NULL AND length(btrim(response_text)) > 0)
      )
    )
  ),
  CONSTRAINT creation_ai_task_runs_validation_time_consistent CHECK (
    (validation_status = 'pending' AND validated_at IS NULL)
    OR
    (validation_status IN ('valid', 'invalid') AND validated_at IS NOT NULL)
  ),
  CONSTRAINT creation_ai_task_runs_valid_requires_response CHECK (
    validation_status = 'pending' OR response_imported_at IS NOT NULL
  ),
  CONSTRAINT creation_ai_task_runs_validation_errors_consistent CHECK (
    (validation_status = 'valid' AND jsonb_array_length(validation_errors) = 0)
    OR
    (validation_status = 'invalid' AND jsonb_array_length(validation_errors) > 0)
    OR
    validation_status = 'pending'
  )
);

CREATE INDEX IF NOT EXISTS creation_ai_task_runs_project_created_idx
  ON public.creation_ai_task_runs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS creation_ai_task_runs_project_type_idx
  ON public.creation_ai_task_runs(project_id, task_type, created_at DESC);

CREATE INDEX IF NOT EXISTS creation_ai_task_runs_brand_snapshot_idx
  ON public.creation_ai_task_runs(brand_snapshot_id)
  WHERE brand_snapshot_id IS NOT NULL;


CREATE OR REPLACE FUNCTION public.validate_creation_ai_task_run_refs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  snapshot_project_id UUID;
BEGIN
  IF NEW.brand_snapshot_id IS NOT NULL THEN
    SELECT project_id
      INTO snapshot_project_id
    FROM public.creation_brand_snapshots
    WHERE id = NEW.brand_snapshot_id;

    IF snapshot_project_id IS NULL OR snapshot_project_id <> NEW.project_id THEN
      RAISE EXCEPTION 'brand_snapshot_id must belong to the same Creation.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_ai_task_runs_validate_refs
  ON public.creation_ai_task_runs;
CREATE TRIGGER creation_ai_task_runs_validate_refs
BEFORE INSERT OR UPDATE ON public.creation_ai_task_runs
FOR EACH ROW EXECUTE FUNCTION public.validate_creation_ai_task_run_refs();


CREATE OR REPLACE FUNCTION public.guard_creation_ai_task_run_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Request identity/input is immutable. A new creative execution must create
  -- a new run instead of rewriting the historical request.
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.task_type IS DISTINCT FROM OLD.task_type
    OR NEW.contract_version IS DISTINCT FROM OLD.contract_version
    OR NEW.execution_origin IS DISTINCT FROM OLD.execution_origin
    OR NEW.input_versions IS DISTINCT FROM OLD.input_versions
    OR NEW.brand_snapshot_id IS DISTINCT FROM OLD.brand_snapshot_id
    OR NEW.rule_pack_versions IS DISTINCT FROM OLD.rule_pack_versions
    OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
    OR NEW.prompt_text IS DISTINCT FROM OLD.prompt_text
    OR NEW.expected_schema IS DISTINCT FROM OLD.expected_schema
    OR NEW.provenance IS DISTINCT FROM OLD.provenance
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'AI task request metadata is immutable. Create a new run instead.';
  END IF;

  -- Once a response has passed validation, that execution becomes an audit
  -- record. Revisions/corrections must be represented by another run.
  IF OLD.validation_status = 'valid'
    AND (
      NEW.response_json IS DISTINCT FROM OLD.response_json
      OR NEW.response_text IS DISTINCT FROM OLD.response_text
      OR NEW.response_imported_at IS DISTINCT FROM OLD.response_imported_at
      OR NEW.validation_status IS DISTINCT FROM OLD.validation_status
      OR NEW.validation_errors IS DISTINCT FROM OLD.validation_errors
      OR NEW.validated_at IS DISTINCT FROM OLD.validated_at
    )
  THEN
    RAISE EXCEPTION 'A valid AI task run is immutable. Create a new run instead.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creation_ai_task_runs_guard_update
  ON public.creation_ai_task_runs;
CREATE TRIGGER creation_ai_task_runs_guard_update
BEFORE UPDATE ON public.creation_ai_task_runs
FOR EACH ROW EXECUTE FUNCTION public.guard_creation_ai_task_run_update();

DROP TRIGGER IF EXISTS creation_ai_task_runs_set_updated_at
  ON public.creation_ai_task_runs;
CREATE TRIGGER creation_ai_task_runs_set_updated_at
BEFORE UPDATE ON public.creation_ai_task_runs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Row Level Security ---------------------------------------------------------

ALTER TABLE public.creation_ai_task_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.creation_ai_task_runs TO authenticated;
GRANT ALL ON public.creation_ai_task_runs TO service_role;

DROP POLICY IF EXISTS "creation_ai_task_runs_select_own"
  ON public.creation_ai_task_runs;
CREATE POLICY "creation_ai_task_runs_select_own"
ON public.creation_ai_task_runs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_ai_task_runs.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_ai_task_runs_insert_own"
  ON public.creation_ai_task_runs;
CREATE POLICY "creation_ai_task_runs_insert_own"
ON public.creation_ai_task_runs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_ai_task_runs.project_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creation_ai_task_runs_update_own"
  ON public.creation_ai_task_runs;
CREATE POLICY "creation_ai_task_runs_update_own"
ON public.creation_ai_task_runs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_ai_task_runs.project_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.content_projects AS cp
    WHERE cp.id = creation_ai_task_runs.project_id
      AND cp.user_id = auth.uid()
  )
);
