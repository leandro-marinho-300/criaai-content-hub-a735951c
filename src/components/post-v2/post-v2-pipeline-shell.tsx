import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  ChevronDown,
  Info,
  FileText,
  Layers3,
  LockKeyhole,
  Palette,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  PostV2PipelineAction,
  PostV2PipelineSnapshot,
  PostV2PipelineStep,
  PostV2StepState,
} from "@/lib/creation/post-v2-pipeline";
import type { LoadedPostV2Pipeline } from "@/lib/creation/post-v2-pipeline-loader";
import type { SpecDecisionKey } from "@/lib/creation/spec";

const STEP_STATE_LABEL: Record<PostV2StepState, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  ready: "Pronto",
  complete: "Concluído",
  review_required: "Revisão necessária",
  blocked: "Bloqueado",
};

const ACTION_LABEL: Record<PostV2PipelineAction, string> = {
  bootstrap_creation: "Preparar criação",
  complete_spec: "Definir direção",
  generate_strategy: "Criar estratégia",
  approve_strategy: "Revisar estratégia",
  generate_copy_core: "Criar mensagem central",
  approve_copy_core: "Aprovar mensagem",
  generate_post_copy: "Escrever o Post",
  approve_post_copy: "Aprovar texto",
  generate_design: "Definir direção visual",
  approve_design: "Aprovar direção visual",
  produce_asset_from_render_prompt: "Produzir peça",
  run_qa: "Revisar peça",
  fix_qa_block: "Corrigir peça",
  send_client_approval: "Enviar ao cliente",
  wait_client_approval: "Aguardando cliente",
  revise_after_client_feedback: "Revisar feedback do cliente",
  ready_for_operations: "Publicar ou agendar",
  wrong_format: "Revisar formato",
  resolve_inconsistent_state: "Revisar estado da criação",
};

const SPEC_LABEL: Record<SpecDecisionKey, string> = {
  objective: "Objetivo",
  approach: "Abordagem",
  format: "Formato",
  concept: "Conceito",
};

const OBJECTIVE_DISPLAY: Record<string, string> = {
  engage: "Engajar",
  convert: "Converter",
  inform_position: "Informar & posicionar",
};

const APPROACH_DISPLAY: Record<string, string> = {
  viral: "Viral",
  educational: "Educativo",
  community: "Comunidade",
  offer: "Oferta",
  storytelling: "Storytelling",
  social_proof: "Prova social",
};

const TIMELINE: Array<{
  key: keyof PostV2PipelineSnapshot["steps"];
  label: string;
}> = [
  { key: "spec", label: "$Spec" },
  { key: "strategy", label: "Strategy" },
  { key: "copyCore", label: "Copy Core" },
  { key: "postCopy", label: "Post Copy" },
  { key: "design", label: "Design" },
  { key: "renderPrompt", label: "Render Prompt" },
  { key: "production", label: "Asset" },
  { key: "qa", label: "QA" },
  { key: "clientApproval", label: "Cliente" },
  { key: "operations", label: "Operação" },
];

const EXPERIENCE_PHASES: Array<{
  label: string;
  keys: Array<keyof PostV2PipelineSnapshot["steps"]>;
}> = [
  { label: "Direção", keys: ["spec", "strategy"] },
  { label: "Conteúdo", keys: ["copyCore", "postCopy"] },
  { label: "Visual", keys: ["design", "renderPrompt", "production"] },
  { label: "Revisão", keys: ["qa", "clientApproval"] },
  { label: "Publicação", keys: ["operations"] },
];

const ACTION_DESCRIPTION: Record<PostV2PipelineAction, string> = {
  bootstrap_creation: "Prepare a estrutura desta criação para começar.",
  complete_spec: "Falta uma decisão para fechar a direção do conteúdo.",
  generate_strategy: "Organize a estratégia que vai orientar todo o conteúdo.",
  approve_strategy: "Confira a estratégia antes de seguir para o texto.",
  generate_copy_core: "Transforme a estratégia na mensagem central da peça.",
  approve_copy_core: "Revise a mensagem central antes da adaptação para Post.",
  generate_post_copy: "Prepare headline, apoio, legenda e CTA do Post.",
  approve_post_copy: "Confira o texto final que seguirá para a direção visual.",
  generate_design: "Defina a direção visual da peça sem produzir a arte ainda.",
  approve_design: "Revise a direção visual antes de congelá-la para produção.",
  produce_asset_from_render_prompt: "Use o Render Prompt aprovado para produzir e registrar a peça final.",
  run_qa: "Revise a peça final antes de enviá-la ao cliente.",
  fix_qa_block: "Corrija a peça conforme os bloqueios encontrados no QA.",
  send_client_approval: "Envie a versão revisada para decisão do cliente.",
  wait_client_approval: "O link já foi enviado. Aguardamos a decisão do cliente.",
  revise_after_client_feedback: "O cliente pediu revisão. O avanço fica bloqueado até a correção.",
  ready_for_operations: "A versão aprovada está pronta para Biblioteca e Calendário.",
  wrong_format: "Esta Creation precisa ser corrigida antes de continuar no Post V2.",
  resolve_inconsistent_state: "Há uma inconsistência de estado que precisa ser resolvida antes de continuar.",
};

