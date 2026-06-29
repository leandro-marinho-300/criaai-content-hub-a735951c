
-- 1) client_approvals: restrict policy to authenticated role only, deny anon
DROP POLICY IF EXISTS "Users manage their own approvals" ON public.client_approvals;
CREATE POLICY "Users manage their own approvals"
  ON public.client_approvals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.client_approvals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_approvals TO authenticated;
GRANT ALL ON public.client_approvals TO service_role;

-- 2) prompt_templates: stop exposing template_content of system templates.
-- Owners keep full access to their own rows; system templates are exposed via a catalog view.
DROP POLICY IF EXISTS "prompt_templates_select" ON public.prompt_templates;
CREATE POLICY "prompt_templates_select_own"
  ON public.prompt_templates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Catalog view: lists system templates + own templates, without template_content
CREATE OR REPLACE VIEW public.prompt_templates_catalog
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  name,
  description,
  objective,
  recommended_formats,
  suggested_fields,
  is_system_template,
  created_at,
  updated_at
FROM public.prompt_templates
WHERE is_system_template = true OR auth.uid() = user_id;

GRANT SELECT ON public.prompt_templates_catalog TO authenticated;

REVOKE ALL ON public.prompt_templates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_templates TO authenticated;
GRANT ALL ON public.prompt_templates TO service_role;
