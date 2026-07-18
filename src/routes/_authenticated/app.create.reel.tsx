import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Braces,
  Check,
  Clapperboard,
  CopyCheck,
  Film,
  FileJson2,
  Lightbulb,
  Megaphone,
  MessageCircle,
  MousePointer2,
  Palette,
  PlayCircle,
  RefreshCw,
  Route as RouteIcon,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { ImportReel2ScriptDialog } from "@/components/import-reel2-script-dialog";
import { Reel2ScriptStudio } from "@/components/reel2-script-studio";
import { Reel2PublishingPackage } from "@/components/reel2-publishing-package";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getAllPresets } from "@/lib/contentPresets";
import { buildPrompts, parsePiece } from "@/lib/promptBuilder";
import {
  createReel2Draft,
  getReel2BrandExamples,
  resetReel2GeneratedFields,
  REEL2_ENTRY_OPTIONS,
  REEL2_OBJECTIVES,
  REEL2_TYPES,
  REEL2_WIZARD_PREFILL_KEY,
  applyPresetToReelDraft,
  buildReel2WizardPrefill,
  clearReel2Draft,
  isReelPreset,
  loadReel2Draft,
  saveReel2Draft,
  snapshotBrand,
  type Reel2Draft,
  type Reel2EntryMode,
  type Reel2HookDraft,
  type Reel2Objective,
  type Reel2Type,
} from "@/lib/reel2";
import {
  buildReel2ExternalPrompt,
  convertImportedScriptHooks,
  findSelectedHookIndex,
  type Reel2ImportedScript,
  type Reel2ImportResult,
} from "@/lib/reel2Script";
import { reel2ToLegacyReelScript } from "@/lib/reel2Project";
import { analyzeReel2TopicContext, buildReel2TopicContextPrompt, labelEntityType, labelIntent } from "@/lib/reel2TopicContext";

export const Route = createFileRoute("/_authenticated/app/create/reel")({
  head: () => ({ meta: [{ title: "Criar Reel 2.0 — Cria Aí" }] }),
  component: CreateReel2,
});

const STEP_LABELS = ["Entrada", "Marca", "Objetivo", "Tipo", "Promessa", "Gancho", "Resumo"] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const entryIconMap: Record<Reel2EntryMode, typeof Lightbulb> = {
  idea: Lightbulb,
  no_ideas: Sparkles,
  preset: Wand2,
  remix: RefreshCw,
  trend: Megaphone,
  adapt_existing: CopyCheck,
};

function getCreateProjectErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const err = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [err.message, err.details, err.hint, err.code]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" · ");
  }
  return "Não foi possível criar o projeto.";
}