function StepIcon({ state }: { state: PostV2StepState }) {
  if (state === "complete") return <CheckCircle2 className="h-4 w-4" />;
  if (state === "blocked") return <LockKeyhole className="h-4 w-4" />;
  if (state === "review_required") return <AlertTriangle className="h-4 w-4" />;
  if (state === "in_progress") return <Clock3 className="h-4 w-4" />;
  if (state === "ready") return <Sparkles className="h-4 w-4" />;
  return <Circle className="h-4 w-4" />;
}

function stepTone(state: PostV2StepState) {
  if (state === "complete") return "border-emerald-500/30 bg-emerald-500/5";
  if (state === "blocked") return "border-destructive/40 bg-destructive/5";
  if (state === "review_required") return "border-amber-500/40 bg-amber-500/5";
  if (state === "in_progress" || state === "ready")
    return "border-primary/40 bg-primary/5";
  return "border-border/60 bg-muted/20";
}

function StepStatus({ step }: { step: PostV2PipelineStep }) {
  return (
    <Badge
      variant={
        step.state === "blocked"
          ? "destructive"
          : step.state === "complete"
            ? "default"
            : "outline"
      }
      className="shrink-0"
    >
      <StepIcon state={step.state} />
      <span className="ml-1">{STEP_STATE_LABEL[step.state]}</span>
    </Badge>
  );
}

