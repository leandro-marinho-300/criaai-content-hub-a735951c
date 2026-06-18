
-- =========================
-- Função utilitária updated_at
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================
-- profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para criar profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- brands
-- =========================
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segment TEXT,
  description TEXT,
  products_services TEXT,
  service_region TEXT,
  website TEXT,
  instagram TEXT,
  whatsapp TEXT,
  social_goal TEXT,
  audience TEXT,
  age_range TEXT,
  audience_needs TEXT,
  audience_difficulties TEXT,
  audience_values TEXT,
  audience_language TEXT,
  personality TEXT,
  tone_of_voice TEXT,
  recommended_words TEXT[] NOT NULL DEFAULT '{}',
  prohibited_words TEXT[] NOT NULL DEFAULT '{}',
  primary_color TEXT,
  secondary_color TEXT,
  additional_colors TEXT[] NOT NULL DEFAULT '{}',
  fonts TEXT,
  visual_style TEXT,
  graphic_elements TEXT,
  visual_references TEXT,
  differentiators TEXT,
  allowed_topics TEXT[] NOT NULL DEFAULT '{}',
  avoided_topics TEXT[] NOT NULL DEFAULT '{}',
  priority_services TEXT[] NOT NULL DEFAULT '{}',
  calls_to_action TEXT[] NOT NULL DEFAULT '{}',
  frequently_asked_questions TEXT,
  important_dates TEXT,
  legal_information TEXT,
  forbidden_inventions TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands_all_own" ON public.brands FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX brands_user_id_idx ON public.brands(user_id);
CREATE TRIGGER brands_set_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- brand_assets
-- =========================
CREATE TABLE public.brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_assets TO authenticated;
GRANT ALL ON public.brand_assets TO service_role;
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_assets_all_own" ON public.brand_assets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX brand_assets_brand_id_idx ON public.brand_assets(brand_id);

-- =========================
-- content_projects
-- =========================
CREATE TABLE public.content_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  internal_title TEXT,
  theme TEXT,
  objective TEXT,
  specific_audience TEXT,
  audience_problem TEXT,
  main_message TEXT,
  mandatory_information TEXT,
  call_to_action TEXT,
  publication_date DATE,
  event_date DATE,
  event_time TEXT,
  location TEXT,
  price_information TEXT,
  contact_information TEXT,
  desired_style TEXT,
  formality_level TEXT,
  restrictions TEXT,
  notes TEXT,
  selected_formats TEXT[] NOT NULL DEFAULT '{}',
  selected_outputs TEXT[] NOT NULL DEFAULT '{}',
  generation_mode TEXT NOT NULL DEFAULT 'safe',
  status TEXT NOT NULL DEFAULT 'draft',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_projects TO authenticated;
GRANT ALL ON public.content_projects TO service_role;
ALTER TABLE public.content_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_projects_all_own" ON public.content_projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX content_projects_user_id_idx ON public.content_projects(user_id);
CREATE INDEX content_projects_brand_id_idx ON public.content_projects(brand_id);
CREATE TRIGGER content_projects_set_updated_at BEFORE UPDATE ON public.content_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- content_outputs
-- =========================
CREATE TABLE public.content_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.content_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  title TEXT NOT NULL,
  original_content TEXT NOT NULL,
  edited_content TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_outputs TO authenticated;
GRANT ALL ON public.content_outputs TO service_role;
ALTER TABLE public.content_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_outputs_all_own" ON public.content_outputs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX content_outputs_project_id_idx ON public.content_outputs(project_id);
CREATE TRIGGER content_outputs_set_updated_at BEFORE UPDATE ON public.content_outputs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- prompt_templates
-- =========================
CREATE TABLE public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  recommended_formats TEXT[] NOT NULL DEFAULT '{}',
  suggested_fields TEXT[] NOT NULL DEFAULT '{}',
  template_content TEXT NOT NULL,
  is_system_template BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_templates TO authenticated;
GRANT ALL ON public.prompt_templates TO service_role;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
-- Pode ler modelo próprio OU modelo do sistema
CREATE POLICY "prompt_templates_select" ON public.prompt_templates FOR SELECT
  USING (is_system_template = true OR auth.uid() = user_id);
CREATE POLICY "prompt_templates_insert_own" ON public.prompt_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system_template = false);
CREATE POLICY "prompt_templates_update_own" ON public.prompt_templates FOR UPDATE
  USING (auth.uid() = user_id AND is_system_template = false);
