import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Copy,
  FileJson2,
  Image as ImageIcon,
  LayoutTemplate,
  Lightbulb,
  BookOpenCheck,
  MessageSquareText,
  Palette,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Target,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getAllPresets, type ContentPreset } from "@/lib/contentPresets";
import {
  POST2_EDITORIAL_TYPES,
  POST2_ENTRY_OPTIONS,
  POST2_OBJECTIVES,
  applyPost2Concept,
  buildPost2ConceptOptions,
  buildPost2LayoutPrompt,
  clearPost2Draft,
  createPost2Draft,
  exportPost2Json,
  generatePost2Result,
  getSelectedPost2Title,
  loadPost2Draft,
  savePost2Draft,
  type Post2ConceptOption,
  type Post2Draft,
  type Post2EditorialType,
  type Post2EntryMode,
  type Post2Objective,
  type Post2Ratio,
} from "@/lib/post2";

export const Route = createFileRoute("/_authenticated/app/create/post")({
  head: () => ({ meta: [{ title: "Criar Post 2.0 — Cria Aí" }] }),
  component: CreatePost2,
});

const STEP_LABELS = [
  "Entrada",
  "Marca",
  "Objetivo",
  "Tipo",
  "Direção",
  "Peça",
  "Produção",
] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type IdeaSuggestion = {
  label: string;
  theme: string;
  understanding: string;
  situation: string;
  current_belief: string;
  desired_shift: string;
  cta: string;
};