export function CreateReel2() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<StepIndex>(0);
  const [draft, setDraft] = useState<Reel2Draft>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("continuar") === "rascunho" || params.get("continueDraft") === "1") {
        return loadReel2Draft();
      }
    }
    return createReel2Draft();
  });
  const [importOpen, setImportOpen] = useState(false);
  const [, setHookGenerationRound] = useState(0);

  const { data: brands } = useQuery({
    queryKey: ["brands-reel2"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const presets = useMemo(() => getAllPresets().filter(isReelPreset), []);
  const selectedBrand = useMemo(
    () => brands?.find((brand) => brand.id === draft.brand_id) ?? null,
    [brands, draft.brand_id],
  );
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === draft.preset_id) ?? null,
    [presets, draft.preset_id],
  );
  const selectedObjective = REEL2_OBJECTIVES.find((objective) => objective.id === draft.objective);
  const selectedType = REEL2_TYPES.find((type) => type.id === draft.reel_type);
  const selectedHook = draft.selected_hook_index !== null ? draft.hook_options[draft.selected_hook_index] : null;
  const externalPrompt = useMemo(() => buildReel2ExternalPrompt(draft, selectedBrand), [draft, selectedBrand]);
  const brandExamples = useMemo(() => getReel2BrandExamples(selectedBrand), [selectedBrand]);
  const topicContext = useMemo(() => analyzeReel2TopicContext(draft, selectedBrand), [draft, selectedBrand]);

  useEffect(() => saveReel2Draft(draft), [draft]);

  const patch = (partial: Partial<Reel2Draft>) => setDraft((current) => ({ ...current, ...partial }));
  const patchHookSource = (partial: Partial<Reel2Draft>) => {
    setDraft((current) => {
      const next = { ...current, ...partial };
      if (!current.hook_options.length) return next;
      return {
        ...next,
        hook_options: [],
        selected_hook_index: null,
        hooks_context_key: "",
        hooks_need_regeneration: true,
      };
    });
  };

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(draft.entry_mode);
    if (step === 1) return Boolean(draft.brand_id);
    if (step === 2) return Boolean(draft.objective);
    if (step === 3) return Boolean(draft.reel_type);
    if (step === 4) return Boolean(draft.promise.trim() || getEntryMainIdea(draft).trim());
    if (step === 5) return draft.hook_options.length > 0;
    return true;
  }, [draft, step]);

  const progress = Math.round(((step + 1) / STEP_LABELS.length) * 100);

  const goNext = () => {
    if (!canContinue) {
      toast.error("Complete esta etapa antes de continuar.");
      return;
    }
    setStep((current) => Math.min(6, current + 1) as StepIndex);
  };

  const goBack = () => setStep((current) => Math.max(0, current - 1) as StepIndex);

  const onGenerateHooks = () => {
    setHookGenerationRound((currentRound) => {
      const nextRound = currentRound + 1;
      const options = buildLocalHookOptions(draft, selectedBrand, nextRound);
      patch({
        hook_options: options,
        selected_hook_index: 0,
        hooks_context_key: buildHookContextKey(draft, selectedBrand),
        hooks_need_regeneration: false,
      });
      toast.success(nextRound === 1 ? "3 opções de gancho foram preparadas." : "Novas opções de gancho foram preparadas.");
      return nextRound;
    });
  };

  const onUsePreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    setDraft((current) => applyPresetToReelDraft({ ...current, preset_id: presetId }, preset));
    toast.success("Preset aplicado ao rascunho do Reel.");
  };

  const onImportScript = (script: Reel2ImportedScript, raw: string, result: Reel2ImportResult) => {
    const hooks = convertImportedScriptHooks(script);
    setDraft((current) => ({
      ...current,
      imported_script: script,
      imported_script_raw: raw,
      imported_script_imported_at: new Date().toISOString(),
      imported_script_source_schema: result.sourceSchema || script.schema_version,
      imported_script_warnings: result.warnings,
      imported_script_updated_at: new Date().toISOString(),
      imported_script_needs_review: false,
      central_idea: script.central_idea || current.central_idea,
      promise: script.promise || current.promise,
      hook_options: hooks.length ? hooks : current.hook_options,
      selected_hook_index: hooks.length ? findSelectedHookIndex(script) : current.selected_hook_index,
      hooks_context_key: hooks.length ? buildScriptHookContextKey(script) : current.hooks_context_key,
      hooks_need_regeneration: false,
      cover_mode: script.cover.needs_cover ? "custom" : current.cover_mode,
    }));
    toast.success("JSON Reel 2.0 importado para o rascunho.");
  };

  const onUpdateImportedScript = (script: Reel2ImportedScript) => {
    setDraft((current) => ({
      ...current,
      imported_script: script,
      imported_script_updated_at: new Date().toISOString(),
      imported_script_needs_review: true,
      central_idea: script.central_idea || current.central_idea,
      promise: script.promise || current.promise,
      hook_options: convertImportedScriptHooks(script),
      selected_hook_index: findSelectedHookIndex(script),
      hooks_context_key: buildScriptHookContextKey(script),
      hooks_need_regeneration: false,
      cover_mode: script.cover.needs_cover ? "custom" : current.cover_mode,
    }));
  };

  const createProjectFromReel2 = useMutation({
    mutationFn: async () => {
      if (!selectedBrand) throw new Error("Selecione uma marca antes de criar o projeto.");
      const script = draft.imported_script;
      if (!script) throw new Error("Importe e revise o JSON Reel 2.0 antes de criar o projeto.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado.");

      const legacyScript = reel2ToLegacyReelScript(script, selectedBrand);
      const formats = script.cover.needs_cover || script.cover.mode === "custom" ? ["reel", "capa_reel"] : ["reel"];
      const payload = {
        user_id: u.user.id,
        brand_id: selectedBrand.id,
        internal_title: `Reel 2.0 — ${script.central_idea}`.slice(0, 160),
        display_title: script.central_idea.slice(0, 120),
        theme: script.central_idea,
        objective: draft.objective || "educar",
        specific_audience: selectedBrand.audience || null,
        audience_problem: selectedBrand.audience_difficulties || null,
        main_message: script.promise,
        mandatory_information: [
          `Gancho escolhido: ${script.selected_hook.spoken_hook}`,
          `Legenda completa para inserir no vídeo: ${script.short_version.full_video_caption}`,
          `Tipo de Reel: ${script.reel_type}`,
        ].join("\n"),
        call_to_action: script.publication.cta || null,
        desired_style: `${script.reel_type} · Reel 2.0 guiado com gancho, promessa, cenas, capa e publicação.`,
        restrictions: selectedBrand.forbidden_inventions || "Não copiar referências externas. Usar referências apenas para aprender estrutura.",
        notes: [
          "Origem: Criar Reel 2.0 — projeto criado direto do módulo guiado.",
          `Promessa: ${script.promise}`,
          `Gancho: ${script.selected_hook.spoken_hook}`,
          `Capa: ${script.cover.mode}`,
          `CTA: ${script.publication.cta}`,
        ].join("\n"),
        selected_formats: formats,
        selected_outputs: ["roteiro_reel", "legenda_completa", "hashtags"],
        generation_mode: "safe" as const,
        status: "draft" as const,
        content_source: "external_chatgpt",
        content_development_status: "script_imported" as const,
        campaign_content_json: {
          source: "reel_2_0",
          reel2: script,
          caption: { text: script.publication.caption, hashtags: script.publication.hashtags },
          pieces: [],
          created_at: new Date().toISOString(),
        },
        imported_at: draft.imported_script_imported_at || new Date().toISOString(),
      };

      const { data: project, error } = await supabase.from("content_projects").insert(payload).select("*").single();
      if (error) throw error;

      const result = buildPrompts({ brand: selectedBrand, project: project as any });
      const rows = result.blocks.map((block, index) => {
        const piece = block.key === "piece" ? parsePiece(block.content) : null;
        const isReelScript = piece?.formatKey === "reel" && piece.role === "roteiro";
        const isReelCaption = piece?.formatKey === "reel" && piece.role === "legenda";
        const isReelCover = piece?.formatKey === "reel" && piece.role === "capa";
        let title = block.title;
        let content = block.content;

        if (piece && isReelScript) {
          const updatedPiece = {
            ...piece,
            name: "Reel 2.0 — Roteiro completo",
            objective: "roteiro completo do vídeo, importado do fluxo guiado Reel 2.0",
            mainText: script.central_idea,
            supportText: script.promise,
            bullets: script.main_script.scenes.map((scene) => `${scene.start}-${scene.end}s · ${scene.function}: ${scene.speech}`).slice(0, 10),
            cta: script.publication.cta,
            contentStage: "script_complete",
            copySource: "external_chatgpt",
            qualityStatus: "approved",
            qualityIssues: undefined,
            readyPrompt: "Roteiro Reel 2.0 já importado. Use o bloco de roteiro, versão reduzida, capa, publicação e storyboard nesta página.",
          };
          title = updatedPiece.name;
          content = JSON.stringify(updatedPiece);
        }

        if (piece && isReelCaption) {
          const updatedPiece = {
            ...piece,
            name: "Reel 2.0 — Legenda da publicação",
            mainText: "",
            supportText: "",
            bullets: [],
            caption: script.publication.caption,
            hashtags: script.publication.hashtags,
            cta: script.publication.cta,
            contentStage: "publication_copy",
            copySource: "external_chatgpt",
            qualityStatus: "approved",
            qualityIssues: undefined,
            readyPrompt: [`Texto da publicação — Legenda do Reel 2.0.`, ``, script.publication.caption, script.publication.hashtags.join(" ")].filter(Boolean).join("\n"),
          };
          title = updatedPiece.name;
          content = JSON.stringify(updatedPiece);
        }

        if (piece && isReelCover) {
          const coverMode = script.cover.needs_cover || script.cover.mode === "custom" ? "capa personalizada" : script.cover.mode === "frame" ? "frame do vídeo" : "a definir";
          const updatedPiece = {
            ...piece,
            name: "Reel 2.0 — Capa / frame",
            mainText: script.cover.title || script.selected_hook.on_screen_text || script.central_idea,
            supportText: script.cover.subtitle || `Modo: ${coverMode}`,
            cta: "",
            productionNotes: [
              script.cover.needs_cover || script.cover.mode === "custom" ? "Criar capa personalizada 9:16 respeitando área segura." : "Escolher frame do próprio vídeo; não criar capa nova se o modo for frame.",
              script.cover.safe_area_notes || "Manter título legível na área central superior.",
            ],
            copySource: "external_chatgpt",
            readyPrompt: script.cover.needs_cover || script.cover.mode === "custom" ? script.cover.visual_prompt || piece.readyPrompt : `Usar frame do próprio vídeo como capa. Frame sugerido: ${script.selected_hook.scene_suggestion}. Título de apoio: ${script.cover.title || script.central_idea}.`,
          };
          title = updatedPiece.name;
          content = JSON.stringify(updatedPiece);
        }

        const isReel2Output = Boolean(isReelScript || isReelCaption || isReelCover);

        return {
          project_id: project.id,
          user_id: u.user!.id,
          output_type: block.key,
          title,
          original_content: content,
          display_order: index,
          imported_content: isReelScript
            ? (legacyScript as any)
            : isReelCaption
              ? ({ caption: script.publication.caption, hashtags: script.publication.hashtags, cta: script.publication.cta, source_schema: "reel_2_0" } as any)
              : isReelCover
                ? ({ cover: script.cover, source_schema: "reel_2_0" } as any)
                : null,
          // Importante: em insert em lote no PostgREST, todos os objetos precisam ter as mesmas chaves.
          // Antes, alguns outputs ficavam com source/copy_status/version como undefined, o que podia quebrar
          // a criação do projeto com erro genérico. Mantemos valores explícitos em todas as linhas.
          source: isReel2Output ? "external_chatgpt" : "auto",
          copy_status: isReel2Output ? "review" : "approved",
          version: 1,
        };
      });
      if (rows.length) {
        const { error: rowsError } = await supabase.from("content_outputs").insert(rows);
        if (rowsError) throw rowsError;
      }
      return project.id as string;
    },
    onSuccess: (projectId) => {
      clearReel2Draft();
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Projeto Reel 2.0 criado.");
      navigate({ to: "/app/content/$projectId/result", params: { projectId } });
    },
    onError: (error) => {
      const message = getCreateProjectErrorMessage(error);
      console.error("Erro ao criar projeto Reel 2.0", error);
      toast.error(message);
    },
  });

  const onContinueToClassicWizard = () => {
    try {
      localStorage.setItem(REEL2_WIZARD_PREFILL_KEY, JSON.stringify(buildReel2WizardPrefill(draft, selectedBrand)));
      toast.success("Rascunho enviado para o wizard atual.");
      window.location.assign("/app/content/new");
    } catch {
      toast.error("Não foi possível preparar o wizard atual.");
    }
  };

  const onReset = () => {
    clearReel2Draft();
    setDraft(createReel2Draft());
    setStep(0);
    toast.success("Rascunho do Reel 2.0 limpo.");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-3xl border bg-gradient-to-br from-orange-500/15 via-background to-violet-500/10 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-orange-500 text-white hover:bg-orange-500">
Fase 6 · Cria Aí 2.0
              </Badge>
              <Badge variant="secondary" className="rounded-full">
Produção e vídeo final
              </Badge>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Criar Reel</h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Transforme uma ideia em vídeo curto com gancho, promessa, estrutura e caminho de produção.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app/create">
                <ArrowLeft className="mr-1 h-4 w-4" /> Oficina Criativa
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onReset}>
              Limpar rascunho
            </Button>
          </div>
        </div>
      </header>

      <Reel2JourneyProgress step={step} progress={progress} onSelectStep={(nextStep) => setStep(nextStep)} />

      <main className="space-y-4">
          {step === 0 && (
            <StepShell
              eyebrow="Entrada"
              title="Como você quer começar este Reel?"
              description="Escolha o ponto de partida. O resto do fluxo continua guiado, sem jogar todos os campos na tela de uma vez."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {REEL2_ENTRY_OPTIONS.map((option) => {
                  const Icon = entryIconMap[option.id];
                  const active = draft.entry_mode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => patch({ entry_mode: option.id })}
                      className={cn(
                        "group min-h-44 rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg",
                        active ? "border-orange-500 ring-2 ring-orange-500/20" : "border-border/70 hover:border-orange-500/50",
                      )}
                    >
                      <div className="flex h-full flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn(
                            "grid h-11 w-11 place-items-center rounded-2xl",
                            active ? "bg-orange-500 text-white" : "bg-orange-500/10 text-orange-600 dark:text-orange-400",
                          )}>
                            <Icon className="h-5 w-5" />
                          </span>
                          {active && <BadgeCheck className="h-5 w-5 text-orange-500" />}
                        </div>
                        <div>
                          <h3 className="font-semibold">{option.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                        </div>
                        <p className="mt-auto text-xs text-muted-foreground">{option.helper}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <EntryFields draft={draft} patch={patch} patchHookSource={patchHookSource} presets={presets} onUsePreset={onUsePreset} />
            </StepShell>
          )}

          {step === 1 && (
            <StepShell
              eyebrow="Marca"
              title="Para qual marca este Reel será criado?"
              description="A marca define nicho, tom, público, restrições e CTAs. Essa etapa evita misturar linguagem de viagem, comportamento canino, atelier ou outros segmentos."
            >
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">1. Escolha a marca</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-5 pt-0">
                    <div className="space-y-2">
                      <Label>Marca</Label>
                      <Select
                        value={draft.brand_id}
                        onValueChange={(brandId) => {
                          const brand = brands?.find((item) => item.id === brandId);
                          setDraft((current) => {
                            const brandChanged = Boolean(current.brand_id && current.brand_id !== brandId);
                            const base = {
                              ...current,
                              brand_id: brandId,
                              brand_snapshot: snapshotBrand(brand),
                            };
                            return brandChanged ? resetReel2GeneratedFields(base) : base;
                          });
                          toast.success("Marca aplicada. Exemplos e próximas sugestões foram ajustados para este nicho.");
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a marca" />
                        </SelectTrigger>
                        <SelectContent>
                          {(brands ?? []).map((brand) => (
                            <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
                      <p className="font-medium text-amber-700 dark:text-amber-300">Regra crítica do Reel 2.0</p>
                      <p className="mt-1 text-muted-foreground">
                        O gerador precisa respeitar o nicho da marca. Comportamento canino não deve receber títulos de pacote turístico; viagem pode falar de roteiro, orçamento e planejamento.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <BrandSnapshot brand={selectedBrand} />
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell
              eyebrow="Objetivo"
              title="O que este Reel precisa fazer?"
              description="O objetivo define o que a pessoa deve sentir ou fazer depois de assistir."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {REEL2_OBJECTIVES.map((objective) => {
                  const active = draft.objective === objective.id;
                  return (
                    <ChoiceCard
                      key={objective.id}
                      active={active}
                      title={objective.title}
                      description={objective.description}
                      icon={objectiveIcon(objective.id)}
                      onClick={() => {
                        const currentType = draft.reel_type;
                        const suggested = objective.suggestedTypes[0];
                        patchHookSource({ objective: objective.id, reel_type: currentType || suggested });
                      }}
                    />
                  );
                })}
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell
              eyebrow="Tipo de Reel"
              title="Qual estrutura combina melhor com este conteúdo?"
              description="O tipo de Reel define a lógica narrativa. Isso evita roteiro solto e melhora gancho, retenção e CTA."
            >
              <div className="space-y-5">
                <ReelTypeGroup
                  title={selectedObjective ? `Recomendados para ${selectedObjective.title}` : "Recomendados para começar"}
                  description="Estes tipos combinam melhor com o objetivo escolhido e ficam visíveis primeiro, mesmo quando antes estariam em ‘ver mais’."
                  types={getRecommendedTypes(selectedObjective)}
                  selectedType={draft.reel_type}
                  recommendedIds={selectedObjective?.suggestedTypes ?? []}
                  onSelect={(typeId) => patchHookSource({ reel_type: typeId })}
                />

                <ReelTypeGroup
                  title="Outros tipos de Reel"
                  description="Use quando a ideia pedir outro caminho narrativo. Eles continuam disponíveis, mas não disputam a primeira decisão."
                  types={getOtherTypes(selectedObjective)}
                  selectedType={draft.reel_type}
                  recommendedIds={selectedObjective?.suggestedTypes ?? []}
                  onSelect={(typeId) => patchHookSource({ reel_type: typeId })}
                />
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell
              eyebrow="Promessa"
              title="O que a pessoa ganha assistindo até o final?"
              description="A promessa é o motivo para continuar assistindo. Ela precisa ser específica, útil e coerente com o nicho."
            >
              {draft.entry_mode === "no_ideas" && (
                <NoIdeasReelSuggestions
                  brand={selectedBrand}
                  objective={draft.objective}
                  reelType={draft.reel_type}
                  onSelect={(suggestion) =>
                    patchHookSource({
                      central_idea: suggestion.idea,
                      promise: suggestion.promise,
                      extra_notes: suggestion.notes,
                      topic_entity: suggestion.topic,
                      topic_entity_type: suggestion.topicType,
                      topic_associations: suggestion.associations,
                      topic_cautions: suggestion.cautions,
                      topic_do_not_invent: suggestion.doNotInvent,
                    })
                  }
                />
              )}

              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="space-y-2">
                      <Label>Ideia central do Reel</Label>
                      <Input
                        value={draft.central_idea}
                        onChange={(event) => patchHookSource({ central_idea: event.target.value })}
                        placeholder={brandExamples.ideaPlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Promessa do vídeo</Label>
                      <Textarea
                        value={draft.promise}
                        onChange={(event) => patchHookSource({ promise: event.target.value })}
                        placeholder={brandExamples.promisePlaceholder}
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Observações extras para o Reel</Label>
                      <Textarea
                        value={draft.extra_notes}
                        onChange={(event) => patchHookSource({ extra_notes: event.target.value })}
                        placeholder={brandExamples.extraNotesPlaceholder}
                        rows={4}
                      />
                    </div>

                    <TopicContextPanel
                      draft={draft}
                      brand={selectedBrand}
                      context={topicContext}
                      patchHookSource={patchHookSource}
                    />
                  </CardContent>
                </Card>

                <GuidanceCard
                  title="Promessa boa"
                  icon={Target}
                  items={[
                    "É curta e específica.",
                    "Mostra o ganho de assistir até o final.",
                    "Não promete resultado impossível.",
                    "Combina com o objetivo escolhido.",
                    `Exemplo para esta marca: ${brandExamples.promisePlaceholder.replace(/^Ex\.:\s*/i, "")}`,
                  ]}
                />
              </div>
            </StepShell>
          )}

          {step === 5 && (
            <StepShell
              eyebrow="Gancho"
              title="Construa os 3 primeiros segundos"
              description="O gancho é a frase, cena ou texto inicial que faz a pessoa decidir continuar assistindo."
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-4">
                <div className="max-w-2xl">
                  <p className="font-medium">Prepare 3 opções de gancho conectadas à promessa</p>
                  <p className="text-sm text-muted-foreground">
                    Os ganchos devem nascer da marca, objetivo, tipo de Reel, promessa e contexto do tema. Se eles parecerem genéricos, volte na promessa ou enriqueça o contexto.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Base atual: <span className="font-medium text-foreground">{topicContext.summary || draft.promise || getEntryMainIdea(draft) || "promessa ainda não definida"}</span>
                  </p>
                </div>
                <Button onClick={onGenerateHooks} className="gap-2">
                  <Sparkles className="h-4 w-4" /> {draft.hook_options.length ? "Gerar novas opções com esta promessa" : "Gerar opções"}
                </Button>
              </div>

              {draft.hooks_need_regeneration && (
                <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">A promessa, ideia ou observações mudaram.</p>
                    <p className="text-muted-foreground">Gere novos ganchos para evitar que os primeiros segundos falem de outro assunto.</p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-3">
                {draft.hook_options.map((hook, index) => (
                  <HookCard
                    key={`${hook.mode}-${index}`}
                    hook={hook}
                    active={draft.selected_hook_index === index}
                    onSelect={() => patch({ selected_hook_index: index })}
                    onChange={(next) => {
                      const hookOptions = draft.hook_options.map((item, itemIndex) => itemIndex === index ? next : item);
                      patch({ hook_options: hookOptions });
                    }}
                  />
                ))}
              </div>

              {!draft.hook_options.length && (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    Clique em <strong>Gerar opções</strong> para montar a estrutura inicial de gancho direto, curioso e de alerta.
                  </CardContent>
                </Card>
              )}
            </StepShell>
          )}

          {step === 6 && (
            <StepShell
              eyebrow="Resumo da Fase 5"
              title="Pacote de Reel pronto para virar projeto"
              description="Revise roteiro, capa, publicação e crie o projeto profissional do Reel 2.0."
            >
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Resumo do Reel</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <SummaryRow label="Marca" value={selectedBrand?.name || "Não selecionada"} />
                      <SummaryRow label="Entrada" value={REEL2_ENTRY_OPTIONS.find((item) => item.id === draft.entry_mode)?.title || "Não definida"} />
                      <SummaryRow label="Objetivo" value={selectedObjective?.title || draft.imported_script?.objective || "Não definido"} />
                      <SummaryRow label="Tipo" value={selectedType?.title || draft.imported_script?.reel_type || "Não definido"} />
                      <SummaryRow label="Ideia" value={draft.imported_script?.central_idea || getEntryMainIdea(draft) || "Não definida"} />
                      <SummaryRow label="Promessa" value={draft.imported_script?.promise || draft.promise || "Não definida"} />
                      <SummaryRow label="Gancho escolhido" value={draft.imported_script?.selected_hook?.spoken_hook || selectedHook?.spoken_hook || selectedHook?.on_screen_text || "Não escolhido"} />
                      <SummaryRow label="Capa" value={draft.imported_script?.cover?.needs_cover ? "Capa personalizada sugerida" : coverModeLabel(draft.cover_mode)} />
                    </CardContent>
                  </Card>

                  <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-2 font-semibold">
                      <RouteIcon className="h-4 w-4 text-orange-500" /> Caminho de continuidade
                    </div>
                    <p className="text-sm text-muted-foreground">
Com o JSON importado e o pacote revisado, o Cria Aí cria um projeto com roteiro, legenda do vídeo, capa, publicação, CTA, hashtags e storyboard conectados à aprovação.
                    </p>
                    <Button onClick={() => createProjectFromReel2.mutate()} disabled={createProjectFromReel2.isPending || !draft.imported_script} className="w-full gap-2">
                      Criar projeto com este Reel <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/app/create">Voltar para Criar</Link>
                    </Button>
                  </CardContent>
                </Card>
                </div>

                <Card className="border-violet-500/30 bg-violet-500/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Braces className="h-5 w-5 text-violet-500" /> Pedido externo Reel 2.0
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Copie este pedido, cole no ChatGPT e importe aqui o JSON devolvido. O app não usa IA interna nem API paga.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton text={externalPrompt} label="Copiar pedido" />
                      <Button type="button" variant="outline" onClick={() => window.open("https://chatgpt.com", "_blank", "noopener,noreferrer")}>
                        Abrir ChatGPT
                      </Button>
                      <Button type="button" onClick={() => setImportOpen(true)}>
                        <FileJson2 className="mr-2 h-4 w-4" /> Importar JSON
                      </Button>
                    </div>
                    <Textarea value={externalPrompt} readOnly rows={8} className="font-mono text-xs" />
                  </CardContent>
                </Card>

                {draft.imported_script && (
                  <>
                    <Reel2ScriptStudio
                      script={draft.imported_script}
                      warnings={draft.imported_script_warnings || []}
                      needsReview={Boolean(draft.imported_script_needs_review)}
                      onChange={onUpdateImportedScript}
                    />
                    <Reel2PublishingPackage
                      script={draft.imported_script}
                      brand={selectedBrand}
                      onChange={onUpdateImportedScript}
                    />
                  </>
                )}
              </div>
            </StepShell>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={goBack} disabled={step === 0}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => toast.success("Rascunho salvo no navegador.")}>
                <Save className="mr-1 h-4 w-4" /> Salvar
              </Button>
              {step < 6 ? (
                <Button onClick={goNext} disabled={!canContinue}>
                  Continuar <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => createProjectFromReel2.mutate()} disabled={createProjectFromReel2.isPending || !draft.imported_script}>
                  Criar projeto com este Reel <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
      </main>
    <ImportReel2ScriptDialog open={importOpen} onOpenChange={setImportOpen} onImport={onImportScript} />
    </div>
  );
}

const STEP_TIME_LABELS = ["1 min", "1 min", "1 min", "2 min", "4 min", "3 min", "6–10 min"] as const;

function estimateReel2Time(step: StepIndex) {
  if (step <= 1) return "15–20 min";
  if (step <= 3) return "10–15 min";
  if (step === 4) return "8–12 min";
  if (step === 5) return "6–10 min";
  return "3–5 min";
}

function Reel2JourneyProgress({
  step,
  progress,
  onSelectStep,
}: {
  step: StepIndex;
  progress: number;
  onSelectStep: (step: StepIndex) => void;
}) {
  return (
    <Card className="border-orange-500/20 bg-card/80">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Jornada de criação do Reel</p>
            <p className="text-xs text-muted-foreground">
              Avance por etapas curtas: ideia, marca, objetivo, promessa, gancho e pacote final.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{progress}% concluído</Badge>
            <Badge className="bg-amber-500 text-black hover:bg-amber-500">Tempo estimado: {estimateReel2Time(step)}</Badge>
          </div>
        </div>
        <Progress value={progress} />
        <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {STEP_LABELS.map((label, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => onSelectStep(index as StepIndex)}
                className={cn(
                  "flex min-h-16 flex-col items-start gap-1 rounded-2xl border p-3 text-left text-xs transition",
                  active
                    ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                    : done
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-background hover:border-orange-500/50 hover:bg-orange-500/5",
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold",
                    active ? "bg-white/20 text-white" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="font-medium">{label}</span>
                <span className="text-[10px] opacity-75">{STEP_TIME_LABELS[index]}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type ReelIdeaSuggestion = {
  label: string;
  idea: string;
  promise: string;
  notes: string;
  topic: string;
  topicType: string;
  associations: string;
  cautions: string;
  doNotInvent: string;
};

function NoIdeasReelSuggestions({
  brand,
  objective,
  reelType,
  onSelect,
}: {
  brand?: Tables<"brands"> | null;
  objective: Reel2Objective | "";
  reelType: Reel2Type | "";
  onSelect: (suggestion: ReelIdeaSuggestion) => void;
}) {
  const suggestions = useMemo(() => buildNoIdeasReelSuggestions(brand, objective, reelType), [brand, objective, reelType]);
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold">Sugestões para começar sem ideia pronta</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha um subtópico da marca para preencher ideia, promessa e contexto inicial do Reel.
            </p>
          </div>
          <Badge variant="outline">Estou sem ideias</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => onSelect(suggestion)}
              className="rounded-2xl border bg-background p-3 text-left transition hover:-translate-y-0.5 hover:border-orange-500/60 hover:shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">{suggestion.label}</p>
              <p className="mt-1 text-sm font-semibold leading-snug">{suggestion.idea}</p>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{suggestion.promise}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function buildNoIdeasReelSuggestions(
  brand?: Pick<Tables<"brands">, "name" | "segment" | "description" | "audience"> | null,
  objective?: Reel2Objective | "",
  reelType?: Reel2Type | "",
): ReelIdeaSuggestion[] {
  const text = `${brand?.name ?? ""} ${brand?.segment ?? ""} ${brand?.description ?? ""} ${brand?.audience ?? ""}`.toLowerCase();
  const baseDoNotInvent = "preços, datas, disponibilidade, atrações específicas, promessas ou resultados não confirmados";
  if (/viagem|turismo|travel|hotel|destino|férias|roteiro|passagem/.test(text)) {
    return [
      {
        label: "Destino pelo estilo",
        idea: "Como escolher o que fazer em um destino considerando o seu ritmo de viagem",
        promise: "Você vai entender como organizar experiências de viagem de acordo com descanso, descoberta ou conexão, sem depender de um roteiro genérico.",
        notes: "Não citar preços, disponibilidade ou atrações específicas sem confirmação. Convidar o público a comentar o destino que está considerando.",
        topic: "roteiro de viagem por estilo",
        topicType: "destino",
        associations: "descanso, descoberta, conexão, planejamento, prioridade, experiência",
        cautions: "evitar lista de atrações específicas sem confirmação; evitar promessa de menor preço",
        doNotInvent: baseDoNotInvent,
      },
      {
        label: "Planejamento seguro",
        idea: "O que confirmar antes de escolher passeios e experiências em uma viagem",
        promise: "Você vai saber quais pontos conferir para montar uma viagem com mais tranquilidade e menos decisões no impulso.",
        notes: "Focar em orientação geral: acesso, funcionamento, reserva, perfil do grupo e ritmo da viagem.",
        topic: "planejamento de viagem",
        topicType: "servico",
        associations: "checklist, organização, imprevistos, grupo, prioridades, tranquilidade",
        cautions: "não afirmar regras de estabelecimentos; não citar horários ou preços",
        doNotInvent: baseDoNotInvent,
      },
      {
        label: "Comentário do público",
        idea: "Qual tipo de experiência combina mais com a sua próxima viagem?",
        promise: "Você vai ver opções de abordagem para pensar a viagem pelo que deseja viver, e não apenas pelo destino mais famoso.",
        notes: "Usar CTA de comentário. Não pressionar venda; a marca pode aparecer como apoio no planejamento.",
        topic: "experiência de viagem",
        topicType: "outro",
        associations: "família, casal, descanso, aventura leve, descoberta, propósito",
        cautions: "evitar generalizações sobre o destino; evitar promessa emocional exagerada",
        doNotInvent: baseDoNotInvent,
      },
    ];
  }
  if (/cachorro|canino|adestra|comportamento animal|pet|tutor/.test(text)) {
    return [
      {
        label: "Sinais antes da reação",
        idea: "Seu cachorro avisa antes de reagir — mas você pode não perceber",
        promise: "Você vai conhecer sinais discretos de desconforto que podem aparecer antes de uma reação mais intensa.",
        notes: "Orientar sem culpar o tutor. Não prometer correção imediata nem diagnóstico individual.",
        topic: "sinais de desconforto canino",
        topicType: "comportamento",
        associations: "desviar olhar, lamber focinho, bocejar, corpo rígido, distância, rosnado",
        cautions: "não diagnosticar; não prometer resultado; não incentivar punição",
        doNotInvent: "diagnóstico, tempo de correção, garantia de comportamento, orientação médica ou veterinária específica",
      },
      {
        label: "Erro cotidiano",
        idea: "O comportamento que o tutor reforça sem perceber",
        promise: "Você vai entender como uma resposta comum do tutor pode ensinar o cachorro a repetir o comportamento indesejado.",
        notes: "Usar exemplo cotidiano e uma orientação prática, sem julgamento.",
        topic: "reforço involuntário",
        topicType: "comportamento",
        associations: "atenção, pular, latir, contato visual, toque, rotina",
        cautions: "evitar culpabilizar o tutor; evitar técnica agressiva",
        doNotInvent: "resultado garantido, diagnóstico, prazo de melhora",
      },
      {
        label: "Passeio com mais clareza",
        idea: "O passeio começa antes da guia sair do gancho",
        promise: "Você vai perceber por que alguns desafios do passeio podem começar antes mesmo de sair de casa.",
        notes: "Explicar comportamento de forma acessível e segura.",
        topic: "rotina antes do passeio",
        topicType: "comportamento",
        associations: "guia, porta, ansiedade, rotina, antecipação, calma",
        cautions: "não prometer obediência; não tratar como teimosia",
        doNotInvent: "resultado garantido, diagnóstico, método único",
      },
    ];
  }
  if (/atelier|costura|bolsa|artesanal|moda|acessório/.test(text)) {
    return [
      {
        label: "Detalhe artesanal",
        idea: "O detalhe que muda a percepção de uma peça artesanal",
        promise: "Você vai entender como acabamento, material e proporção influenciam a experiência de uso de uma peça artesanal.",
        notes: "Valorizar processo e escolha consciente sem exagerar promessa de durabilidade.",
        topic: "detalhes de peça artesanal",
        topicType: "produto",
        associations: "acabamento, costura, material, proporção, elegância, uso diário",
        cautions: "não prometer durabilidade absoluta; não comparar marcas sem base",
        doNotInvent: "preços, estoque, prazo, garantia não informada",
      },
      {
        label: "Bastidor de criação",
        idea: "Como uma peça começa antes da costura",
        promise: "Você vai ver como escolhas de material, uso e acabamento orientam uma criação artesanal.",
        notes: "Mostrar processo de forma visual e elegante.",
        topic: "processo de criação artesanal",
        topicType: "produto",
        associations: "molde, tecido, acabamento, escolha, rotina, bastidor",
        cautions: "evitar revelar informação sensível de cliente; não prometer peça sob medida sem confirmação",
        doNotInvent: "preço, prazo, disponibilidade, medidas específicas",
      },
      {
        label: "Escolha consciente",
        idea: "Como escolher uma bolsa que combina com sua rotina",
        promise: "Você vai entender pontos simples para escolher uma peça que faça sentido para seu uso, estilo e necessidade.",
        notes: "Foco em orientação e desejo, sem venda agressiva.",
        topic: "escolha de bolsa artesanal",
        topicType: "produto",
        associations: "rotina, estilo, tamanho, acabamento, cor, ocasião",
        cautions: "evitar promessa universal; não citar preço sem confirmação",
        doNotInvent: "estoque, preço, prazo, garantia não informada",
      },
    ];
  }
  return [
    {
      label: "Dúvida frequente",
      idea: "Uma dúvida que o público sempre tem antes de decidir",
      promise: "Você vai entender um ponto importante para tomar uma decisão com mais clareza.",
      notes: "Transformar dúvida real em orientação simples e útil.",
      topic: "dúvida frequente do público",
      topicType: "outro",
      associations: "dúvida, decisão, clareza, orientação, segurança",
      cautions: "evitar prometer resultado; pedir confirmação de fatos específicos",
      doNotInvent: baseDoNotInvent,
    },
    {
      label: "Erro comum",
      idea: "Um erro comum que pode atrapalhar o resultado esperado",
      promise: "Você vai identificar um cuidado simples antes de agir no automático.",
      notes: "Focar em orientação segura e prática.",
      topic: "erro comum do público",
      topicType: "outro",
      associations: "erro, cuidado, decisão, prática, clareza",
      cautions: "evitar exagero ou medo artificial",
      doNotInvent: baseDoNotInvent,
    },
    {
      label: "Bastidor útil",
      idea: "Um bastidor que ajuda o público a entender melhor o processo",
      promise: "Você vai ver um critério usado por trás da entrega para entender melhor o valor do serviço ou produto.",
      notes: "Mostrar processo sem expor dados internos ou sensíveis.",
      topic: "bastidor de processo",
      topicType: "servico",
      associations: "processo, critério, bastidor, cuidado, método",
      cautions: "não expor dados internos ou clientes",
      doNotInvent: baseDoNotInvent,
    },
  ];
}


function ImportedScriptPreview({ script, warnings }: { script: Reel2ImportedScript; warnings: string[] }) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileJson2 className="h-5 w-5 text-emerald-600" /> Roteiro Reel 2.0 importado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric label="Duração" value={`${script.main_script.duration_seconds}s`} />
          <MiniMetric label="Cenas" value={String(script.main_script.scenes.length)} />
          <MiniMetric label="Hashtags" value={`${script.publication.hashtags.length}/5`} />
        </div>
        <SummaryRow label="Gancho" value={script.selected_hook.spoken_hook} />
        <SummaryRow label="Legenda do vídeo" value={script.short_version.full_video_caption} />
        <SummaryRow label="Legenda da publicação" value={script.publication.caption} />
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Primeiras cenas</p>
          <div className="space-y-2">
            {script.main_script.scenes.slice(0, 4).map((scene, index) => (
              <div key={`${scene.start}-${scene.end}-${index}`} className="rounded-xl border bg-background p-3">
                <p className="text-xs font-semibold text-muted-foreground">{scene.start}s–{scene.end}s · {scene.function}</p>
                <p className="mt-1 font-medium">{scene.speech}</p>
                {scene.on_screen_text && <p className="mt-1 text-xs text-muted-foreground">Texto na tela: {scene.on_screen_text}</p>}
              </div>
            ))}
          </div>
        </div>
        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <p className="font-semibold text-amber-700 dark:text-amber-300">Avisos da importação</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function StepShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <Badge variant="secondary" className="w-fit rounded-full">{eyebrow}</Badge>
          <div>
            <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </section>
  );
}

function EntryFields({
  draft,
  patch,
  patchHookSource,
  presets,
  onUsePreset,
}: {
  draft: Reel2Draft;
  patch: (partial: Partial<Reel2Draft>) => void;
  patchHookSource: (partial: Partial<Reel2Draft>) => void;
  presets: ReturnType<typeof getAllPresets>;
  onUsePreset: (presetId: string) => void;
}) {
  if (!draft.entry_mode) return null;
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 p-5">
        {draft.entry_mode === "idea" && (
          <div className="space-y-2">
            <Label>Qual é a ideia ou tema do Reel?</Label>
            <Input
              value={draft.central_idea}
              onChange={(event) => patchHookSource({ central_idea: event.target.value })}
              placeholder="Ex.: erros que reforçam comportamento indesejado"
            />
          </div>
        )}

        {draft.entry_mode === "preset" && (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label>Preset compatível com Reel</Label>
              <Select value={draft.preset_id} onValueChange={onUsePreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-2xl border bg-muted/40 p-3 text-xs text-muted-foreground sm:max-w-xs">
              Presets podem preencher objetivo, estrutura, CTA, restrições e necessidade de capa.
            </div>
          </div>
        )}

        {draft.entry_mode === "remix" && (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm">
              <p className="font-medium text-violet-700 dark:text-violet-300">Regra ética</p>
              <p className="mt-1 text-muted-foreground">
                Use referências para aprender estrutura, não para copiar falas, imagens, identidade visual ou conteúdo autoral.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Link da referência</Label>
                <Input value={draft.reference_link} onChange={(event) => patchHookSource({ reference_link: event.target.value })} placeholder="Cole o link do Reel" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de adaptação</Label>
                <Select value={draft.remix_mode} onValueChange={(value) => patch({ remix_mode: value as Reel2Draft["remix_mode"] })}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="criador">Criador</SelectItem>
                    <SelectItem value="react">React</SelectItem>
                    <SelectItem value="remix">Remix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Transcrição, descrição ou estrutura percebida</Label>
              <Textarea value={draft.reference_transcript} onChange={(event) => patchHookSource({ reference_transcript: event.target.value })} rows={5} placeholder="Cole a transcrição ou descreva o que acontece no vídeo." />
            </div>
          </div>
        )}

        {draft.entry_mode === "trend" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Termo, áudio ou formato da trend</Label>
              <Input value={draft.trend_term} onChange={(event) => patchHookSource({ trend_term: event.target.value })} placeholder="Ex.: áudio de comparação, mala inteligente, passeio sem puxar" />
            </div>
            <div className="space-y-2">
              <Label>Fonte da tendência</Label>
              <Input value={draft.trend_source} onChange={(event) => patchHookSource({ trend_source: event.target.value })} placeholder="Ex.: Instagram, TikTok, YouTube, Google Trends" />
            </div>
          </div>
        )}

        {(draft.entry_mode === "adapt_existing" || draft.entry_mode === "no_ideas") && (
          <div className="space-y-2">
            <Label>{draft.entry_mode === "adapt_existing" ? "Conteúdo base" : "Observação sobre o que você quer evitar ou explorar"}</Label>
            <Textarea
              value={draft.base_content}
              onChange={(event) => patchHookSource({ base_content: event.target.value })}
              rows={5}
              placeholder={draft.entry_mode === "adapt_existing" ? "Cole o texto, post antigo ou material bruto." : "Ex.: evitar temas já usados sobre bagagem; buscar assuntos de planejamento familiar."}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BrandSnapshot({ brand }: { brand?: Tables<"brands"> | null }) {
  if (!brand) {
    return (
      <Card className="border-dashed">
        <CardContent className="grid h-full place-items-center p-5 text-center text-sm text-muted-foreground">
          Escolha uma marca para ver o contexto usado pelo Reel 2.0.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contexto carregado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <SummaryRow label="Marca" value={brand.name} />
        <SummaryRow label="Segmento" value={brand.segment || "Não informado"} />
        <SummaryRow label="Tom" value={brand.tone_of_voice || "Não informado"} />
        <SummaryRow label="Público" value={brand.audience || "Não informado"} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CTAs</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(brand.calls_to_action?.length ? brand.calls_to_action : ["Não informado"]).slice(0, 4).map((cta) => (
              <Badge key={cta} variant="outline" className="text-[10px]">{cta}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChoiceCard({ active, title, description, icon: Icon, onClick }: { active: boolean; title: string; description: string; icon: typeof Lightbulb; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
        active ? "border-orange-500 ring-2 ring-orange-500/20" : "border-border/70 hover:border-orange-500/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", active ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground")}>
          <Icon className="h-4 w-4" />
        </span>
        {active && <Check className="h-5 w-5 text-orange-500" />}
      </div>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function getRecommendedTypes(objective?: (typeof REEL2_OBJECTIVES)[number]) {
  const ids = objective?.suggestedTypes ?? (["educativo", "alerta", "passo_a_passo"] as Reel2Type[]);
  const selected = ids
    .map((id) => REEL2_TYPES.find((type) => type.id === id))
    .filter((type): type is (typeof REEL2_TYPES)[number] => Boolean(type));
  return selected.length ? selected : REEL2_TYPES.filter((type) => !type.advanced).slice(0, 3);
}

function getOtherTypes(objective?: (typeof REEL2_OBJECTIVES)[number]) {
  const recommended = new Set((objective?.suggestedTypes ?? []).map(String));
  return REEL2_TYPES.filter((type) => !recommended.has(type.id));
}

function ReelTypeGroup({
  title,
  description,
  types,
  selectedType,
  recommendedIds,
  onSelect,
}: {
  title: string;
  description: string;
  types: Array<(typeof REEL2_TYPES)[number]>;
  selectedType: Reel2Type | "";
  recommendedIds: Reel2Type[];
  onSelect: (typeId: Reel2Type) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {types.map((type) => (
          <ReelTypeCard
            key={type.id}
            type={type}
            active={selectedType === type.id}
            recommended={recommendedIds.includes(type.id)}
            onClick={() => onSelect(type.id)}
          />
        ))}
      </div>
    </section>
  );
}

function ReelTypeCard({ type, active, recommended, onClick }: { type: (typeof REEL2_TYPES)[number]; active: boolean; recommended: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg",
        active ? "border-violet-500 ring-2 ring-violet-500/20" : "border-border/70 hover:border-violet-500/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{type.title}</p>
            {recommended && <Badge className="bg-amber-500 text-black hover:bg-amber-500">Recomendado</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
        </div>
        {active && <Check className="h-5 w-5 text-violet-500" />}
      </div>
      <div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Estrutura: </span>{type.structure}
      </div>
    </button>
  );
}

function HookCard({ hook, active, onSelect, onChange }: { hook: Reel2HookDraft; active: boolean; onSelect: () => void; onChange: (hook: Reel2HookDraft) => void }) {
  return (
    <Card className={cn("min-w-0", active ? "border-orange-500 ring-2 ring-orange-500/20" : "border-border/70")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={active ? "default" : "secondary"}>{hookModeLabel(hook.mode)}</Badge>
          <Button size="sm" variant={active ? "default" : "outline"} onClick={onSelect}>
            {active ? "Escolhido" : "Escolher"}
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Fala inicial</Label>
          <Textarea value={hook.spoken_hook} onChange={(event) => onChange({ ...hook, spoken_hook: event.target.value })} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Texto na tela</Label>
          <Textarea value={hook.on_screen_text} onChange={(event) => onChange({ ...hook, on_screen_text: event.target.value })} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Cena sugerida</Label>
          <Textarea value={hook.scene_suggestion} onChange={(event) => onChange({ ...hook, scene_suggestion: event.target.value })} rows={3} />
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Por que prende: </span>{hook.why_it_works}
        </div>
      </CardContent>
    </Card>
  );
}


function ProcessStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-background/80 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-500 text-[11px] font-bold text-white">{number}</span>
        <span className="font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-2 text-muted-foreground">{text}</p>
    </div>
  );
}

function TopicContextPanel({
  draft,
  brand,
  context,
  patchHookSource,
}: {
  draft: Reel2Draft;
  brand?: Tables<"brands"> | null;
  context: ReturnType<typeof analyzeReel2TopicContext>;
  patchHookSource: (partial: Partial<Reel2Draft>) => void;
}) {
  const enrichmentPrompt = buildReel2TopicContextPrompt(draft, brand);
  const [contextJson, setContextJson] = useState("");

  const onApplyContextJson = () => {
    const result = parseTopicContextImport(contextJson, draft);
    if (!result.ok) {
      toast.error("error" in result ? result.error : "Não foi possível aplicar o contexto.");
      return;
    }

    patchHookSource(result.patch);
    setContextJson("");
    toast.success("Contexto enriquecido aplicado. Gere novos ganchos com esta base.");
  };

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Contexto do tema</p>
          <p className="mt-1 text-sm text-muted-foreground">
            O Cria Aí não precisa saber tudo. Ele identifica o assunto e pede contexto quando faltar informação para não inventar.
          </p>
        </div>
        <Badge variant={context.confidence === "alto" ? "default" : "outline"}>
          Contexto {context.confidence}
        </Badge>
      </div>

      <div className="mt-4 grid gap-2 text-xs md:grid-cols-4">
        <ProcessStep number="1" title="Identifique" text="Confirme o assunto principal do Reel." />
        <ProcessStep number="2" title="Associe" text="Adicione palavras que ajudam o gancho." />
        <ProcessStep number="3" title="Proteja" text="Liste o que evitar ou não inventar." />
        <ProcessStep number="4" title="Enriqueça" text="Use JSON externo se faltar contexto." />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Assunto principal</Label>
          <Input
            value={draft.topic_entity}
            onChange={(event) => patchHookSource({ topic_entity: event.target.value })}
            placeholder={context.topic || "Ex.: Campos do Jordão"}
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de assunto</Label>
          <Select
            value={draft.topic_entity_type || "desconhecido"}
            onValueChange={(value) => patchHookSource({ topic_entity_type: value })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desconhecido">Não sei / detectar</SelectItem>
              <SelectItem value="destino">Destino</SelectItem>
              <SelectItem value="local">Local</SelectItem>
              <SelectItem value="produto">Produto</SelectItem>
              <SelectItem value="servico">Serviço</SelectItem>
              <SelectItem value="comportamento">Comportamento</SelectItem>
              <SelectItem value="evento">Evento</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Palavras associadas</Label>
          <Textarea
            value={draft.topic_associations}
            onChange={(event) => patchHookSource({ topic_associations: event.target.value })}
            placeholder="Ex.: frio, fondue, natureza, casal, família"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Cuidados ou ângulos a evitar</Label>
          <Textarea
            value={draft.topic_cautions}
            onChange={(event) => patchHookSource({ topic_cautions: event.target.value })}
            placeholder="Ex.: não prometer preço, não inventar passeios específicos"
            rows={3}
          />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Label>O que o Cria Aí não pode inventar</Label>
        <Textarea
          value={draft.topic_do_not_invent}
          onChange={(event) => patchHookSource({ topic_do_not_invent: event.target.value })}
          placeholder="Ex.: preços, datas, disponibilidade, atrações específicas não confirmadas"
          rows={2}
        />
      </div>

      <div className="mt-4 rounded-xl bg-background/80 p-3 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Leitura atual:</span> {context.topic} · {labelEntityType(context.entityType)} · {labelIntent(context.intent)}</p>
        {context.safeMode && (
          <p className="mt-1 text-amber-700 dark:text-amber-300">
            Contexto baixo: os ganchos serão seguros e não devem citar detalhes específicos que não foram informados.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={enrichmentPrompt} label="Copiar pedido para enriquecer" variant="outline" size="sm" />
        <Button type="button" variant="outline" size="sm" onClick={() => window.open("https://chat.openai.com/", "_blank", "noopener,noreferrer")}>Abrir ChatGPT</Button>
      </div>

      <div className="mt-4 rounded-xl border bg-background/80 p-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <Label>Importar contexto enriquecido</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Cole aqui o JSON devolvido pelo ChatGPT. Ele preenche os campos acima e invalida os ganchos antigos.
            </p>
          </div>
          <Badge variant="outline">JSON</Badge>
        </div>
        <Textarea
          value={contextJson}
          onChange={(event) => setContextJson(event.target.value)}
          placeholder={'Cole aqui o JSON com topic_entity, topic_associations, topic_cautions e topic_do_not_invent.'}
          rows={5}
          className="font-mono text-xs"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onApplyContextJson} disabled={!contextJson.trim()}>
            Aplicar JSON ao contexto
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setContextJson("")} disabled={!contextJson.trim()}>
            Limpar JSON
          </Button>
        </div>
      </div>
    </div>
  );
}

type TopicContextImportResult =
  | { ok: true; patch: Partial<Reel2Draft> }
  | { ok: false; error: string };

function parseTopicContextImport(raw: string, draft: Reel2Draft): TopicContextImportResult {
  if (!raw.trim()) return { ok: false, error: "Cole o JSON de contexto antes de aplicar." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "O contexto precisa estar em JSON válido." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "O JSON precisa ser um objeto com os campos de contexto." };
  }

  const data = parsed as Record<string, unknown>;
  const entity = readString(data, ["topic_entity", "topic", "assunto", "assunto_principal", "entity"]);
  const entityType = normalizeTopicEntityType(readString(data, ["topic_entity_type", "type", "tipo", "tipo_assunto"]));
  const associations = mergeTextLists(
    draft.topic_associations,
    readList(data.topic_associations),
    readList(data.associations),
    readList(data.palavras_associadas),
    readList(data.safe_angles_for_hooks),
    readList(data.angulos_seguros),
  );
  const cautions = mergeTextLists(
    draft.topic_cautions,
    readList(data.topic_cautions),
    readList(data.cautions),
    readList(data.cuidados),
    readList(data.angles_to_avoid),
    readList(data.unsafe_or_unconfirmed_angles),
    readList(data.angulos_inseguros),
  );
  const doNotInvent = mergeTextLists(
    draft.topic_do_not_invent,
    readList(data.topic_do_not_invent),
    readList(data.do_not_invent),
    readList(data.nao_inventar),
    readList(data.confirmation_needed),
    readList(data.precisa_confirmar),
  );

  const patch: Partial<Reel2Draft> = {
    topic_entity: entity || draft.topic_entity,
    topic_entity_type: entityType || draft.topic_entity_type || "desconhecido",
    topic_associations: associations,
    topic_cautions: cautions,
    topic_do_not_invent: doNotInvent,
  };

  if (!patch.topic_entity && !patch.topic_associations && !patch.topic_cautions && !patch.topic_do_not_invent) {
    return { ok: false, error: "Não encontrei campos de contexto nesse JSON." };
  }

  return { ok: true, patch };
}

function readString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(readList).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function mergeTextLists(current: string, ...lists: string[][]) {
  const seen = new Set<string>();
  const items = [current, ...lists.flat()]
    .flatMap((item) => readList(item))
    .filter((item) => {
      const key = normalizeComparable(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 16);
  return items.join(", ");
}

function normalizeTopicEntityType(value: string) {
  const normalized = normalizeComparable(value);
  if (["destino", "local", "produto", "servico", "comportamento", "evento", "outro", "desconhecido"].includes(normalized)) {
    return normalized;
  }
  if (normalized === "serviço") return "servico";
  return "";
}

function GuidanceCard({ title, icon: Icon, items }: { title: string; icon: typeof Lightbulb; items: string[] }) {
  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-amber-500" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border bg-muted/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function buildLocalHookOptions(draft: Reel2Draft, brand?: Tables<"brands"> | null, round = 1): Reel2HookDraft[] {
  const context = buildHookContext(draft, brand);
  const pattern = inferHookPattern(context);
  const pick = (items: HookTemplate[], offset = 0) => items[(Math.max(round, 1) + offset - 1) % items.length];
  if (pattern === "travel_destination") return buildTravelDestinationHooks(context, round);

  const templates = HOOK_TEMPLATE_LIBRARY[pattern] ?? HOOK_TEMPLATE_LIBRARY.generic;

  const direct = materializeHookTemplate(pick(templates.direct, 0), context, "direct");
  const curious = materializeHookTemplate(pick(templates.curious, 1), context, "curious");
  const alert = materializeHookTemplate(pick(templates.alert, 2), context, "alert");

  return [direct, curious, alert];
}

type HookPattern = "dog_signals" | "canine_walk" | "behavior_generic" | "travel_destination" | "travel_decision" | "travel_generic" | "atelier" | "accounting" | "generic";
type HookMode = Reel2HookDraft["mode"];
type HookContext = {
  brandText: string;
  sourceText: string;
  idea: string;
  promise: string;
  extraNotes: string;
  objective: string;
  reelType: string;
  topic: string;
  gain: string;
  entityType: string;
  intent: string;
  associations: string[];
  cautions: string[];
  doNotInvent: string[];
  safeMode: boolean;
};
type HookTemplate = {
  spoken: string;
  screen?: string;
  scene: string;
  why: string;
};

function buildHookContext(draft: Reel2Draft, brand?: Tables<"brands"> | null): HookContext {
  const idea = getEntryMainIdea(draft) || "este assunto";
  const promise = draft.promise.trim();
  const extraNotes = draft.extra_notes.trim();
  const sourceText = [idea, promise, extraNotes, draft.objective, draft.reel_type].filter(Boolean).join(" ");
  const brandText = [brand?.name, brand?.segment, brand?.description, brand?.audience].filter(Boolean).join(" ");
  const topicContext = analyzeReel2TopicContext(draft, brand);
  return {
    brandText,
    sourceText,
    idea,
    promise,
    extraNotes,
    objective: draft.objective,
    reelType: draft.reel_type,
    topic: topicContext.topic || inferHookTopic(idea, promise),
    gain: inferPromiseGain(promise, idea),
    entityType: topicContext.entityType,
    intent: topicContext.intent,
    associations: topicContext.associations,
    cautions: topicContext.cautions,
    doNotInvent: topicContext.doNotInvent,
    safeMode: topicContext.safeMode,
  };
}

function buildHookContextKey(draft: Reel2Draft, brand?: Tables<"brands"> | null) {
  const context = buildHookContext(draft, brand);
  return normalizeComparable([context.idea, context.promise, context.extraNotes, context.objective, context.reelType, context.brandText, context.topic, context.associations.join(","), context.cautions.join(",")].join("|"));
}

function buildScriptHookContextKey(script: Reel2ImportedScript) {
  return normalizeComparable([script.central_idea, script.promise, script.objective, script.reel_type].join("|"));
}

function inferHookPattern(context: HookContext): HookPattern {
  const source = normalizeComparable(`${context.sourceText} ${context.brandText}`);
  const promiseSource = normalizeComparable(`${context.promise} ${context.idea} ${context.extraNotes}`);

  if (/(rosn|desconfort|reacao|reage|reagir|sinais?|corpo|linguagem corporal|boceja|lambe|desvia|olhar)/.test(promiseSource)
    && /(cachorro|canino|pet|tutor|adestra|comportamento)/.test(source)) {
    return "dog_signals";
  }
  if (/(passeio|guia|coleira|puxa|rua|respeita|obedec)/.test(promiseSource)
    && /(cachorro|canino|pet|tutor|adestra|comportamento)/.test(source)) {
    return "canine_walk";
  }
  if (/(comportamento|reforco|reforço|tutor|pular|latir|contato visual|atenção|atencao|rotina|repetir|indesejado)/.test(promiseSource)) {
    return "behavior_generic";
  }
  if ((context.entityType === "destino" || context.entityType === "local")
    && /(o_que_fazer|responder_duvida|orientar|alerta|passo_a_passo)/.test(context.intent)
    && /(viagem|turismo|travel|destino|férias|hotel|roteiro|passagem)/.test(source)) {
    return "travel_destination";
  }
  if (/(destino|viagem|viajar|planejamento|prioridades|perguntas?|teste|ferias|férias|roteiro)/.test(promiseSource)
    && /(viagem|turismo|travel|destino|férias|hotel|roteiro|passagem)/.test(source)) {
    return "travel_decision";
  }
  if (/(viagem|turismo|travel|destino|férias|hotel|roteiro|passagem)/.test(source)) return "travel_generic";
  if (/(atelier|costura|bolsa|artesanal|moda|acessório|acessorio)/.test(source)) return "atelier";
  if (/(contabilidade|contador|fiscal|imposto|mei|cnpj|nota fiscal|obrigacao|obrigação|tribut)/.test(source)) return "accounting";
  return "generic";
}

const HOOK_TEMPLATE_LIBRARY: Record<HookPattern, Record<HookMode, HookTemplate[]>> = {
  travel_destination: {
    direct: [],
    curious: [],
    alert: [],
  },
  dog_signals: {
    direct: [
      {
        spoken: "Antes do seu cachorro rosnar, ele provavelmente já avisou de outras formas.",
        screen: "Antes do rosnado, vem o aviso",
        scene: "Mostrar uma situação cotidiana calma com o cachorro desviando o olhar, lambendo o focinho ou mudando a postura antes da reação.",
        why: "Conecta diretamente a promessa aos sinais discretos que aparecem antes da reação intensa.",
      },
      {
        spoken: "Seu cachorro quase nunca reage do nada. O corpo dele costuma avisar antes.",
        screen: "Ele não reage do nada",
        scene: "Começar com close no tutor observando o cachorro e inserir pequenos marcadores visuais nos sinais corporais.",
        why: "Quebra a crença de que a reação aparece sem aviso e abre caminho para explicar sinais prévios.",
      },
      {
        spoken: "Se você só percebe quando ele rosna, talvez esteja perdendo os sinais anteriores.",
        screen: "Você percebe antes do rosnado?",
        scene: "Apresentador em plano médio, tom acolhedor, apontando para três sinais na tela sem dramatizar o cachorro.",
        why: "Cria identificação sem culpa e prepara a entrega dos sinais discretos prometidos.",
      },
    ],
    curious: [
      {
        spoken: "O sinal mais importante pode acontecer antes do som aparecer.",
        screen: "O aviso vem antes do som",
        scene: "Abrir com uma cena silenciosa do cachorro mostrando desconforto corporal antes de qualquer vocalização.",
        why: "Abre uma lacuna de curiosidade ligada ao comportamento corporal antes da reação.",
      },
      {
        spoken: "Tem um momento antes da reação que muita gente não percebe.",
        screen: "Muita gente perde este momento",
        scene: "Mostrar uma pausa rápida no vídeo, como se congelasse o instante antes da reação, destacando o corpo do cachorro.",
        why: "Promete uma descoberta observável e diretamente conectada à promessa.",
      },
      {
        spoken: "O corpo do cachorro costuma contar a história antes do rosnado.",
        screen: "O corpo avisa primeiro",
        scene: "Intercalar apresentador e imagem do cachorro em situação cotidiana com setas discretas nos sinais.",
        why: "Transforma a promessa em curiosidade visual e educativa.",
      },
    ],
    alert: [
      {
        spoken: "Cuidado: ignorar esses sinais pode deixar a reação mais intensa.",
        screen: "Não ignore os sinais antes",
        scene: "Texto forte na tela, seguido de exemplos simples de sinais como desviar o corpo, lamber o focinho ou bocejar fora de contexto.",
        why: "Cria urgência coerente com a promessa, sem exagerar nem culpar o tutor.",
      },
      {
        spoken: "Não espere o rosnado para perceber que seu cachorro está desconfortável.",
        screen: "Não espere o rosnado",
        scene: "Apresentador faz gesto de pausa e mostra uma lista curta de sinais discretos.",
        why: "Mostra exatamente por que assistir até o fim: reconhecer sinais antes da reação intensa.",
      },
      {
        spoken: "Se a reação parece repentina, talvez os avisos tenham passado despercebidos.",
        screen: "A reação não começa no rosnado",
        scene: "Usar corte rápido entre uma situação calma e o apresentador explicando que existem avisos anteriores.",
        why: "Reenquadra o problema e conecta alerta, promessa e aprendizado.",
      },
    ],
  },
  canine_walk: {
    direct: [
      {
        spoken: "Antes de dizer que seu cachorro não te respeita no passeio, observe isto.",
        screen: "Antes de culpar o passeio",
        scene: "Apresentador com guia na mão, mostrando uma situação real de passeio sem tensionar a cena.",
        why: "Vai direto ao ponto e conecta passeio com observação prática.",
      },
      {
        spoken: "O passeio pode estar difícil por um motivo que começa antes da rua.",
        screen: "O passeio começa antes da rua",
        scene: "Mostrar preparação para sair: guia, porta, excitação e tutor organizando a rotina.",
        why: "Traz uma causa anterior ao problema visível e aumenta a retenção.",
      },
    ],
    curious: [
      {
        spoken: "O problema do passeio quase nunca começa onde você acha.",
        screen: "O problema começa antes",
        scene: "Abrir com uma cena aparentemente comum antes de sair de casa e segurar a explicação.",
        why: "Cria curiosidade sobre a origem real do comportamento.",
      },
      {
        spoken: "A guia pode só estar mostrando um problema que já começou antes.",
        screen: "A guia mostra, mas nem sempre causa",
        scene: "Close na guia e corte para o cachorro antes da saída.",
        why: "Mostra um ângulo menos óbvio sobre o passeio.",
      },
    ],
    alert: [
      {
        spoken: "Não tente corrigir o passeio sem entender o que acontece antes dele.",
        screen: "Entenda antes de corrigir",
        scene: "Texto de alerta na tela com exemplo prático de pré-passeio.",
        why: "Cria cuidado sem prometer solução instantânea.",
      },
      {
        spoken: "Cuidado: corrigir só na rua pode confundir ainda mais o cachorro.",
        screen: "Corrigir só na rua pode confundir",
        scene: "Apresentador faz gesto de pausa antes de mostrar o ponto de análise.",
        why: "Conecta a consequência ao motivo de continuar assistindo.",
      },
    ],
  },
  behavior_generic: {
    direct: [
      {
        spoken: "Esse comportamento pode estar sendo reforçado sem você perceber.",
        screen: "Você pode estar reforçando isso",
        scene: "Mostrar uma situação cotidiana simples ligada ao comportamento citado, com apresentador explicando de forma acolhedora e sem culpa.",
        why: "Conecta a promessa a uma situação real e evita trocar o assunto por exemplos de outro nicho.",
      },
      {
        spoken: "Antes de tentar corrigir {topic}, observe o que acontece logo depois.",
        screen: "Observe o que vem depois",
        scene: "Apresentador mostra uma sequência curta: comportamento, resposta do tutor e repetição do comportamento.",
        why: "Leva o público para a lógica de reforço e rotina, alinhando gancho, promessa e tipo educativo.",
      },
    ],
    curious: [
      {
        spoken: "O detalhe que muita gente não percebe é o que o comportamento ganha depois.",
        screen: "O que ele ganha depois?",
        scene: "Congelar uma cena cotidiana e destacar a resposta que vem logo após o comportamento.",
        why: "Cria curiosidade diretamente conectada à ideia de reforço involuntário.",
      },
      {
        spoken: "Às vezes o problema não é o comportamento em si, é a resposta que vem depois.",
        screen: "A resposta ensina também",
        scene: "Usar cortes rápidos mostrando tutor oferecendo atenção, toque ou contato visual sem perceber.",
        why: "Promete uma mudança de percepção sem usar frases genéricas ou técnicas demais.",
      },
    ],
    alert: [
      {
        spoken: "Cuidado: tentar interromper pode acabar ensinando o comportamento a se repetir.",
        screen: "Interromper também pode reforçar",
        scene: "Apresentador faz gesto de pausa e mostra uma alternativa de resposta mais clara.",
        why: "Cria alerta prático e conversa com objetivos educativos sem dramatizar.",
      },
      {
        spoken: "Não corrija no automático antes de entender o que você está reforçando.",
        screen: "Não corrija no automático",
        scene: "Mostrar checklist simples: comportamento, resposta do tutor, consequência.",
        why: "Mantém o foco na promessa e evita cair em ganchos de contabilidade, viagem ou venda.",
      },
    ],
  },
  travel_decision: {
    direct: [
      {
        spoken: "Antes de escolher um destino, faça este teste rápido.",
        screen: "Teste antes de escolher",
        scene: "Apresentador olha para a câmera, levanta três dedos e mostra cartões de planejamento, experiência e tranquilidade.",
        why: "Conecta promessa, decisão de viagem e utilidade prática nos primeiros segundos.",
      },
      {
        spoken: "Antes de fechar sua próxima viagem, responda estas três perguntas.",
        screen: "3 perguntas antes de decidir",
        scene: "Mostrar checklist simples de viagem, sem preços ou promessas comerciais.",
        why: "Promete método claro para decidir melhor, alinhado ao planejamento.",
      },
    ],
    curious: [
      {
        spoken: "Um destino bonito pode não combinar com o seu momento agora.",
        screen: "Bonito não é o único critério",
        scene: "Alternar imagens de estilos diferentes de viagem e voltar ao apresentador com expressão reflexiva.",
        why: "Abre curiosidade sobre critérios além da beleza do destino.",
      },
      {
        spoken: "A melhor viagem nem sempre é o destino mais óbvio.",
        screen: "A melhor escolha pode não ser a óbvia",
        scene: "Mostrar opções diferentes de destino como cartões e destacar a ideia de prioridades.",
        why: "Cria tensão positiva entre desejo e escolha consciente.",
      },
    ],
    alert: [
      {
        spoken: "Cuidado: escolher só pelo destino pode gerar frustração depois.",
        screen: "Não escolha só pelo destino",
        scene: "Mostrar comparação entre destino bonito e checklist de organização da viagem.",
        why: "Cria alerta coerente com planejamento, sem assustar ou prometer demais.",
      },
      {
        spoken: "Não feche sua viagem antes de conferir se ela combina com suas prioridades.",
        screen: "Confira suas prioridades",
        scene: "Apresentador aponta para três critérios na tela: planejamento, experiência e tranquilidade.",
        why: "Leva direto à promessa de avaliar se o destino combina com o momento da pessoa.",
      },
    ],
  },
  travel_generic: {
    direct: [
      {
        spoken: "Antes de fechar sua próxima viagem, confira este detalhe.",
        screen: "Antes de fechar a viagem",
        scene: "Apresentador em ambiente limpo, com elementos discretos de viagem e texto forte na tela.",
        why: "Vai direto a uma decisão prática de viagem.",
      },
      {
        spoken: "Viagem tranquila começa antes da reserva.",
        screen: "Começa antes da reserva",
        scene: "Mostrar checklist e imagens de destino como apoio visual.",
        why: "Conecta planejamento e benefício de tranquilidade.",
      },
    ],
    curious: [
      {
        spoken: "O detalhe que muita gente esquece antes de viajar.",
        screen: "Muita gente esquece isto",
        scene: "Abrir com uma mala ou celular com opções de viagem e segurar a resposta para a cena seguinte.",
        why: "Promete descoberta prática para quem está planejando viajar.",
      },
      {
        spoken: "A parte mais importante da viagem pode não ser o destino.",
        screen: "Não é só o destino",
        scene: "Alternar destino bonito e organização prática da viagem.",
        why: "Cria curiosidade sobre planejamento e experiência.",
      },
    ],
    alert: [
      {
        spoken: "Não feche sua viagem sem entender o que está incluso.",
        screen: "Entenda o que está incluso",
        scene: "Texto de alerta com checklist visual, sem citar valores ou condições.",
        why: "Mostra risco prático e orienta decisão consciente.",
      },
      {
        spoken: "Cuidado: o menor preço pode esconder pontos importantes.",
        screen: "Menor preço não é tudo",
        scene: "Comparar dois cartões genéricos de viagem sem expor valores reais.",
        why: "Cria alerta comercial leve e coerente com turismo.",
      },
    ],
  },
  atelier: {
    direct: [
      {
        spoken: "Antes de escolher uma peça artesanal, repare neste detalhe.",
        screen: "Repare neste detalhe",
        scene: "Close no acabamento ou material da peça com iluminação suave.",
        why: "Conecta decisão de compra com percepção de valor.",
      },
    ],
    curious: [
      {
        spoken: "O detalhe que diferencia uma peça bonita de uma peça bem pensada.",
        screen: "Bonita e bem pensada",
        scene: "Mostrar detalhe interno, costura ou acabamento que normalmente passa despercebido.",
        why: "Cria curiosidade sobre bastidor e qualidade.",
      },
    ],
    alert: [
      {
        spoken: "Cuidado: beleza sem funcionalidade pode frustrar no uso diário.",
        screen: "Beleza também precisa funcionar",
        scene: "Mostrar uma situação real de uso da peça e destacar funcionalidade.",
        why: "Traz um cuidado prático sem desvalorizar o produto.",
      },
    ],
  },
  accounting: {
    direct: [
      {
        spoken: "Antes de resolver isso no automático, confira este ponto.",
        screen: "Confira antes de seguir",
        scene: "Tela limpa com checklist fiscal genérico, sem dados sensíveis.",
        why: "Conecta rotina técnica com prevenção de erro.",
      },
    ],
    curious: [
      {
        spoken: "O detalhe que muita empresa só percebe quando dá problema.",
        screen: "Percebe tarde demais",
        scene: "Mostrar documento genérico e marcador visual em um campo de atenção.",
        why: "Cria curiosidade sobre um erro comum.",
      },
    ],
    alert: [
      {
        spoken: "Cuidado: deixar isso para depois pode criar retrabalho.",
        screen: "Evite retrabalho",
        scene: "Apresentador aponta para uma lista simples de conferência.",
        why: "Mostra consequência prática e segura.",
      },
    ],
  },
  generic: {
    direct: [
      {
        spoken: "Antes de seguir com {topic}, entenda este ponto.",
        screen: "Entenda este ponto primeiro",
        scene: "Apresentador olha para a câmera e apresenta o tema de forma direta.",
        why: "Liga o gancho à promessa atual sem depender de exemplos antigos da marca.",
      },
      {
        spoken: "Esse detalhe muda a forma de olhar para {topic}.",
        screen: "Esse detalhe muda tudo",
        scene: "Abrir com o elemento principal do tema em destaque e texto curto na tela.",
        why: "Promete uma mudança de percepção alinhada à promessa.",
      },
    ],
    curious: [
      {
        spoken: "Quase ninguém percebe isto sobre {topic}.",
        screen: "Quase ninguém percebe isto",
        scene: "Mostrar uma situação comum e segurar a explicação para a cena seguinte.",
        why: "Abre lacuna de curiosidade conectada ao tema atual.",
      },
      {
        spoken: "O ponto mais importante sobre {topic} pode não ser o mais óbvio.",
        screen: "Não é o ponto mais óbvio",
        scene: "Usar cena simples de comparação antes/depois ou pergunta na tela.",
        why: "Evita gancho genérico e conduz para a promessa definida.",
      },
    ],
    alert: [
      {
        spoken: "Cuidado para não decidir sobre {topic} antes de entender isto.",
        screen: "Entenda antes de decidir",
        scene: "Texto de alerta com corte rápido para uma situação prática do tema.",
        why: "Cria urgência coerente com a promessa atual.",
      },
      {
        spoken: "Não avance com {topic} sem conferir este ponto.",
        screen: "Confira este ponto antes",
        scene: "Apresentador faz gesto de pausa e introduz o ponto principal.",
        why: "Mostra motivo claro para continuar assistindo.",
      },
    ],
  },
};


function buildTravelDestinationHooks(context: HookContext, round = 1): Reel2HookDraft[] {
  const topic = context.topic || "esse destino";
  const mainAssociation = context.associations[0] || "";
  const secondAssociation = context.associations[1] || "";
  const hasAssociations = Boolean(mainAssociation);
  const rotations = [
    {
      direct: hasAssociations
        ? `${topic} é muito mais do que ${mainAssociation} — veja como pensar seu roteiro.`
        : `Vai para ${topic}? Veja como escolher o que fazer sem montar um roteiro genérico.`,
      directScreen: hasAssociations ? `${topic} além de ${mainAssociation}` : `O que fazer em ${topic}`,
      curious: hasAssociations && secondAssociation
        ? `Por que ${topic} combina com ${mainAssociation}, ${secondAssociation} e muitos estilos de viagem?`
        : `${topic} pode render viagens bem diferentes — depende do que você procura.`,
      curiousScreen: hasAssociations ? `Por que ${topic} atrai tanta gente?` : `${topic} do seu jeito`,
      alert: `Não escolha passeios em ${topic} só porque todo mundo recomenda.`,
      alertScreen: `Cuidado com roteiro genérico`,
    },
    {
      direct: `Se ${topic} está nos seus planos, comece escolhendo o tipo de experiência que você quer viver.`,
      directScreen: `Antes de montar o roteiro`,
      curious: hasAssociations
        ? `${topic} não precisa ser só sobre ${mainAssociation}. O roteiro muda conforme seu momento.`
        : `O melhor roteiro em ${topic} depende menos da lista pronta e mais do seu momento.`,
      curiousScreen: `Roteiro não é lista pronta`,
      alert: `Cuidado para transformar ${topic} em uma sequência de passeios que não combina com você.`,
      alertScreen: `Passeio famoso nem sempre combina`,
    },
    {
      direct: `Quer saber o que fazer em ${topic}? Primeiro defina o que você espera da viagem.`,
      directScreen: `O que fazer em ${topic}?`,
      curious: `${topic} pode ser descanso, descoberta ou experiência — a escolha muda tudo.`,
      curiousScreen: `A escolha muda tudo`,
      alert: `Antes de fechar passeios em ${topic}, confira se eles combinam com o seu estilo de viagem.`,
      alertScreen: `Confira antes de fechar`,
    },
  ];
  const selected = rotations[(Math.max(round, 1) - 1) % rotations.length];
  return [
    {
      mode: "direct",
      spoken_hook: selected.direct,
      on_screen_text: makeOnScreenText(selected.directScreen),
      scene_suggestion: `Abrir com o nome ${topic} em destaque e imagens de apoio gerais de viagem, sem citar detalhes não confirmados.`,
      why_it_works: "Usa o destino específico como assunto principal e promete uma orientação prática sem inventar informações locais.",
    },
    {
      mode: "curious",
      spoken_hook: selected.curious,
      on_screen_text: makeOnScreenText(selected.curiousScreen),
      scene_suggestion: `Alternar imagens de estilos diferentes de viagem e voltar ao apresentador apresentando ${topic} como escolha que depende do perfil do viajante.`,
      why_it_works: "Cria curiosidade sobre o destino sem trocar o assunto por viagem genérica.",
    },
    {
      mode: "alert",
      spoken_hook: selected.alert,
      on_screen_text: makeOnScreenText(selected.alertScreen),
      scene_suggestion: `Usar texto de alerta leve com checklist visual. Não citar preços, empresas, datas ou passeios específicos sem confirmação.`,
      why_it_works: "Traz cuidado e decisão consciente ligados ao destino informado, sem acusação ou informação não verificada.",
    },
  ];
}

function materializeHookTemplate(template: HookTemplate, context: HookContext, mode: HookMode): Reel2HookDraft {
  const spoken = template.spoken.replaceAll("{topic}", context.topic).replaceAll("{gain}", context.gain);
  const screen = (template.screen || spoken).replaceAll("{topic}", context.topic).replaceAll("{gain}", context.gain);
  return {
    mode,
    spoken_hook: spoken,
    on_screen_text: makeOnScreenText(screen),
    scene_suggestion: template.scene,
    why_it_works: template.why,
  };
}

function inferHookTopic(idea: string, promise: string) {
  const cleanIdea = shortIdea(idea).replace(/^ex\.?:\s*/i, "");
  if (cleanIdea && cleanIdea !== "este assunto") return cleanIdea;
  const cleanPromise = promise
    .replace(/^você vai\s+(entender|conhecer|descobrir|saber)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return shortIdea(cleanPromise || "este assunto");
}

function inferPromiseGain(promise: string, idea: string) {
  const source = (promise || idea || "um ponto importante").replace(/^você vai\s+/i, "").replace(/\s+/g, " ").trim();
  return shortIdea(source);
}

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function shortIdea(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "este assunto";
  return clean.length > 70 ? `${clean.slice(0, 67).trim()}...` : clean;
}

function makeOnScreenText(value: string) {
  return value.replace(/[.!?]+$/, "").slice(0, 90);
}

function getEntryMainIdea(draft: Reel2Draft) {
  if (draft.central_idea.trim()) return draft.central_idea.trim();
  if (draft.trend_term.trim()) return draft.trend_term.trim();
  if (draft.base_content.trim()) return draft.base_content.trim().slice(0, 120);
  if (draft.reference_notes.trim()) return draft.reference_notes.trim().slice(0, 120);
  if (draft.reference_link.trim()) return "Remix de referência";
  return "";
}

function objectiveIcon(objective: Reel2Objective) {
  const map: Record<Reel2Objective, typeof Lightbulb> = {
    educar: BookOpenCheck,
    alertar: ShieldCheck,
    gerar_contato: MousePointer2,
    identificacao: MessageCircle,
    autoridade: BadgeCheck,
    bastidor: Clapperboard,
    vender_leve: Megaphone,
    comentarios: MessageCircle,
  };
  return map[objective] ?? Lightbulb;
}

function hookModeLabel(mode: Reel2HookDraft["mode"]) {
  if (mode === "direct") return "Direto";
  if (mode === "curious") return "Curioso";
  return "Alerta";
}

function coverModeLabel(mode: Reel2Draft["cover_mode"]) {
  const map: Record<Reel2Draft["cover_mode"], string> = {
    custom: "Capa personalizada",
    frame: "Usar frame do vídeo",
    unsure: "Ainda não sei",
    none: "Não precisa",
  };
  return map[mode];
}