function StageCard({
  title,
  icon,
  step,
  children,
}: {
  title: string;
  icon: ReactNode;
  step: PostV2PipelineStep;
  children?: ReactNode;
}) {
  return (
    <Card className={cn("border", stepTone(step.state))}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <span className="text-muted-foreground">{icon}</span>
            <span className="truncate">{title}</span>
          </CardTitle>
          <StepStatus step={step} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{step.message}</p>
        {step.versionId && (
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            versão: {step.versionId}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function displayStepState(
  snapshot: PostV2PipelineSnapshot,
  key: keyof PostV2PipelineSnapshot["steps"],
): PostV2StepState {
  const state = snapshot.steps[key].state;

  // The canonical orchestrator keeps Render Prompt as `ready` because it is an
  // input for Production. In the progress UI, however, a valid deterministic
  // Render Prompt is already a completed pipeline artifact. Keep this strictly
  // presentational so no orchestration/business rule changes.
  if (key === "renderPrompt" && snapshot.renderPromptPlan && state === "ready") {
    return "complete";
  }

  return state;
}

function completedPercent(snapshot: PostV2PipelineSnapshot) {
  const complete = TIMELINE.filter(
    ({ key }) => displayStepState(snapshot, key) === "complete",
  ).length;
  return Math.round((complete / TIMELINE.length) * 100);
}

function experiencePhaseState(
  snapshot: PostV2PipelineSnapshot,
  keys: Array<keyof PostV2PipelineSnapshot["steps"]>,
): PostV2StepState {
  const states = keys.map((key) => displayStepState(snapshot, key));
  if (states.every((state) => state === "complete")) return "complete";
  if (states.includes("blocked")) return "blocked";
  if (states.includes("review_required")) return "review_required";
  if (states.includes("in_progress")) return "in_progress";
  if (states.includes("ready")) return "ready";
  if (states.includes("complete")) return "in_progress";
  return "not_started";
}

function postCopyPreview(loaded: LoadedPostV2Pipeline) {
  const copy = loaded.copy.approvedVersion ?? loaded.copy.currentVersion;
  const extension =
    copy?.formatExtension &&
    typeof copy.formatExtension === "object" &&
    !Array.isArray(copy.formatExtension)
      ? (copy.formatExtension as Record<string, unknown>)
      : null;

  const text = (key: string) => {
    const candidate = extension?.[key];
    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim()
      : null;
  };

  return {
    headline: text("headline") ?? copy?.core.primaryMessage ?? null,
    supportText: text("support_text"),
    caption: text("caption"),
    cta: text("cta") ?? copy?.core.cta?.wording ?? null,
  };
}

function versionLabel(version: { versionNumber: number; approvalStatus: string } | null) {
  if (!version) return "Nenhuma versão";
  return `v${version.versionNumber} · ${version.approvalStatus}`;
}

export function PostV2PipelineShell({
  loaded,
  actionConsole,
}: {
  loaded: LoadedPostV2Pipeline | null;
  actionConsole: ReactNode;
}) {
  const snapshot = loaded?.snapshot ?? null;
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const preview = loaded ? postCopyPreview(loaded) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/create">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Oficina Criativa
            </Link>
          </Button>
          <Badge variant="secondary">Post</Badge>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {loaded?.project.display_title ||
              loaded?.project.internal_title ||
              "Criar Post"}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {loaded?.project.theme?.trim() ||
              "Organize a ideia, aprove o conteúdo e leve a versão final até a publicação."}
          </p>
          {loaded && (
            <div className="flex flex-wrap gap-2 pt-1">
              {loaded.spec.decisions.objective?.value && (
                <Badge variant="outline">
                  Objetivo · {OBJECTIVE_DISPLAY[loaded.spec.decisions.objective.value] ?? loaded.spec.decisions.objective.value}
                </Badge>
              )}
              {loaded.spec.decisions.approach?.value && (
                <Badge variant="outline">
                  Abordagem · {APPROACH_DISPLAY[loaded.spec.decisions.approach.value] ?? loaded.spec.decisions.approach.value}
                </Badge>
              )}
            </div>
          )}
        </div>
      </header>

      {!snapshot || !loaded ? (
        <div className="space-y-5">
          {actionConsole}
          <Card className="border-dashed bg-muted/10">
            <CardContent className="p-6">
              <div className="mx-auto max-w-2xl text-center">
                <Sparkles className="mx-auto h-6 w-6 text-primary" />
                <h2 className="mt-3 text-lg font-semibold">Uma criação por vez, sem perder o contexto</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  O Post V2 conduz a criação pela próxima decisão necessária. Versões, bloqueios e histórico continuam registrados em segundo plano.
                </p>
                <Button asChild variant="link" className="mt-2">
                  <Link to="/app/create/post">Continuar usando o Post atual</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
            <Card className={cn(
              "overflow-hidden border",
              snapshot.blockingReason ? "border-destructive/40" : "border-primary/20",
            )}>
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Agora
                    </p>
                    <h2 className="text-xl font-semibold">{ACTION_LABEL[snapshot.nextAction]}</h2>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {ACTION_DESCRIPTION[snapshot.nextAction]}
                    </p>
                  </div>
                  <Badge variant={snapshot.blockingReason ? "destructive" : "secondary"}>
                    {snapshot.blockingReason ? "Precisa de atenção" : `${completedPercent(snapshot)}% concluído`}
                  </Badge>
                </div>

                {snapshot.blockingReason && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    {snapshot.blockingReason}
                  </div>
                )}

                <Progress value={completedPercent(snapshot)} className="h-2" />

                <div className="grid gap-2 sm:grid-cols-5">
                  {EXPERIENCE_PHASES.map((phase) => {
                    const state = experiencePhaseState(snapshot, phase.keys);
                    return (
                      <div
                        key={phase.label}
                        className={cn(
                          "rounded-xl border px-3 py-2.5",
                          stepTone(state),
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <StepIcon state={state} />
                          <span>{phase.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Conteúdo em construção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {preview?.headline ? (
                  <>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Headline</p>
                      <p className="mt-1 text-sm font-semibold leading-snug">{preview.headline}</p>
                    </div>
                    {preview.supportText && (
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Apoio</p>
                        <p className="mt-1 text-sm text-muted-foreground">{preview.supportText}</p>
                      </div>
                    )}
                    {preview.caption && (
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Legenda</p>
                        <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{preview.caption}</p>
                      </div>
                    )}
                    {preview.cta && (
                      <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">CTA · </span>{preview.cta}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-sm font-medium">{loaded.project.theme || "Conteúdo ainda em definição"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      O resumo ganha forma conforme Strategy e Copy são aprovadas.
                    </p>
                  </div>
                )}

                {loaded.production.currentAsset && (
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Peça final</p>
                    <p className="mt-1 truncate text-sm font-medium">
                      {loaded.production.currentPieceAsset?.file_name ?? `Asset v${loaded.production.currentAsset.versionNumber}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      v{loaded.production.currentAsset.versionNumber}
                      {loaded.production.latestQaReview ? ` · QA ${loaded.production.latestQaReview.overallStatus}` : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <section className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Próximo passo</h2>
            </div>
          {actionConsole}
          </section>

          <Collapsible open={technicalOpen} onOpenChange={setTechnicalOpen}>
            <Card className="border-dashed bg-muted/5">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-auto w-full justify-between px-5 py-4 text-left">
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span>Detalhes técnicos e histórico</span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", technicalOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-5 border-t px-5 py-5">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {TIMELINE.map(({ key, label }) => {
                      const state = displayStepState(snapshot, key);
                      return (
                        <div key={key} className={cn("rounded-lg border px-3 py-2", stepTone(state))}>
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <StepIcon state={state} />
                            <span>{label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Creation ID:</span>{" "}
                    <span className="font-mono">{loaded.project.id}</span>
                  </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <StageCard
              title="$Spec"
              icon={<Target className="h-4 w-4" />}
              step={snapshot.steps.spec}
            >
              <div className="grid grid-cols-2 gap-2">
                {(["objective", "approach", "format", "concept"] as const).map((key) => {
                  const decision = loaded.spec.decisions[key];
                  return (
                    <div key={key} className="rounded-md border bg-background/70 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {SPEC_LABEL[key]}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium">
                        {decision?.value ?? "Pendente"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </StageCard>

            <StageCard
              title="Strategy"
              icon={<RouteIcon className="h-4 w-4" />}
              step={snapshot.steps.strategy}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Atual
                  </p>
                  <p className="mt-1 text-xs">{versionLabel(loaded.strategy.currentVersion)}</p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Aprovada
                  </p>
                  <p className="mt-1 text-xs">{versionLabel(loaded.strategy.approvedVersion)}</p>
                </div>
              </div>
            </StageCard>

            <StageCard
              title="Copy"
              icon={<FileText className="h-4 w-4" />}
              step={
                snapshot.steps.postCopy.state === "not_started"
                  ? snapshot.steps.copyCore
                  : snapshot.steps.postCopy
              }
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Versão atual
                  </p>
                  <p className="mt-1 text-xs">{versionLabel(loaded.copy.currentVersion)}</p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Versão aprovada
                  </p>
                  <p className="mt-1 text-xs">{versionLabel(loaded.copy.approvedVersion)}</p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Copy Core
                  </p>
                  <p className="mt-1 text-xs">{STEP_STATE_LABEL[snapshot.steps.copyCore.state]}</p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Post Adapter
                  </p>
                  <p className="mt-1 text-xs">{STEP_STATE_LABEL[snapshot.steps.postCopy.state]}</p>
                </div>
              </div>
            </StageCard>

            <StageCard
              title="Design"
              icon={<Palette className="h-4 w-4" />}
              step={snapshot.steps.design}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Versão atual
                  </p>
                  <p className="mt-1 text-xs">{versionLabel(loaded.design.currentVersion)}</p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Versão aprovada
                  </p>
                  <p className="mt-1 text-xs">{versionLabel(loaded.design.approvedVersion)}</p>
                </div>
              </div>

              {loaded.design.currentVersion && (
                <div className="space-y-2 rounded-md border bg-background/70 p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sistema visual</p>
                    <p className="mt-1 text-xs">{loaded.design.currentVersion.design.visualSystem}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conceito de composição</p>
                    <p className="mt-1 text-xs">{loaded.design.currentVersion.design.compositionConcept}</p>
                  </div>
                </div>
              )}

              <div className="rounded-md border bg-background/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Render Prompt canônico
                </p>
                <p className="mt-1 text-xs">
                  {STEP_STATE_LABEL[displayStepState(snapshot, "renderPrompt")]}
                </p>
              </div>
            </StageCard>

            <StageCard
              title="Production + QA"
              icon={<Layers3 className="h-4 w-4" />}
              step={
                snapshot.steps.qa.state === "not_started"
                  ? snapshot.steps.production
                  : snapshot.steps.qa
              }
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Render Prompt
                  </p>
                  <p className="mt-1 text-xs">
                    {STEP_STATE_LABEL[displayStepState(snapshot, "renderPrompt")]}
                  </p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Asset final
                  </p>
                  <p className="mt-1 text-xs">
                    {loaded.production.currentAsset
                      ? `v${loaded.production.currentAsset.versionNumber} · registrado`
                      : "Não produzido"}
                  </p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">QA</p>
                  <p className="mt-1 text-xs">
                    {loaded.production.latestQaReview
                      ? `${loaded.production.latestQaReview.overallStatus} · ${STEP_STATE_LABEL[snapshot.steps.qa.state]}`
                      : STEP_STATE_LABEL[snapshot.steps.qa.state]}
                  </p>
                </div>
              </div>

              {loaded.production.currentAsset && (
                <div className="rounded-md border bg-background/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Production Asset atual
                      </p>
                      <p className="mt-1 text-xs font-medium">
                        {loaded.production.currentPieceAsset?.file_name ??
                          `Asset v${loaded.production.currentAsset.versionNumber}`}
                      </p>
                    </div>
                    <Badge variant="outline">v{loaded.production.currentAsset.versionNumber}</Badge>
                  </div>
                  <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                    <p>Origem: {loaded.production.currentAsset.provenance.source ?? "não informada"}</p>
                    <p>Render: {loaded.production.currentAsset.provenance.renderPromptVersion ?? "não informado"}</p>
                    {loaded.production.currentPieceAsset && (
                      <>
                        <p>Tipo: {loaded.production.currentPieceAsset.file_type}</p>
                        <p>
                          Tamanho: {(loaded.production.currentPieceAsset.file_size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {loaded.production.latestQaReview && (
                <div className="space-y-3 rounded-md border bg-background/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">QA atual</p>
                      <p className="mt-1 text-xs font-medium">
                        Review #{loaded.production.latestQaReview.reviewNumber}
                      </p>
                    </div>
                    <Badge
                      variant={
                        loaded.production.latestQaReview.overallStatus === "BLOCK"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {loaded.production.latestQaReview.overallStatus}
                    </Badge>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border p-2 text-[11px]">
                      <span className="text-muted-foreground">Factual</span> · {loaded.production.latestQaReview.statuses.factual}
                    </div>
                    <div className="rounded-md border p-2 text-[11px]">
                      <span className="text-muted-foreground">Estratégico</span> · {loaded.production.latestQaReview.statuses.strategic}
                    </div>
                    <div className="rounded-md border p-2 text-[11px]">
                      <span className="text-muted-foreground">Marca</span> · {loaded.production.latestQaReview.statuses.brand}
                    </div>
                    <div className="rounded-md border p-2 text-[11px]">
                      <span className="text-muted-foreground">Visual / técnico</span> · {loaded.production.latestQaReview.statuses.visualTechnical}
                    </div>
                  </div>

                  {loaded.production.latestQaReview.findings.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Achados</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                        {loaded.production.latestQaReview.findings.map((finding, index) => (
                          <li key={`${finding.code}-${index}`}>
                            {finding.status} · {finding.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </StageCard>

            <StageCard
              title="Aprovação + Operação"
              icon={<ShieldCheck className="h-4 w-4" />}
              step={
                snapshot.steps.operations.state === "ready"
                  ? snapshot.steps.operations
                  : snapshot.steps.clientApproval
              }
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Cliente
                  </p>
                  <p className="mt-1 text-xs">
                    {loaded.clientApproval
                      ? loaded.clientApproval.status
                      : STEP_STATE_LABEL[snapshot.steps.clientApproval.state]}
                  </p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Library / Calendar
                  </p>
                  <p className="mt-1 text-xs">
                    {STEP_STATE_LABEL[snapshot.steps.operations.state]}
                  </p>
                </div>
              </div>

              {loaded.clientApproval && (
                <div className="space-y-2 rounded-md border bg-background/70 p-3 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Aprovação atual</span>
                    <Badge variant="outline">
                      {loaded.clientApproval.view_count} visualização(ões)
                    </Badge>
                  </div>
                  <div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
                    <p>Enviada: {new Date(loaded.clientApproval.created_at).toLocaleString("pt-BR")}</p>
                    <p>Última visualização: {loaded.clientApproval.last_viewed_at ? new Date(loaded.clientApproval.last_viewed_at).toLocaleString("pt-BR") : "—"}</p>
                    {loaded.clientApproval.submitted_at && (
                      <p>Respondida: {new Date(loaded.clientApproval.submitted_at).toLocaleString("pt-BR")}</p>
                    )}
                    {loaded.clientApproval.client_name && (
                      <p>Cliente: {loaded.clientApproval.client_name}</p>
                    )}
                  </div>
                  {loaded.clientApproval.general_comment && (
                    <p className="line-clamp-3 text-muted-foreground">
                      Feedback: {loaded.clientApproval.general_comment}
                    </p>
                  )}
                </div>
              )}
            </StageCard>
          </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}
    </div>
  );
}