function CreatePost2() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState<StepIndex>(0);
  const [draft, setDraft] = useState<Post2Draft>(() => createPost2Draft());

  const { data: brands } = useQuery({
    queryKey: ["brands-post2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const presets = useMemo(
    () =>
      getAllPresets().filter(
        (preset) => preset.formats.includes("post") || preset.idea_formats.includes("post"),
      ),
    [],
  );
  const selectedBrand = useMemo(
    () => brands?.find((brand) => brand.id === draft.brand_id) ?? null,
    [brands, draft.brand_id],
  );
  const layoutPrompt = useMemo(
    () => buildPost2LayoutPrompt(draft, selectedBrand),
    [draft, selectedBrand],
  );
  const jsonOutput = useMemo(() => exportPost2Json(draft, selectedBrand), [draft, selectedBrand]);
  const noIdeaSuggestions = useMemo(
    () => buildNoIdeaSuggestions(selectedBrand, draft.objective, draft.editorial_type),
    [selectedBrand, draft.objective, draft.editorial_type],
  );

  useEffect(() => savePost2Draft(draft), [draft]);
  const patch = (partial: Partial<Post2Draft>) =>
    setDraft((current) => ({ ...current, ...partial, updated_at: new Date().toISOString() }));
  const progress = Math.round(((step + 1) / STEP_LABELS.length) * 100);

  const canContinue = useMemo(() => {
    if (step === 0) {
      if (!draft.entry_mode) return false;
      if (draft.entry_mode === "idea") return draft.theme.trim().length >= 3;
      if (draft.entry_mode === "preset") return Boolean(draft.preset_id);
      if (draft.entry_mode === "reference") return draft.reference_content.trim().length >= 3;
      return true;
    }
    if (step === 1) return Boolean(draft.brand_id);
    if (step === 2) return Boolean(draft.objective);
    if (step === 3) return Boolean(draft.editorial_type);
    if (step === 4) return draft.theme.trim().length >= 3 && draft.understanding.trim().length >= 3;
    if (step === 5)
      return draft.concept_options.length > 0 && draft.selected_concept_index !== null;
    return true;
  }, [draft, step]);

  const goNext = () => {
    if (!canContinue) return toast.error("Complete esta etapa antes de continuar.");
    if (step === 4) {
      const concepts = buildPost2ConceptOptions(draft, selectedBrand);
      setDraft((current) => ({ ...current, concept_options: concepts, selected_concept_index: 0 }));
      setStep(5);
      return;
    }
    if (step === 5) {
      const selected = draft.concept_options[draft.selected_concept_index ?? 0];
      const conceptDraft = { ...draft, ...applyPost2Concept(draft, selected) };
      setDraft({ ...conceptDraft, ...generatePost2Result(conceptDraft, selectedBrand) });
      setStep(6);
      return;
    }
    setStep((current) => Math.min(6, current + 1) as StepIndex);
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    patch({
      preset_id: presetId,
      call_to_action: draft.call_to_action || preset.cta,
      mandatory_information: draft.mandatory_information || preset.mandatory_information,
      restrictions: draft.restrictions || preset.restrictions,
      visual_direction: draft.visual_direction || preset.visual_instructions,
      imported_context: [preset.description, preset.desired_style, preset.notes]
        .filter(Boolean)
        .join("\n\n"),
    });
    toast.success("Preset aplicado como ponto de partida.");
  };

  const saveForProduction = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada. Entre novamente.");
      if (!selectedBrand) throw new Error("Selecione uma marca antes de salvar o Post.");
      const finalTitle = draft.custom_title || getSelectedPost2Title(draft);
      const hashtags = draft.hashtags
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5);
      const { data: project, error } = await supabase
        .from("content_projects")
        .insert({
          user_id: user.id,
          brand_id: selectedBrand.id,
          internal_title: `Post 2.0 — ${finalTitle}`.slice(0, 160),
          display_title: finalTitle.slice(0, 120),
          theme: draft.theme,
          objective: draft.objective || "informar",
          specific_audience: draft.audience || selectedBrand.audience || null,
          main_message: draft.understanding,
          mandatory_information: draft.mandatory_information || null,
          call_to_action: draft.call_to_action || draft.art_cta || null,
          desired_style: draft.visual_direction || null,
          restrictions: draft.restrictions || selectedBrand.forbidden_inventions || null,
          notes: `Origem: Criar Post 2.0.\nFormato: ${draft.ratio}.\nTipo editorial: ${draft.editorial_type}.`,
          selected_formats: ["post"],
          selected_outputs: ["textos_artes", "legenda_completa", "hashtags", "prompt_visual"],
          generation_mode: "safe",
          status: "draft",
          content_source: "external_chatgpt",
          content_development_status: "script_imported",
          campaign_content_json: {
            source: "post_2_0",
            post2: draft,
            caption: { text: draft.caption, hashtags },
            layout_prompt: layoutPrompt,
            created_at: new Date().toISOString(),
          },
          imported_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw error;
      const piece = {
        index: 1,
        formatKey: "post",
        role: "arte",
        name: `Post 2.0 — ${finalTitle}`,
        formatLabel: draft.ratio === "4:5" ? "Post para Feed 4:5" : "Post para Feed 1:1",
        objective: draft.objective || "informar",
        communicationAngle: draft.editorial_type,
        mainPromise: draft.understanding,
        mainText: finalTitle,
        supportText: draft.support_text,
        bullets: draft.badge_text ? [draft.badge_text] : [],
        cta: draft.art_cta || draft.call_to_action,
        caption: draft.caption,
        hashtags,
        productionNotes: [draft.visual_direction, `Proporção: ${draft.ratio}`].filter(Boolean),
        readyPrompt: layoutPrompt,
        qualityStatus: "approved",
        outputKind: "publishable_asset",
        sourceScope: "publication",
        contentStage: "publication_copy",
        copySource: "external_chatgpt",
      };
      const { error: outputError } = await supabase.from("content_outputs").insert({
        project_id: project.id,
        user_id: user.id,
        output_type: "piece",
        title: piece.name,
        original_content: JSON.stringify(piece),
        display_order: 0,
      });
      if (outputError) throw outputError;
      return project.id as string;
    },
    onSuccess: (projectId) => {
      clearPost2Draft();
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Post salvo. Agora anexe a arte e siga para aprovação.");
      navigate({ to: "/app/content/$projectId/result", params: { projectId } });
    },
    onError: (error: Error) =>
      toast.error("Não foi possível salvar o Post", { description: error.message }),
  });

  const reset = () => {
    clearPost2Draft();
    setDraft(createPost2Draft());
    setStep(0);
    toast.success("Novo Post 2.0 iniciado.");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="secondary" className="mb-2 rounded-full">
              Post 2.0
            </Badge>
            <h1 className="text-2xl font-bold sm:text-4xl">Criar Post</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
              Transforme uma ideia em peça estática com conceito, texto, direção visual e caminho de
              produção.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/create">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Oficina Criativa
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              Limpar rascunho
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Etapa {step + 1} de 7 · {STEP_LABELS[step]}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
        <div className="hidden grid-cols-7 gap-2 md:grid">
          {STEP_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => index <= step && setStep(index as StepIndex)}
              className={cn(
                "rounded-xl border px-2 py-2 text-xs",
                index === step
                  ? "border-orange-500 bg-orange-500/10 font-semibold text-orange-500"
                  : index < step
                    ? "bg-muted/40"
                    : "text-muted-foreground",
              )}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </header>

      {step === 0 && (
        <EntryStep
          draft={draft}
          patch={patch}
          presets={presets}
          applyPreset={applyPreset}
          onContinueDraft={() => {
            const loaded = loadPost2Draft();
            setDraft(loaded);
            setStep(loaded.brand_id ? 1 : 0);
          }}
        />
      )}
      {step === 1 && (
        <BrandStep
          brands={brands ?? []}
          draft={draft}
          patch={patch}
          selectedBrand={selectedBrand}
        />
      )}
      {step === 2 && (
        <ObjectiveStep value={draft.objective} onChange={(objective) => patch({ objective })} />
      )}
      {step === 3 && (
        <EditorialTypeStep
          value={draft.editorial_type}
          onChange={(editorial_type) => patch({ editorial_type })}
        />
      )}
      {step === 4 && (
        <DirectionStep
          draft={draft}
          patch={patch}
          brand={selectedBrand}
          suggestions={noIdeaSuggestions}
        />
      )}
      {step === 5 && <PieceStep draft={draft} patch={patch} brand={selectedBrand} />}
      {step === 6 && (
        <ProductionStep
          draft={draft}
          brand={selectedBrand}
          layoutPrompt={layoutPrompt}
          jsonOutput={jsonOutput}
          patch={patch}
          onSave={() => saveForProduction.mutate()}
          saving={saveForProduction.isPending}
        />
      )}

      <div className="flex items-center justify-between border-t pt-5">
        <Button
          variant="outline"
          onClick={() => setStep((current) => Math.max(0, current - 1) as StepIndex)}
          disabled={step === 0}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        {step < 6 ? (
          <Button onClick={goNext} disabled={!canContinue}>
            Continuar
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              savePost2Draft(draft);
              toast.success("Rascunho salvo.");
            }}
          >
            <Save className="mr-1 h-4 w-4" />
            Salvar rascunho
          </Button>
        )}
      </div>
    </div>
  );
}