CREATE POLICY "prompt_templates_delete_own" ON public.prompt_templates FOR DELETE
  USING (auth.uid() = user_id AND is_system_template = false);
CREATE TRIGGER prompt_templates_set_updated_at BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Seed: modelos do sistema
-- =========================
INSERT INTO public.prompt_templates (name, description, objective, recommended_formats, suggested_fields, template_content, is_system_template) VALUES
('Divulgação de serviço', 'Anuncia um serviço específico da marca', 'divulgar_servico', ARRAY['post','carrossel','story','whatsapp'], ARRAY['theme','main_message','call_to_action','price_information','contact_information'], 'Crie peças para divulgar o serviço destacando benefícios e diferenciais.', true),
('Divulgação de produto', 'Apresenta um produto, suas características e CTA de compra', 'divulgar_produto', ARRAY['post','carrossel','reel'], ARRAY['theme','main_message','price_information','call_to_action'], 'Apresente o produto com foco em benefício, prova e chamada para ação.', true),
('Comunicado', 'Aviso institucional curto e direto', 'comunicado', ARRAY['post','story','whatsapp'], ARRAY['main_message','mandatory_information','publication_date'], 'Comunicado direto, sem exagero gráfico. Destaque a informação principal.', true),
('Vencimento de prazo', 'Aviso de prazo final ou data limite', 'comunicado', ARRAY['post','story','whatsapp'], ARRAY['main_message','event_date','call_to_action'], 'Reforce a data limite e gere senso de urgência sem ser apelativo.', true),
('Carrossel educativo', 'Sequência de slides ensinando algo ao público', 'educar', ARRAY['carrossel'], ARRAY['theme','specific_audience','main_message'], 'Estruture 5 a 8 slides: capa, problema, etapas, exemplo, encerramento com CTA.', true),
('Dúvida frequente', 'Responde uma FAQ comum do público', 'educar', ARRAY['post','carrossel','story'], ARRAY['theme','specific_audience','main_message'], 'Pergunta no topo, resposta clara e CTA convidando a entrar em contato.', true),
('Apresentação da empresa', 'Quem somos, missão e diferenciais', 'aumentar_reconhecimento', ARRAY['post','carrossel','reel'], ARRAY['main_message'], 'Apresente a marca com tom acolhedor, valores e diferenciais.', true),
('Benefício de serviço', 'Destaca um benefício específico de um serviço', 'vender', ARRAY['post','carrossel','reel'], ARRAY['theme','main_message','call_to_action'], 'Foque em UM benefício e mostre transformação prática para o cliente.', true),
('Depoimento', 'Compartilha experiência de cliente real', 'relacionamento', ARRAY['post','story','reel'], ARRAY['main_message'], 'Estruture: contexto do cliente, problema, solução, resultado. Nunca invente depoimentos.', true),
('Bastidores', 'Mostra os bastidores da operação ou equipe', 'relacionamento', ARRAY['story','reel','carrossel'], ARRAY['theme','main_message'], 'Tom humano, próximo. Mostre rotina, equipe ou processo.', true),
('Evento', 'Convite ou cobertura de evento', 'divulgar_servico', ARRAY['post','carrossel','story','whatsapp'], ARRAY['theme','event_date','event_time','location','call_to_action'], 'Destaque data, horário, local e CTA para inscrição/confirmação.', true),
('Promoção', 'Oferta por tempo limitado', 'vender', ARRAY['post','story','whatsapp'], ARRAY['main_message','price_information','event_date','call_to_action'], 'Destaque a oferta, condição, prazo e CTA direto.', true),
('Campanha institucional', 'Campanha de posicionamento da marca', 'aumentar_reconhecimento', ARRAY['post','carrossel','reel'], ARRAY['theme','main_message'], 'Tom institucional, foco em propósito e valores da marca.', true),
('Prestação de contas', 'Mostra resultados, números, entregas', 'relacionamento', ARRAY['post','carrossel'], ARRAY['theme','main_message'], 'Apresente números, fatos e contexto. Use apenas dados confirmados.', true),
('Captação de parceiros', 'Convite para parcerias comerciais', 'gerar_contatos', ARRAY['post','carrossel','whatsapp'], ARRAY['main_message','call_to_action','contact_information'], 'Apresente proposta de valor para parceiros e CTA para contato.', true),
('WhatsApp', 'Mensagem otimizada para envio em listas/status', 'relacionamento', ARRAY['whatsapp','status_whatsapp'], ARRAY['main_message','call_to_action'], 'Texto curto, sem formatação pesada, com CTA claro para responder.', true);
