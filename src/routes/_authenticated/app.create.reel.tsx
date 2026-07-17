import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Check,
  ChevronDown,
  Clapperboard,
  CopyCheck,
  Film,
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
  DEFAULT_REEL2_DRAFT,
  REEL2_DRAFT_KEY,
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

export const Route = createFileRoute("/_authenticated/app/create/reel")({
  head: () => ({ meta: [{ title: "Criar Reel 2.0 — Cria Aí" }] }),
  component: CreateReel2,
});

const STEP_LABELS = ["Entrada", "Marca", "Objetivo", "Tipo", "Promessa", "Gancho", "Resumo"] as const;
const FUTURE_STEPS = ["Roteiro", "Capa", "Publicação", "Storyboard", "Aprovação"];

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const entryIconMap: Record<Reel2EntryMode, typeof Lightbulb> = {
  idea: Lightbulb,
  no_ideas: Sparkles,
  preset: Wand2,
  remix: RefreshCw,
  trend: Megaphone,
  adapt_existing: CopyCheck,
};

function CreateReel2() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepIndex>(0);
  const [draft, setDraft] = useState<Reel2Draft>(() => loadReel2Draft());

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
    const options = buildLocalHookOptions(draft, selectedBrand);
    patch({ hook_options: options, selected_hook_index: 0 });
    toast.success("3 opções de gancho foram preparadas para esta fase.");
  };

  const onUsePreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    setDraft((current) => applyPresetToReelDraft({ ...current, preset_id: presetId }, preset));
    toast.success("Preset aplicado ao rascunho do Reel.");
  };

  const onContinueToClassicWizard = () => {
    try {
      localStorage.setItem(REEL2_WIZARD_PREFILL_KEY, JSON.stringify(buildReel2WizardPrefill(draft, selectedBrand)));
      toast.success("Rascunho enviado para o wizard atual.");
      navigate({ to: "/app/content/new" });
    } catch {
      toast.error("Não foi possível preparar o wizard atual.");
    }
  };

  const onReset = () => {
    clearReel2Draft();
    setDraft(DEFAULT_REEL2_DRAFT);
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
                Fase 1 · Cria Aí 2.0
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                Estrutura guiada
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
                  <span>Progresso da Fase 1</span>
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
                Nesta primeira entrega, estamos criando a estrutura guiada. A geração do JSON Reel 2.0 entra nas próximas fases.
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
                          patch({ brand_id: brandId, brand_snapshot: snapshotBrand(brand) });
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
                        placeholder="Ex.: meu cachorro não me respeita no passeio"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Promessa do vídeo</Label>
                      <Textarea
                        value={draft.promise}
                        onChange={(event) => patch({ promise: event.target.value })}
                        placeholder="Ex.: Você vai entender por que o problema no passeio quase nunca começa na rua."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Observações extras para o Reel</Label>
                      <Textarea
                        value={draft.extra_notes}
                        onChange={(event) => patch({ extra_notes: event.target.value })}
                        placeholder="Regras da marca, cuidados, pontos obrigatórios ou restrições."
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
                  <Sparkles className="h-4 w-4" /> Gerar opções
                </Button>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
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
              eyebrow="Resumo da Fase 1"
              title="Estrutura guiada pronta"
              description="Este rascunho ainda não gera o JSON Reel 2.0 final. Ele organiza as decisões que alimentarão as próximas fases."
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Resumo do Reel</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <SummaryRow label="Marca" value={selectedBrand?.name || "Não selecionada"} />
                    <SummaryRow label="Entrada" value={REEL2_ENTRY_OPTIONS.find((item) => item.id === draft.entry_mode)?.title || "Não definida"} />
                    <SummaryRow label="Objetivo" value={selectedObjective?.title || "Não definido"} />
                    <SummaryRow label="Tipo" value={selectedType?.title || "Não definido"} />
                    <SummaryRow label="Ideia" value={getEntryMainIdea(draft) || "Não definida"} />
                    <SummaryRow label="Promessa" value={draft.promise || "Não definida"} />
                    <SummaryRow label="Gancho escolhido" value={selectedHook?.spoken_hook || selectedHook?.on_screen_text || "Não escolhido"} />
                    <SummaryRow label="Capa" value={coverModeLabel(draft.cover_mode)} />
                  </CardContent>
                </Card>

                <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-2 font-semibold">
                      <RouteIcon className="h-4 w-4 text-orange-500" /> Caminho de continuidade
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enquanto as fases 2 a 5 não entram, você pode mandar este rascunho para o wizard atual e continuar usando o fluxo estável.
                    </p>
                    <Button onClick={onContinueToClassicWizard} className="w-full gap-2">
                      Continuar no wizard atual <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                      <Link to="/app/create">Voltar para Criar</Link>
                    </Button>
                  </CardContent>
                </Card>
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
    <Card className={cn(active ? "border-orange-500 ring-2 ring-orange-500/20" : "border-border/70")}>
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
          <Input value={hook.on_screen_text} onChange={(event) => onChange({ ...hook, on_screen_text: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Cena sugerida</Label>
          <Textarea value={hook.scene_suggestion} onChange={(event) => onChange({ ...hook, scene_suggestion: event.target.value })} rows={2} />
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

function buildLocalHookOptions(draft: Reel2Draft, brand?: Tables<"brands"> | null): Reel2HookDraft[] {
  const idea = getEntryMainIdea(draft) || "este assunto";
  const segment = brand?.segment?.toLowerCase() || "";
  const canine = /cachorro|canino|adestra|comportamento/.test(segment + " " + idea.toLowerCase());
  const travel = /viagem|turismo|travel|hotel|destino/.test(segment + " " + idea.toLowerCase());
  const direct = canine
    ? `Antes de dizer que seu cachorro não te respeita, observe isso.`
    : travel
      ? `Antes de fechar sua próxima viagem, confira isso.`
      : `Antes de seguir com ${idea}, veja este ponto.`;
  const curious = canine
    ? `O problema quase nunca começa onde você acha.`
    : travel
      ? `O detalhe que muita gente esquece antes de viajar.`
      : `Quase ninguém percebe isso sobre ${idea}.`;
  const alert = canine
    ? `Você pode estar reforçando esse comportamento sem perceber.`
    : travel
      ? `Cuidado: o menor preço pode esconder pontos importantes.`
      : `Cuidado com este erro ao falar sobre ${idea}.`;
  return [
    {
      mode: "direct",
      spoken_hook: direct,
      on_screen_text: direct.replace(/\.$/, ""),
      scene_suggestion: "Apresentador olhando para câmera, corte rápido e expressão clara nos primeiros segundos.",
      why_it_works: "Vai direto ao ponto e conecta o tema a uma situação reconhecível.",
    },
    {
      mode: "curious",
      spoken_hook: curious,
      on_screen_text: curious.replace(/\.$/, ""),
      scene_suggestion: "Começar com uma cena do problema antes de explicar a causa.",
      why_it_works: "Abre uma lacuna de curiosidade e promete uma descoberta.",
    },
    {
      mode: "alert",
      spoken_hook: alert,
      on_screen_text: alert.replace(/\.$/, ""),
      scene_suggestion: "Texto forte na tela e corte para exemplo prático imediatamente depois.",
      why_it_works: "Cria urgência sem depender de exagero ou promessa falsa.",
    },
  ];
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