function EntryStep({
  draft,
  patch,
  presets,
  applyPreset,
  onContinueDraft,
}: {
  draft: Post2Draft;
  patch: (p: Partial<Post2Draft>) => void;
  presets: ContentPreset[];
  applyPreset: (id: string) => void;
  onContinueDraft: () => void;
}) {
  const icons: Record<Post2EntryMode, typeof Sparkles> = {
    idea: Lightbulb,
    no_ideas: Sparkles,
    preset: Wand2,
    reference: BookOpenCheck,
  };
  return (
    <Step
      title="Como você quer começar este Post?"
      description="Escolha o ponto de partida. O restante da jornada continua guiado, como no Reel 2.0."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {POST2_ENTRY_OPTIONS.map((item) => {
          const Icon = icons[item.id];
          const active = draft.entry_mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => patch({ entry_mode: item.id })}
              className={cn(
                "min-h-40 rounded-2xl border p-5 text-left transition",
                active
                  ? "border-orange-500 bg-orange-500/5 ring-2 ring-orange-500/15"
                  : "hover:border-orange-500/40",
              )}
            >
              <div className="flex justify-between">
                <Icon className="h-5 w-5 text-orange-500" />
                {active && <BadgeCheck className="h-5 w-5 text-orange-500" />}
              </div>
              <p className="mt-5 font-semibold">{item.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </button>
          );
        })}
      </div>
      {draft.entry_mode === "idea" && (
        <Field label="Qual é a ideia ou tema do Post?">
          <Input
            value={draft.theme}
            onChange={(e) => patch({ theme: e.target.value })}
            placeholder="Descreva o assunto que deseja transformar em peça visual"
          />
        </Field>
      )}
      {draft.entry_mode === "no_ideas" && (
        <Notice
          title="Sem ideia pronta"
          text="Depois de escolher marca, objetivo e tipo, o Cria Aí apresentará subtópicos coerentes com o contexto real da marca — igual ao Reel 2.0."
        />
      )}
      {draft.entry_mode === "preset" && (
        <Field label="Preset compatível com Post">
          <Select value={draft.preset_id} onValueChange={applyPreset}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um preset" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {draft.entry_mode === "reference" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Referência">
            <Textarea
              rows={6}
              value={draft.reference_content}
              onChange={(e) => patch({ reference_content: e.target.value })}
              placeholder="Cole link, texto ou descrição"
            />
          </Field>
          <Field label="O que aprender com ela?">
            <Textarea
              rows={6}
              value={draft.reference_notes}
              onChange={(e) => patch({ reference_notes: e.target.value })}
              placeholder="Hierarquia, composição, abordagem..."
            />
          </Field>
          <p className="text-xs text-muted-foreground md:col-span-2">
            Use apenas como referência estrutural. Não copiar textos, imagens, identidade visual ou
            composição autoral.
          </p>
        </div>
      )}
      <div className="flex justify-center">
        <Button variant="ghost" onClick={onContinueDraft}>
          <Save className="mr-2 h-4 w-4" />
          Continuar último rascunho
        </Button>
      </div>
    </Step>
  );
}

