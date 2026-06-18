import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagInput } from "@/components/tag-input";
import type { Tables } from "@/integrations/supabase/types";

export type BrandFormValues = Partial<Tables<"brands">> & { name: string };

const empty: BrandFormValues = {
  name: "",
  segment: "",
  description: "",
  products_services: "",
  service_region: "",
  website: "",
  instagram: "",
  whatsapp: "",
  social_goal: "",
  audience: "",
  age_range: "",
  audience_needs: "",
  audience_difficulties: "",
  audience_values: "",
  audience_language: "",
  personality: "",
  tone_of_voice: "",
  recommended_words: [],
  prohibited_words: [],
  primary_color: "",
  secondary_color: "",
  additional_colors: [],
  fonts: "",
  visual_style: "",
  graphic_elements: "",
  visual_references: "",
  differentiators: "",
  allowed_topics: [],
  avoided_topics: [],
  priority_services: [],
  calls_to_action: [],
  frequently_asked_questions: "",
  important_dates: "",
  legal_information: "",
  forbidden_inventions: "",
  logo_url: "",
};

interface Props {
  initial?: Partial<Tables<"brands">>;
  brandId?: string;
}

export function BrandForm({ initial, brandId }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [values, setValues] = useState<BrandFormValues>({ ...empty, ...(initial ?? {}), name: initial?.name ?? "" });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (initial) setValues({ ...empty, ...initial, name: initial.name ?? "" });
  }, [initial]);

  const set = <K extends keyof BrandFormValues>(k: K, v: BrandFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const payload = { ...values, user_id: u.user.id };
      if (brandId) {
        const { error } = await supabase.from("brands").update(payload).eq("id", brandId);
        if (error) throw error;
        return brandId;
      }
      const { data, error } = await supabase.from("brands").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["brand", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(brandId ? "Marca atualizada." : "Marca cadastrada.");
      if (!brandId) navigate({ to: "/app/brands" });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const uploadLogo = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 5MB).");
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop();
      const path = `${u.user.id}/logos/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("brand-assets").createSignedUrl(path, 60 * 60 * 24 * 365);
      set("logo_url", signed?.signedUrl ?? "");
      toast.success("Logo enviado.");
    } catch (e: unknown) {
      toast.error("Falha no upload", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-6"
    >
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="general">Dados gerais</TabsTrigger>
          <TabsTrigger value="audience">Público</TabsTrigger>
          <TabsTrigger value="identity">Identidade</TabsTrigger>
          <TabsTrigger value="content">Conteúdo</TabsTrigger>
          <TabsTrigger value="assets">Arquivos</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Nome *" required>
                <Input value={values.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Segmento"><Input value={values.segment ?? ""} onChange={(e) => set("segment", e.target.value)} /></Field>
              <Field label="Descrição" className="sm:col-span-2">
                <Textarea rows={3} value={values.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Produtos e serviços" className="sm:col-span-2">
                <Textarea rows={3} value={values.products_services ?? ""} onChange={(e) => set("products_services", e.target.value)} />
              </Field>
              <Field label="Região de atendimento"><Input value={values.service_region ?? ""} onChange={(e) => set("service_region", e.target.value)} /></Field>
              <Field label="Site"><Input value={values.website ?? ""} onChange={(e) => set("website", e.target.value)} /></Field>
              <Field label="Instagram"><Input value={values.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} /></Field>
              <Field label="WhatsApp"><Input value={values.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
              <Field label="Objetivo nas redes sociais" className="sm:col-span-2">
                <Textarea rows={2} value={values.social_goal ?? ""} onChange={(e) => set("social_goal", e.target.value)} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Público principal" className="sm:col-span-2"><Textarea rows={2} value={values.audience ?? ""} onChange={(e) => set("audience", e.target.value)} /></Field>
              <Field label="Faixa etária"><Input value={values.age_range ?? ""} onChange={(e) => set("age_range", e.target.value)} /></Field>
              <Field label="Linguagem recomendada"><Input value={values.audience_language ?? ""} onChange={(e) => set("audience_language", e.target.value)} /></Field>
              <Field label="Necessidades" className="sm:col-span-2"><Textarea rows={2} value={values.audience_needs ?? ""} onChange={(e) => set("audience_needs", e.target.value)} /></Field>
              <Field label="Dificuldades" className="sm:col-span-2"><Textarea rows={2} value={values.audience_difficulties ?? ""} onChange={(e) => set("audience_difficulties", e.target.value)} /></Field>
              <Field label="O que o público valoriza" className="sm:col-span-2"><Textarea rows={2} value={values.audience_values ?? ""} onChange={(e) => set("audience_values", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="identity">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Personalidade da marca"><Input value={values.personality ?? ""} onChange={(e) => set("personality", e.target.value)} /></Field>
              <Field label="Tom de voz"><Input value={values.tone_of_voice ?? ""} onChange={(e) => set("tone_of_voice", e.target.value)} /></Field>
              <Field label="Palavras recomendadas" className="sm:col-span-2">
                <TagInput value={values.recommended_words ?? []} onChange={(v) => set("recommended_words", v)} placeholder="Adicionar palavra" />
              </Field>
              <Field label="Palavras proibidas" className="sm:col-span-2">
                <TagInput value={values.prohibited_words ?? []} onChange={(v) => set("prohibited_words", v)} placeholder="Adicionar palavra" />
              </Field>
              <Field label="Cor principal">
                <div className="flex gap-2">
                  <Input type="color" value={values.primary_color || "#ff8a3d"} onChange={(e) => set("primary_color", e.target.value)} className="h-10 w-14 p-1" />
                  <Input value={values.primary_color ?? ""} onChange={(e) => set("primary_color", e.target.value)} placeholder="#FF8A3D" />
                </div>
              </Field>
              <Field label="Cor secundária">
                <div className="flex gap-2">
                  <Input type="color" value={values.secondary_color || "#9b5de5"} onChange={(e) => set("secondary_color", e.target.value)} className="h-10 w-14 p-1" />
                  <Input value={values.secondary_color ?? ""} onChange={(e) => set("secondary_color", e.target.value)} placeholder="#9B5DE5" />
                </div>
              </Field>
              <Field label="Cores adicionais" className="sm:col-span-2">
                <TagInput value={values.additional_colors ?? []} onChange={(v) => set("additional_colors", v)} placeholder="#FFFFFF" />
              </Field>
              <Field label="Fontes"><Input value={values.fonts ?? ""} onChange={(e) => set("fonts", e.target.value)} placeholder="Ex.: Inter, Space Grotesk" /></Field>
              <Field label="Estilo visual"><Input value={values.visual_style ?? ""} onChange={(e) => set("visual_style", e.target.value)} /></Field>
              <Field label="Elementos gráficos" className="sm:col-span-2"><Textarea rows={2} value={values.graphic_elements ?? ""} onChange={(e) => set("graphic_elements", e.target.value)} /></Field>
              <Field label="Referências visuais" className="sm:col-span-2"><Textarea rows={2} value={values.visual_references ?? ""} onChange={(e) => set("visual_references", e.target.value)} /></Field>
              <Field label="Diferenciais" className="sm:col-span-2"><Textarea rows={2} value={values.differentiators ?? ""} onChange={(e) => set("differentiators", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Assuntos permitidos" className="sm:col-span-2">
                <TagInput value={values.allowed_topics ?? []} onChange={(v) => set("allowed_topics", v)} />
              </Field>
              <Field label="Assuntos que devem ser evitados" className="sm:col-span-2">
                <TagInput value={values.avoided_topics ?? []} onChange={(v) => set("avoided_topics", v)} />
              </Field>
              <Field label="Serviços prioritários" className="sm:col-span-2">
                <TagInput value={values.priority_services ?? []} onChange={(v) => set("priority_services", v)} />
              </Field>
              <Field label="Chamadas para ação" className="sm:col-span-2">
                <TagInput value={values.calls_to_action ?? []} onChange={(v) => set("calls_to_action", v)} />
              </Field>
              <Field label="Dúvidas frequentes" className="sm:col-span-2"><Textarea rows={3} value={values.frequently_asked_questions ?? ""} onChange={(e) => set("frequently_asked_questions", e.target.value)} /></Field>
              <Field label="Datas importantes" className="sm:col-span-2"><Textarea rows={2} value={values.important_dates ?? ""} onChange={(e) => set("important_dates", e.target.value)} /></Field>
              <Field label="Informações legais" className="sm:col-span-2"><Textarea rows={2} value={values.legal_information ?? ""} onChange={(e) => set("legal_information", e.target.value)} /></Field>
              <Field label="Informações que nunca podem ser inventadas" className="sm:col-span-2"><Textarea rows={2} value={values.forbidden_inventions ?? ""} onChange={(e) => set("forbidden_inventions", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardContent className="grid gap-4 p-6">
              <div>
                <Label>Logo principal</Label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {values.logo_url ? (
                    <img src={values.logo_url} alt="Logo" className="h-16 w-16 rounded-lg border bg-muted object-contain p-1" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-lg border bg-muted text-xs text-muted-foreground">Sem logo</div>
                  )}
                  <div className="flex gap-2">
                    <Button asChild type="button" variant="outline" disabled={uploading}>
                      <label className="cursor-pointer">
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Enviar logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadLogo(f);
                          }}
                        />
                      </label>
                    </Button>
                    {values.logo_url && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => set("logo_url", "")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Imagens até 5MB. Os arquivos ficam privados; apenas você os visualiza.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate({ to: "/app/brands" })}>Cancelar</Button>
        <Button type="submit" disabled={save.isPending || !values.name?.trim()}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {brandId ? "Salvar alterações" : "Cadastrar marca"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}{required && <span className="ml-1 text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}
