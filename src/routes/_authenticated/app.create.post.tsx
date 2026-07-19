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
  buildPost2NoIdeaSuggestions,
  clearPost2Draft,
  createPost2Draft,
  exportPost2Json,
  generatePost2Result,
  getSelectedPost2Title,
  loadPost2Draft,
  savePost2Draft,
  type Post2ConceptOption,
  type Post2IdeaSuggestion,
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

const STEP_LABELS = ["Entrada", "Marca", "Objetivo", "Tipo", "Direção", "Peça", "Resumo"] as const;
type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function CreatePost2() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState<StepIndex>(0);
  const [draft, setDraft] = useState<Post2Draft>(() => createPost2Draft());
  const [pieceGenerationRound, setPieceGenerationRound] = useState(0);

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
    () => buildPost2NoIdeaSuggestions(selectedBrand, draft.objective, draft.editorial_type),
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
      const concepts = buildPost2ConceptOptions(draft, selectedBrand, pieceGenerationRound);
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
      {step === 5 && (
        <PieceStep
          draft={draft}
          patch={patch}
          brand={selectedBrand}
          onRegenerate={() => {
            const nextRound = pieceGenerationRound + 1;
            setPieceGenerationRound(nextRound);
            patch({
              concept_options: buildPost2ConceptOptions(draft, selectedBrand, nextRound),
              selected_concept_index: 0,
            });
            toast.success("Novas execuções criativas foram preparadas.");
          }}
        />
      )}
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
          <div className="flex flex-wrap gap-2">
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
            <Button
              onClick={() => saveForProduction.mutate()}
              disabled={saveForProduction.isPending}
            >
              {saveForProduction.isPending ? "Criando projeto..." : "Criar projeto e anexar arte"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
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
  suggestions: Post2IdeaSuggestion[];
}) {
  return (
    <Step
      title="Defina a ideia central e a promessa da peça"
      description="Como no Reel 2.0, esta etapa transforma o ponto de partida em uma ideia específica, uma promessa clara e observações para orientar a criação."
    >
      {draft.entry_mode === "no_ideas" && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">Sugestões para começar sem ideia pronta</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha um tema concreto de {brand?.name || "sua marca"}. Cada opção já traz a
                  promessa e o cuidado editorial, sem repetir a ficha institucional inteira.
                </p>
              </div>
              <Badge variant="outline">Estou sem ideias</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {suggestions.map((suggestion) => {
                const active = draft.theme === suggestion.idea;
                return (
                  <button
                    key={`${suggestion.label}-${suggestion.idea}`}
                    type="button"
                    onClick={() =>
                      patch({
                        theme: suggestion.idea,
                        understanding: suggestion.promise,
                        situation: suggestion.situation,
                        current_belief: suggestion.current_belief,
                        desired_shift: suggestion.desired_shift,
                        desired_reaction: suggestion.cta,
                        call_to_action: suggestion.cta,
                        restrictions: [draft.restrictions, suggestion.notes]
                          .filter(Boolean)
                          .join("\n"),
                        concept_options: [],
                        selected_concept_index: null,
                      })
                    }
                    className={cn(
                      "rounded-2xl border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-orange-500/60 hover:shadow-sm",
                      active && "border-orange-500 ring-2 ring-orange-500/15",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                        {suggestion.label}
                      </p>
                      {active && <Check className="h-4 w-4 shrink-0 text-orange-500" />}
                    </div>
                    <p className="mt-2 font-semibold leading-snug">{suggestion.idea}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{suggestion.promise}</p>
                    <div className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Por que faz sentido: </span>
                      {suggestion.why}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <Field label="Ideia central do Post" required>
              <Input
                value={draft.theme}
                onChange={(event) =>
                  patch({
                    theme: event.target.value,
                    concept_options: [],
                    selected_concept_index: null,
                  })
                }
                placeholder={`Ex.: uma dúvida real de ${brand?.audience || "seu público"}`}
              />
            </Field>
            <Field label="Promessa da peça" required>
              <Textarea
                rows={4}
                value={draft.understanding}
                onChange={(event) =>
                  patch({
                    understanding: event.target.value,
                    concept_options: [],
                    selected_concept_index: null,
                  })
                }
                placeholder="O que a pessoa vai entender ao ver este Post?"
              />
            </Field>
            <Field label="Observações extras para o Post">
              <Textarea
                rows={4}
                value={draft.situation}
                onChange={(event) => patch({ situation: event.target.value })}
                placeholder="Situação real, contexto, exemplo ou ponto que precisa aparecer."
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="CTA da publicação">
                <Textarea
                  rows={3}
                  value={draft.call_to_action}
                  onChange={(event) =>
                    patch({
                      call_to_action: event.target.value,
                      desired_reaction: event.target.value,
                    })
                  }
                  placeholder="Ex.: Quer entender como funciona? Fale com a gente."
                />
              </Field>
              <Field label="Informações obrigatórias">
                <Textarea
                  rows={3}
                  value={draft.mandatory_information}
                  onChange={(event) => patch({ mandatory_information: event.target.value })}
                  placeholder="Fatos, condições ou mensagens que precisam aparecer."
                />
              </Field>
            </div>
            <Field label="Cuidados e restrições">
              <Textarea
                rows={3}
                value={draft.restrictions}
                onChange={(event) => patch({ restrictions: event.target.value })}
                placeholder="O que o GPT não pode inventar, prometer ou representar?"
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-violet-500" /> Uma boa promessa de Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>É específica e cabe em uma única peça.</p>
            <p>Mostra o que a pessoa vai entender, não apenas o assunto da marca.</p>
            <p>Não repete a descrição institucional inteira.</p>
            <p>Não vira instrução visual nem texto técnico dentro da arte.</p>
            <p>Combina com o objetivo e com o caminho criativo escolhidos.</p>
          </CardContent>
        </Card>
      </div>
    </Step>
  );
}

function PieceStep({
  draft,
  patch,
  brand,
  onRegenerate,
}: {
  draft: Post2Draft;
  patch: (p: Partial<Post2Draft>) => void;
  brand: Tables<"brands"> | null;
  onRegenerate: () => void;
}) {
  return (
    <Step
      title="Escolha a execução criativa da peça"
      description="Como os ganchos do Reel 2.0, as três opções nascem da mesma ideia e promessa. Aqui, porém, cada uma define título, apoio, CTA e composição visual completos."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Notice
          title="Mesma ideia, três execuções diferentes"
          text="Compare pergunta direta, situação real e mudança de olhar. A opção escolhida será usada no texto da arte e no prompt do GPT."
        />
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Ver outra ordem de execuções
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {draft.concept_options.map((option, index) => (
          <ConceptCard
            key={`${option.label}-${option.title}-${index}`}
            option={option}
            active={draft.selected_concept_index === index}
            onClick={() => patch({ selected_concept_index: index })}
          />
        ))}
      </div>
      {draft.selected_concept_index !== null && (
        <Notice
          title="Execução escolhida"
          text="Na próxima etapa, revise o conteúdo final, copie o pedido para o GPT e crie o projeto para anexar a arte, aprovar e agendar."
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
  const selectedConcept = draft.concept_options[draft.selected_concept_index ?? 0];
  const objectiveLabel =
    POST2_OBJECTIVES.find((item) => item.id === draft.objective)?.label || "Não definido";
  const typeLabel =
    POST2_EDITORIAL_TYPES.find((item) => item.id === draft.editorial_type)?.label || "Não definido";
  const entryLabel =
    POST2_ENTRY_OPTIONS.find((item) => item.id === draft.entry_mode)?.label || "Não definida";

  return (
    <Step
      title="Revise o pacote antes de criar o projeto"
      description="Confira conteúdo, peça, publicação e pedido externo. Depois, crie o projeto para anexar a arte gerada no GPT e seguir para aprovação, agenda e publicação."
    >
      <PostJourney />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pacote revisado</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <Info label="Marca" value={brand?.name || "Não selecionada"} />
            <Info label="Entrada" value={entryLabel} />
            <Info label="Objetivo" value={objectiveLabel} />
            <Info label="Caminho criativo" value={typeLabel} />
            <Info label="Formato" value={`Feed ${draft.ratio}`} />
            <Info label="Execução escolhida" value={selectedConcept?.label || "Não definida"} />
            <div className="md:col-span-2">
              <Info label="Ideia central" value={draft.theme || "Não definida"} />
            </div>
            <div className="md:col-span-2">
              <Info label="Promessa da peça" value={draft.understanding || "Não definida"} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 font-semibold">
              <ArrowRight className="h-4 w-4 text-violet-500" /> Próximo passo
            </div>
            <p className="text-sm text-muted-foreground">
              Gere a arte no GPT com o pedido abaixo. Depois, crie o projeto para abrir o painel de
              anexo, aprovação e calendário.
            </p>
            <CopyAction text={layoutPrompt}>Copiar pedido para o GPT</CopyAction>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => window.open("https://chatgpt.com", "_blank", "noopener,noreferrer")}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Abrir ChatGPT
            </Button>
            <Button onClick={onSave} disabled={saving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Criando projeto..." : "Criar projeto e anexar arte"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-orange-500" /> Conteúdo aprovado da arte
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div
              className={cn(
                "mx-auto flex aspect-[4/5] w-full max-w-[250px] flex-col justify-between rounded-2xl border bg-gradient-to-br from-muted to-background p-5",
                draft.ratio === "1:1" && "aspect-square",
              )}
            >
              <div>
                {draft.badge_text && <Badge>{draft.badge_text}</Badge>}
                <h3 className="mt-5 text-2xl font-bold leading-tight">{title}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{draft.support_text}</p>
              </div>
              {draft.art_cta && (
                <p className="text-sm font-semibold text-orange-500">{draft.art_cta}</p>
              )}
            </div>
            <div className="space-y-4">
              <Field label="Título principal">
                <Input
                  value={title}
                  onChange={(event) =>
                    patch({ custom_title: event.target.value, selected_title_index: null })
                  }
                />
              </Field>
              <Field label="Texto de apoio">
                <Textarea
                  rows={3}
                  value={draft.support_text}
                  onChange={(event) => patch({ support_text: event.target.value })}
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Selo opcional">
                  <Input
                    value={draft.badge_text}
                    onChange={(event) => patch({ badge_text: event.target.value })}
                  />
                </Field>
                <Field label="CTA curto na arte">
                  <Input
                    value={draft.art_cta}
                    onChange={(event) => patch({ art_cta: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Direção visual">
                <Textarea
                  rows={6}
                  value={draft.visual_direction}
                  onChange={(event) => patch({ visual_direction: event.target.value })}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                A direção visual orienta o GPT, mas nunca deve aparecer como texto dentro da arte.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="h-4 w-4 text-orange-500" /> Publicação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Legenda da publicação">
              <Textarea
                rows={12}
                value={draft.caption}
                onChange={(event) => patch({ caption: event.target.value })}
              />
            </Field>
            <Field label="Hashtags — máximo 5">
              <Input
                value={draft.hashtags}
                onChange={(event) => patch({ hashtags: event.target.value })}
              />
            </Field>
            <CopyAction
              text={`${draft.caption}

${draft.hashtags}`}
            >
              Copiar publicação
            </CopyAction>
          </CardContent>
        </Card>
      </div>

      <Card className="border-violet-500/30 bg-violet-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-violet-500" /> Pedido externo Post 2.0
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copie este pedido, cole no ChatGPT e gere uma única arte. O texto estratégico foi
            separado do conteúdo publicável para impedir que instruções internas apareçam no layout.
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyAction text={layoutPrompt}>Copiar pedido</CopyAction>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open("https://chatgpt.com", "_blank", "noopener,noreferrer")}
            >
              Abrir ChatGPT
            </Button>
            <CopyAction text={jsonOutput} variant="outline">
              <FileJson2 className="mr-1 h-4 w-4" />
              Copiar JSON
            </CopyAction>
          </div>
          <Textarea value={layoutPrompt} readOnly rows={16} className="font-mono text-xs" />
        </CardContent>
      </Card>
    </Step>
  );
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
function PostJourney() {
  const steps = [
    {
      title: "1. Conteúdo",
      text: "Ideia, promessa e execução criativa definidas.",
      done: true,
      current: false,
    },
    {
      title: "2. Criação",
      text: "Pedido externo pronto para gerar a arte no GPT.",
      done: true,
      current: false,
    },
    {
      title: "3. Arte final",
      text: "Gerar a imagem e anexar ao projeto.",
      done: false,
      current: true,
    },
    {
      title: "4. Aprovação",
      text: "Enviar arte e publicação para revisão.",
      done: false,
      current: false,
    },
    {
      title: "5. Agenda e publicação",
      text: "Agendar depois da aprovação e publicar.",
      done: false,
      current: false,
    },
  ];
  return (
    <Card className="border-orange-500/25 bg-orange-500/5">
      <CardHeader>
        <CardTitle className="text-lg">Jornada depois da criação</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-5">
        {steps.map((item) => (
          <div
            key={item.title}
            className={cn(
              "rounded-xl border bg-background p-3 text-sm",
              item.done && "border-emerald-500/30 bg-emerald-500/5",
              item.current && "border-orange-500/50 bg-orange-500/5",
            )}
          >
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.text}</p>
            <Badge
              variant={item.done ? "default" : item.current ? "secondary" : "outline"}
              className="mt-3 text-[10px]"
            >
              {item.done ? "Pronto" : item.current ? "Agora" : "Depois"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
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