function BrandStep({
  brands,
  draft,
  patch,
  selectedBrand,
}: {
  brands: Tables<"brands">[];
  draft: Post2Draft;
  patch: (p: Partial<Post2Draft>) => void;
  selectedBrand: Tables<"brands"> | null;
}) {
  return (
    <Step
      title="Para qual marca este Post será criado?"
      description="A marca define segmento, tom, público, restrições e identidade visual. Isso impede misturas como exemplos de cachorro em uma marca de benefícios."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <Label>Marca</Label>
            <Select
              value={draft.brand_id}
              onValueChange={(brand_id) => {
                const brand = brands.find((b) => b.id === brand_id);
                patch({
                  brand_id,
                  audience: brand?.audience || "",
                  theme: draft.entry_mode === "idea" ? draft.theme : "",
                  understanding: "",
                  concept_options: [],
                  selected_concept_index: null,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a marca" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBrand && (
              <div className="rounded-xl bg-muted/40 p-4 text-sm">
                <p className="font-medium">{selectedBrand.name}</p>
                <p className="text-muted-foreground">
                  {selectedBrand.segment || "Segmento não informado"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {selectedBrand.tone_of_voice || "Tom não informado"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <Label>Formato</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["4:5", "1:1"] as Post2Ratio[]).map((ratio) => (
                <button
                  type="button"
                  key={ratio}
                  onClick={() => patch({ ratio })}
                  className={cn(
                    "rounded-xl border p-4 text-left",
                    draft.ratio === ratio
                      ? "border-orange-500 bg-orange-500/5"
                      : "hover:border-orange-500/40",
                  )}
                >
                  <LayoutTemplate className="mb-2 h-5 w-5 text-orange-500" />
                  <p className="font-semibold">Feed {ratio}</p>
                  <p className="text-xs text-muted-foreground">
                    {ratio === "4:5" ? "1080 × 1350 px" : "1080 × 1080 px"}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Step>
  );
}

function ObjectiveStep({
  value,
  onChange,
}: {
  value: Post2Objective | "";
  onChange: (v: Post2Objective) => void;
}) {
  return (
    <Step
      title="O que este Post precisa alcançar?"
      description="Escolha um resultado principal. Ele orienta as próximas decisões criativas."
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {POST2_OBJECTIVES.map((item) => (
          <Choice
            key={item.id}
            active={value === item.id}
            title={item.label}
            description={item.description}
            onClick={() => onChange(item.id)}
          />
        ))}
      </div>
    </Step>
  );
}
function EditorialTypeStep({
  value,
  onChange,
}: {
  value: Post2EditorialType | "";
  onChange: (v: Post2EditorialType) => void;
}) {
  return (
    <Step
      title="Qual caminho criativo combina melhor?"
      description="Escolha a lógica editorial da peça. O sistema usará essa decisão para construir três direções completas."
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {POST2_EDITORIAL_TYPES.map((item) => (
          <Choice
            key={item.id}
            active={value === item.id}
            title={item.label}
            description={item.description}
            onClick={() => onChange(item.id)}
          />
        ))}
      </div>
    </Step>
  );
}

function DirectionStep({
  draft,
  patch,
  brand,
  suggestions,
}: {
  draft: Post2Draft;
  patch: (p: Partial<Post2Draft>) => void;
  brand: Tables<"brands"> | null;
  suggestions: IdeaSuggestion[];
}) {
  return (
    <Step
      title="O que a pessoa precisa entender ou sentir?"
      description="Defina a transformação da mensagem. Para quem escolheu “Estou sem ideias”, comece por um subtópico real da marca."
    >
      {draft.entry_mode === "no_ideas" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Sugestões para {brand?.name || "a marca"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Escolha um subtópico para preencher a direção inicial do Post.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {suggestions.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() =>
                  patch({
                    theme: s.theme,
                    understanding: s.understanding,
                    situation: s.situation,
                    current_belief: s.current_belief,
                    desired_shift: s.desired_shift,
                    desired_reaction: s.cta,
                    call_to_action: s.cta,
                  })
                }
                className={cn(
                  "rounded-2xl border bg-background p-4 text-left hover:border-orange-500/50",
                  draft.theme === s.theme && "border-orange-500 ring-2 ring-orange-500/15",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                  {s.label}
                </p>
                <p className="mt-2 font-semibold leading-snug">{s.theme}</p>
                <p className="mt-2 text-xs text-muted-foreground">{s.understanding}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Tema específico" required>
            <Input
              value={draft.theme}
              onChange={(e) => patch({ theme: e.target.value })}
              placeholder={`Tema relacionado a ${brand?.segment || "esta marca"}`}
            />
          </Field>
          <Field label="Público">
            <Input
              value={draft.audience}
              onChange={(e) => patch({ audience: e.target.value })}
              placeholder={brand?.audience || "Público do conteúdo"}
            />
          </Field>
          <Field label="Qual situação real queremos apresentar?">
            <Textarea
              rows={3}
              value={draft.situation}
              onChange={(e) => patch({ situation: e.target.value })}
            />
          </Field>
          <Field label="O que a pessoa pensa hoje?">
            <Textarea
              rows={3}
              value={draft.current_belief}
              onChange={(e) => patch({ current_belief: e.target.value })}
            />
          </Field>
          <Field label="O que ela precisa compreender?" required>
            <Textarea
              rows={3}
              value={draft.understanding}
              onChange={(e) => patch({ understanding: e.target.value })}
            />
          </Field>
          <Field label="Qual mudança de percepção queremos provocar?">
            <Textarea
              rows={3}
              value={draft.desired_shift}
              onChange={(e) => patch({ desired_shift: e.target.value })}
            />
          </Field>
          <Field label="Qual ação esperamos depois do Post?">
            <Textarea
              rows={3}
              value={draft.desired_reaction}
              onChange={(e) =>
                patch({ desired_reaction: e.target.value, call_to_action: e.target.value })
              }
            />
          </Field>
          <Field label="Informações obrigatórias">
            <Textarea
              rows={3}
              value={draft.mandatory_information}
              onChange={(e) => patch({ mandatory_information: e.target.value })}
            />
          </Field>
          <Field label="Cuidados e restrições" className="md:col-span-2">
            <Textarea
              rows={3}
              value={draft.restrictions}
              onChange={(e) => patch({ restrictions: e.target.value })}
              placeholder="O que o GPT não pode inventar ou representar?"
            />
          </Field>
        </CardContent>
      </Card>
    </Step>
  );
}

function PieceStep({
  draft,
  patch,
  brand,
}: {
  draft: Post2Draft;
  patch: (p: Partial<Post2Draft>) => void;
  brand: Tables<"brands"> | null;
}) {
  const regenerate = () =>
    patch({ concept_options: buildPost2ConceptOptions(draft, brand), selected_concept_index: 0 });
  return (
    <Step
      title="Escolha a direção completa da peça"
      description="Como os ganchos do Reel 2.0, cada opção nasce da ideia, objetivo, marca e caminho criativo — mas aqui ela define a peça inteira."
    >
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={regenerate}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Gerar novas direções
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {draft.concept_options.map((option, index) => (
          <ConceptCard
            key={`${option.label}-${index}`}
            option={option}
            active={draft.selected_concept_index === index}
            onClick={() => patch({ selected_concept_index: index })}
          />
        ))}
      </div>
      {draft.selected_concept_index !== null && (
        <Notice
          title="Direção escolhida"
          text="Na próxima etapa, o Cria Aí transformará essa direção em conteúdo final da arte, legenda, prompt para o GPT e fluxo de produção."
        />
      )}
    </Step>
  );
}

function ProductionStep({
  draft,
  brand,
  layoutPrompt,
  jsonOutput,
  patch,
  onSave,
  saving,
}: {
  draft: Post2Draft;
  brand: Tables<"brands"> | null;
  layoutPrompt: string;
  jsonOutput: string;
  patch: (p: Partial<Post2Draft>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const title = draft.custom_title || getSelectedPost2Title(draft);
  return (
    <Step
      title="Pacote do Post 2.0"
      description="Visão única da peça: conteúdo, criação no GPT, arte final, aprovação, agendamento e publicação."
    >
      <Journey />
      <Tabs defaultValue="conteudo">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
          <TabsTrigger value="visual">Peça visual</TabsTrigger>
          <TabsTrigger value="legenda">Publicação</TabsTrigger>
          <TabsTrigger value="gpt">Prompt GPT</TabsTrigger>
          <TabsTrigger value="producao">Produção</TabsTrigger>
        </TabsList>
        <TabsContent value="conteudo" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              <Info label="Marca" value={brand?.name || "—"} />
              <Info
                label="Objetivo"
                value={POST2_OBJECTIVES.find((o) => o.id === draft.objective)?.label || "—"}
              />
              <Info
                label="Caminho criativo"
                value={
                  POST2_EDITORIAL_TYPES.find((o) => o.id === draft.editorial_type)?.label || "—"
                }
              />
              <Info label="Formato" value={`Feed ${draft.ratio}`} />
              <div className="md:col-span-2">
                <Info
                  label="Conceito"
                  value={
                    draft.concept_options[draft.selected_concept_index ?? 0]?.concept ||
                    draft.understanding
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="visual" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prévia estrutural</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "mx-auto flex aspect-[4/5] max-w-[260px] flex-col justify-between rounded-2xl border bg-gradient-to-br from-muted to-background p-5",
                    draft.ratio === "1:1" && "aspect-square",
                  )}
                >
                  <div>
                    {draft.badge_text && <Badge>{draft.badge_text}</Badge>}
                    <h3 className="mt-5 text-2xl font-bold leading-tight">{title}</h3>
                    <p className="mt-3 text-sm text-muted-foreground">{draft.support_text}</p>
                  </div>
                  <p className="text-sm font-semibold text-orange-500">{draft.art_cta}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-4 p-5">
                <Field label="Título principal">
                  <Input
                    value={title}
                    onChange={(e) =>
                      patch({ custom_title: e.target.value, selected_title_index: null })
                    }
                  />
                </Field>
                <Field label="Texto de apoio">
                  <Textarea
                    rows={3}
                    value={draft.support_text}
                    onChange={(e) => patch({ support_text: e.target.value })}
                  />
                </Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Selo opcional">
                    <Input
                      value={draft.badge_text}
                      onChange={(e) => patch({ badge_text: e.target.value })}
                    />
                  </Field>
                  <Field label="CTA na arte">
                    <Input
                      value={draft.art_cta}
                      onChange={(e) => patch({ art_cta: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Direção visual">
                  <Textarea
                    rows={6}
                    value={draft.visual_direction}
                    onChange={(e) => patch({ visual_direction: e.target.value })}
                  />
                </Field>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="legenda" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <Field label="Legenda">
                <Textarea
                  rows={10}
                  value={draft.caption}
                  onChange={(e) => patch({ caption: e.target.value })}
                />
              </Field>
              <Field label="Hashtags — máximo 5">
                <Input
                  value={draft.hashtags}
                  onChange={(e) => patch({ hashtags: e.target.value })}
                />
              </Field>
              <CopyAction text={`${draft.caption}\n\n${draft.hashtags}`}>Copiar legenda</CopyAction>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="gpt" className="mt-4">
          <Card className="border-violet-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Prompt para gerar a arte no GPT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea readOnly rows={18} value={layoutPrompt} className="font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <CopyAction text={layoutPrompt}>Copiar prompt e gerar arte</CopyAction>
                <CopyAction text={jsonOutput} variant="outline">
                  <FileJson2 className="mr-1 h-4 w-4" />
                  Copiar JSON
                </CopyAction>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="producao" className="mt-4">
          <Card className="border-orange-500/30">
            <CardHeader>
              <CardTitle className="text-base">Arte final, aprovação e calendário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Stage
                  icon={Upload}
                  title="1. Anexar arte"
                  text="Gere a imagem no GPT e anexe o arquivo final ao projeto."
                />
                <Stage
                  icon={Send}
                  title="2. Aprovação"
                  text="Envie a peça e a legenda para aprovação e ajustes."
                />
                <Stage
                  icon={CalendarDays}
                  title="3. Calendário"
                  text="Depois da aprovação, escolha data, horário e publicação."
                />
              </div>
              <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar e continuar para produção"}
              </Button>
              <p className="text-xs text-muted-foreground">
                O próximo painel usa o fluxo já existente de anexo, aprovação e calendário. Nenhuma
                imagem fica salva apenas no navegador.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Step>
  );
}

function buildNoIdeaSuggestions(
  brand: Tables<"brands"> | null,
  objective: Post2Objective | "",
  editorialType: Post2EditorialType | "",
): IdeaSuggestion[] {
  const brandName = brand?.name || "a marca";
  const segment = brand?.segment || "o segmento da marca";
  const audience = brand?.audience || "o público da marca";
  const description = brand?.description || "a proposta da marca";
  const products = Array.isArray(brand?.products_services)
    ? brand?.products_services.join(", ")
    : "";
  const focus = products || description || segment;
  const objectiveLabel =
    POST2_OBJECTIVES.find((item) => item.id === objective)?.label.toLowerCase() || "comunicar";
  const typeLabel =
    POST2_EDITORIAL_TYPES.find((item) => item.id === editorialType)?.label.toLowerCase() ||
    "orientação";
  return [
    {
      label: "Dúvida real",
      theme: `Uma dúvida frequente sobre ${focus}`,
      understanding: `Ajudar ${audience} a compreender um ponto importante sobre ${focus}, com clareza e sem inventar condições.`,
      situation: `Uma pessoa interessada em ${focus}, mas ainda insegura para decidir.`,
      current_belief: `Ela acredita que precisa entender tudo sozinha antes de procurar ${brandName}.`,
      desired_shift: `Perceber ${brandName} como apoio confiável para ${objectiveLabel}.`,
      cta: "Qual é a sua principal dúvida sobre esse assunto?",
    },
    {
      label: "Situação cotidiana",
      theme: `Uma situação que ${audience} vive antes de buscar ${focus}`,
      understanding: `Mostrar uma situação reconhecível e conectar o problema a uma orientação útil da marca.`,
      situation: `Um momento cotidiano em que a pessoa percebe uma necessidade relacionada a ${segment}.`,
      current_belief: `Ela trata essa situação como normal ou adia a decisão.`,
      desired_shift: `Perceber que existe uma forma mais clara e segura de agir.`,
      cta: "Isso também acontece com você?",
    },
    {
      label: "Novo olhar",
      theme: `Um novo olhar sobre ${focus}`,
      understanding: `Usar ${typeLabel} para corrigir uma percepção comum e apresentar o valor real da marca.`,
      situation: `O público compara opções sem considerar o que realmente importa para a decisão.`,
      current_belief: `A escolha depende apenas de preço ou de uma resposta rápida.`,
      desired_shift: `Entender os critérios e benefícios que tornam a escolha mais consciente.`,
      cta: `Converse com ${brandName} para entender o próximo passo.`,
    },
  ];
}

function Step({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
function Choice({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-orange-500 bg-orange-500/5 ring-2 ring-orange-500/15"
          : "hover:border-orange-500/40",
      )}
    >
      <div className="flex justify-between">
        <p className="font-semibold">{title}</p>
        {active && <Check className="h-4 w-4 text-orange-500" />}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
function ConceptCard({
  option,
  active,
  onClick,
}: {
  option: Post2ConceptOption;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-5 text-left transition",
        active
          ? "border-orange-500 bg-orange-500/5 ring-2 ring-orange-500/15"
          : "hover:-translate-y-0.5 hover:border-orange-500/40 hover:shadow-md",
      )}
    >
      <div className="flex justify-between">
        <Badge variant="outline">{option.label}</Badge>
        {active && <BadgeCheck className="h-5 w-5 text-orange-500" />}
      </div>
      <p className="mt-4 text-lg font-bold leading-tight">{option.title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{option.support_text}</p>
      <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Conceito</p>
        <p className="mt-1">{option.concept}</p>
        <p className="mt-3 font-semibold text-foreground">Visual</p>
        <p className="mt-1">{option.visual_direction}</p>
      </div>
      <p className="mt-4 text-sm font-semibold text-orange-500">{option.art_cta}</p>
    </button>
  );
}
function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
function Journey() {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <StatusPill label="Conteúdo" ok />
      <StatusPill label="Prompt GPT" ok />
      <StatusPill label="Arte final" ok={false} />
      <StatusPill label="Aprovação e calendário" ok={false} />
    </div>
  );
}
function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border p-3 text-sm",
        ok ? "border-emerald-500/30 bg-emerald-500/5" : "bg-muted/20",
      )}
    >
      <span
        className={cn("h-2.5 w-2.5 rounded-full", ok ? "bg-emerald-500" : "bg-muted-foreground/35")}
      />
      <span>{label}</span>
    </div>
  );
}
function Stage({ icon: Icon, title, text }: { icon: typeof Upload; title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <Icon className="h-5 w-5 text-orange-500" />
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || "—"}</p>
    </div>
  );
}
function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label}
        {required && <span className="ml-1 text-orange-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
function CopyAction({
  text,
  children,
  variant = "default",
}: {
  text: string;
  children: ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        toast.success("Conteúdo copiado.");
      }}
    >
      <Copy className="mr-1 h-4 w-4" />
      {children}
    </Button>
  );
}
