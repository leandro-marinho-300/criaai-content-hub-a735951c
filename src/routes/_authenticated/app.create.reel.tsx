import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Braces,
  Check,
  ChevronDown,
  Clapperboard,
  CopyCheck,
  Film,
  FileJson2,
  HelpCircle,
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
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getAllPresets } from "@/lib/contentPresets";
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

export const Route = createFileRoute("/_authenticated/app/create/reel")({
  head: () => ({ meta: [{ title: "Criar Reel 2.0 — Cria Aí" }] }),
  component: CreateReel2,
});

const STEP_LABELS = ["Entrada", "Marca", "Objetivo", "Tipo", "Promessa", "Gancho", "Resumo"] as const;
const FUTURE_STEPS = ["Capa", "Publicação", "Storyboard", "Aprovação"];

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const entryIconMap: Record<Reel2EntryMode, typeof Lightbulb> = {
  idea: Lightbulb,
  no_ideas: Sparkles,
  preset: Wand2,
  remix: RefreshCw,
  trend: Megaphone,
  adapt_existing: CopyCheck,
};

export function CreateReel2() {
  const navigate = useNavigate();
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

  useEffect(() => saveReel2Draft(draft), [draft]);

  const patch = (partial: Partial<Reel2Draft>) => setDraft((current) => ({ ...current, ...partial }));

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
      patch({ hook_options: options, selected_hook_index: 0 });
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
      cover_mode: script.cover.needs_cover ? "custom" : current.cover_mode,
    }));
  };

  const onContinueToClassicWizard = () => {
    try {
      localStorage.setItem(REEL2_WIZARD_PREFILL_KEY, JSON.stringify(buildReel2WizardPrefill(draft, selectedBrand)));
      toast.success("Rascunho enviado para o wizard atual.");
      // Navegação robusta para preservar o prefill em produção e evitar cliques sem efeito.
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
Fase 3 · Cria Aí 2.0
              </Badge>
              <Badge variant="secondary" className="rounded-full">
Estúdio de roteiro
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

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progresso da Fase 3</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
              <nav className="space-y-1">
                {STEP_LABELS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStep(index as StepIndex)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                      index === step ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-xs",
                      index === step ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                    )}>
                      {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <HelpCircle className="h-4 w-4 text-amber-500" /> Próximas fases
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FUTURE_STEPS.map((future) => (
                  <Badge key={future} variant="outline" className="text-[10px]">
                    {future}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Nesta fase, o rascunho já gera um pedido externo e importa o JSON Reel 2.0 validado.
              </p>
            </CardContent>
          </Card>
        </aside>

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

              <EntryFields draft={draft} patch={patch} presets={presets} onUsePreset={onUsePreset} />
            </StepShell>
          )}

          {step === 1 && (
            <StepShell
              eyebrow="Marca"
              title="Para qual marca este Reel será criado?"
              description="A marca define nicho, tom, público, restrições e CTAs. Essa etapa evita misturar linguagem de viagem, comportamento canino, atelier ou outros segmentos."
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card>
                  <CardContent className="space-y-4 p-5">
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
                        patch({ objective: objective.id, reel_type: currentType || suggested });
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
              {selectedObjective && (
                <div className="rounded-2xl border bg-muted/40 p-4 text-sm">
                  <p className="font-medium">Tipos recomendados para {selectedObjective.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedObjective.suggestedTypes.map((typeId) => (
                      <Badge key={typeId} variant="secondary">
                        {REEL2_TYPES.find((type) => type.id === typeId)?.title ?? typeId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {REEL2_TYPES.filter((type) => !type.advanced).map((type) => (
                  <ReelTypeCard
                    key={type.id}
                    type={type}
                    active={draft.reel_type === type.id}
                    recommended={Boolean(selectedObjective?.suggestedTypes.includes(type.id))}
                    onClick={() => patch({ reel_type: type.id })}
                  />
                ))}
              </div>

              <Collapsible open={draft.advanced_open} onOpenChange={(open) => patch({ advanced_open: open })}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <ChevronDown className={cn("h-4 w-4 transition", draft.advanced_open && "rotate-180")} />
                    Ver mais tipos de Reel
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 grid gap-3 lg:grid-cols-2">
                  {REEL2_TYPES.filter((type) => type.advanced).map((type) => (
                    <ReelTypeCard
                      key={type.id}
                      type={type}
                      active={draft.reel_type === type.id}
                      recommended={Boolean(selectedObjective?.suggestedTypes.includes(type.id))}
                      onClick={() => patch({ reel_type: type.id })}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell
              eyebrow="Promessa"
              title="O que a pessoa ganha assistindo até o final?"
              description="A promessa é o motivo para continuar assistindo. Ela precisa ser específica, útil e coerente com o nicho."
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="space-y-2">
                      <Label>Ideia central do Reel</Label>
                      <Input
                        value={draft.central_idea}
                        onChange={(event) => patch({ central_idea: event.target.value })}
                        placeholder={brandExamples.ideaPlaceholder}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Promessa do vídeo</Label>
                      <Textarea
                        value={draft.promise}
                        onChange={(event) => patch({ promise: event.target.value })}
                        placeholder={brandExamples.promisePlaceholder}
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Observações extras para o Reel</Label>
                      <Textarea
                        value={draft.extra_notes}
                        onChange={(event) => patch({ extra_notes: event.target.value })}
                        placeholder={brandExamples.extraNotesPlaceholder}
                        rows={4}
                      />
                    </div>
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
                <div>
                  <p className="font-medium">Prepare 3 opções de gancho</p>
                  <p className="text-sm text-muted-foreground">
                    Esta fase cria sugestões locais para estruturar a tela. O prompt externo entra na próxima fase.
                  </p>
                </div>
                <Button onClick={onGenerateHooks} className="gap-2">
                  <Sparkles className="h-4 w-4" /> {draft.hook_options.length ? "Gerar novas opções" : "Gerar opções"}
                </Button>
              </div>

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
              eyebrow="Resumo da Fase 3"
              title="Roteiro importado, editável e validado"
              description="Importe o JSON Reel 2.0 e revise gancho, promessa, cenas, versão reduzida, publicação e checklist antes de seguir."
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
Com o JSON importado e revisado, o wizard atual recebe gancho, promessa, roteiro por cenas, legenda do vídeo, capa, CTA e hashtags no campo de observações.
                    </p>
                    <Button onClick={onContinueToClassicWizard} className="w-full gap-2">
                      Usar no wizard atual <ArrowRight className="h-4 w-4" />
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
                  <Reel2ScriptStudio
                    script={draft.imported_script}
                    warnings={draft.imported_script_warnings || []}
                    needsReview={Boolean(draft.imported_script_needs_review)}
                    onChange={onUpdateImportedScript}
                  />
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
                <Button onClick={onContinueToClassicWizard}>
                  Usar no wizard atual <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    <ImportReel2ScriptDialog open={importOpen} onOpenChange={setImportOpen} onImport={onImportScript} />
    </div>
  );
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
  presets,
  onUsePreset,
}: {
  draft: Reel2Draft;
  patch: (partial: Partial<Reel2Draft>) => void;
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
              onChange={(event) => patch({ central_idea: event.target.value })}
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
                <Input value={draft.reference_link} onChange={(event) => patch({ reference_link: event.target.value })} placeholder="Cole o link do Reel" />
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
              <Textarea value={draft.reference_transcript} onChange={(event) => patch({ reference_transcript: event.target.value })} rows={5} placeholder="Cole a transcrição ou descreva o que acontece no vídeo." />
            </div>
          </div>
        )}

        {draft.entry_mode === "trend" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Termo, áudio ou formato da trend</Label>
              <Input value={draft.trend_term} onChange={(event) => patch({ trend_term: event.target.value })} placeholder="Ex.: áudio de comparação, mala inteligente, passeio sem puxar" />
            </div>
            <div className="space-y-2">
              <Label>Fonte da tendência</Label>
              <Input value={draft.trend_source} onChange={(event) => patch({ trend_source: event.target.value })} placeholder="Ex.: Instagram, TikTok, YouTube, Google Trends" />
            </div>
          </div>
        )}

        {(draft.entry_mode === "adapt_existing" || draft.entry_mode === "no_ideas") && (
          <div className="space-y-2">
            <Label>{draft.entry_mode === "adapt_existing" ? "Conteúdo base" : "Observação sobre o que você quer evitar ou explorar"}</Label>
            <Textarea
              value={draft.base_content}
              onChange={(event) => patch({ base_content: event.target.value })}
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
  const idea = getEntryMainIdea(draft) || "este assunto";
  const ideaLower = idea.toLowerCase();
  const text = `${brand?.name ?? ""} ${brand?.segment ?? ""} ${brand?.description ?? ""} ${brand?.audience ?? ""} ${idea}`.toLowerCase();
  const canine = /cachorro|canino|adestra|comportamento animal|pet|tutor|passeio/.test(text);
  const travel = /viagem|turismo|travel|hotel|destino|férias|roteiro|passagem|mala|bagagem/.test(text);
  const atelier = /atelier|costura|bolsa|artesanal|moda|acessório/.test(text);
  const accounting = /contabilidade|contador|fiscal|imposto|empresa|mei|cnpj|nota fiscal/.test(text);

  const pick = (items: string[], offset = 0) => items[(Math.max(round, 1) + offset - 1) % items.length];

  const directOptions = canine
    ? [
        `Antes de dizer que seu cachorro não te respeita, observe isto.`,
        `Seu cachorro não está tentando te desafiar: talvez ele só tenha aprendido outra coisa.`,
        `Se o passeio virou uma disputa, comece olhando para este ponto.`,
        `O problema de ${shortIdea(ideaLower)} pode estar sendo reforçado sem você perceber.`,
      ]
    : travel
      ? [
          `Antes de fechar sua próxima viagem, confira este detalhe.`,
          `Se você está planejando viajar, não pule esta etapa.`,
          `Viagem boa começa antes da reserva: veja o que conferir.`,
          `Antes de escolher pelo menor preço, olhe isso com calma.`,
        ]
      : atelier
        ? [
            `Antes de escolher uma peça artesanal, repare neste detalhe.`,
            `Uma peça bonita também precisa fazer sentido na sua rotina.`,
            `O acabamento conta uma história antes mesmo da peça ser usada.`,
          ]
        : accounting
          ? [
              `Antes de resolver isso no automático, confira este ponto.`,
              `Esse cuidado simples pode evitar retrabalho na rotina da empresa.`,
              `Nem todo erro aparece na hora: alguns só surgem no fechamento.`,
            ]
          : [
              `Antes de seguir com ${shortIdea(idea)}, veja este ponto.`,
              `Se esse tema apareceu na sua rotina, comece por aqui.`,
              `Tem um detalhe sobre ${shortIdea(idea)} que muita gente ignora.`,
            ];

  const curiousOptions = canine
    ? [
        `O problema quase nunca começa onde você acha.`,
        `O passeio começa antes da guia sair do gancho.`,
        `O comportamento que incomoda pode estar sendo recompensado sem querer.`,
        `O que parece teimosia pode ser comunicação confusa.`,
      ]
    : travel
      ? [
          `O detalhe que muita gente esquece antes de viajar.`,
          `A parte mais importante da viagem pode não ser o destino.`,
          `O que quase ninguém confere antes de pedir orçamento.`,
          `Uma viagem tranquila começa em uma pergunta simples.`,
        ]
      : atelier
        ? [
            `O detalhe que diferencia uma peça bonita de uma peça bem pensada.`,
            `Quase ninguém olha para isto antes de escolher uma bolsa.`,
            `O processo por trás da peça muda a forma como você enxerga o resultado.`,
          ]
        : accounting
          ? [
              `O detalhe que muita empresa só percebe quando dá problema.`,
              `Esse erro parece pequeno, mas bagunça a rotina depois.`,
              `A organização fiscal começa antes da guia aparecer.`,
            ]
          : [
              `Quase ninguém percebe isso sobre ${shortIdea(idea)}.`,
              `O detalhe escondido neste tema pode mudar sua decisão.`,
              `Tem uma forma mais simples de olhar para ${shortIdea(idea)}.`,
            ];

  const alertOptions = canine
    ? [
        `Você pode estar reforçando esse comportamento sem perceber.`,
        `Cuidado: corrigir na hora errada pode confundir ainda mais o cachorro.`,
        `Não tente resolver ${shortIdea(ideaLower)} sem entender o que acontece antes.`,
        `A bronca pode estar ensinando algo diferente do que você imagina.`,
      ]
    : travel
      ? [
          `Cuidado: o menor preço pode esconder pontos importantes.`,
          `Não feche sua viagem sem entender o que está incluso.`,
          `Um detalhe esquecido pode virar dor de cabeça durante a viagem.`,
          `Nem todo orçamento de viagem compara as mesmas coisas.`,
        ]
      : atelier
        ? [
            `Cuidado: beleza sem funcionalidade pode frustrar no uso diário.`,
            `Nem todo detalhe visual significa acabamento bem resolvido.`,
            `Antes de comprar, pense em como essa peça vai viver com você.`,
          ]
        : accounting
          ? [
              `Cuidado: deixar isso para depois pode criar retrabalho.`,
              `Não espere o problema aparecer para organizar esta rotina.`,
              `Um campo preenchido errado pode mudar todo o fechamento.`,
            ]
          : [
              `Cuidado com este erro ao falar sobre ${shortIdea(idea)}.`,
              `Não avance nesse tema sem conferir este ponto.`,
              `Uma decisão rápida demais pode atrapalhar o resultado.`,
            ];

  const direct = pick(directOptions, 0);
  const curious = pick(curiousOptions, 1);
  const alert = pick(alertOptions, 2);

  return [
    {
      mode: "direct",
      spoken_hook: direct,
      on_screen_text: makeOnScreenText(direct),
      scene_suggestion: pick([
        "Apresentador olhando para a câmera, com corte rápido e expressão clara nos primeiros segundos.",
        "Começar com uma cena real do problema e entrar com a fala logo no primeiro segundo.",
        "Abrir com close no elemento principal do tema, seguido de fala direta para a câmera.",
      ], 0),
      why_it_works: "Vai direto ao ponto e conecta o tema a uma situação reconhecível.",
    },
    {
      mode: "curious",
      spoken_hook: curious,
      on_screen_text: makeOnScreenText(curious),
      scene_suggestion: pick([
        "Começar mostrando a situação antes de explicar a causa, criando curiosidade visual.",
        "Abrir com uma cena aparentemente comum e usar o texto na tela para provocar dúvida.",
        "Mostrar rapidamente o antes/contexto e segurar a explicação para a cena seguinte.",
      ], 1),
      why_it_works: "Abre uma lacuna de curiosidade e promete uma descoberta.",
    },
    {
      mode: "alert",
      spoken_hook: alert,
      on_screen_text: makeOnScreenText(alert),
      scene_suggestion: pick([
        "Texto forte na tela e corte para exemplo prático imediatamente depois.",
        "Iniciar com uma situação de erro comum e pausar rápido para chamar atenção.",
        "Mostrar o risco ou a consequência de forma simples, sem dramatizar demais.",
      ], 2),
      why_it_works: "Cria urgência sem depender de exagero ou promessa falsa.",
    },
  ];
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
