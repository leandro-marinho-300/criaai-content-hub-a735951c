import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  CircleDashed,
  Clock3,
  FileText,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  Palette,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  bootstrap_creation: "Inicializar Creation V2",
  complete_spec: "Completar $Spec",
  generate_strategy: "Gerar Strategy",
  approve_strategy: "Aprovar Strategy",
  generate_copy_core: "Gerar Copy Core",
  approve_copy_core: "Aprovar Copy Core",
  generate_post_copy: "Gerar adaptação de Post",
  approve_post_copy: "Aprovar Copy de Post",
  generate_design: "Gerar Design Spec",
  approve_design: "Aprovar Design Spec",
  produce_asset_from_render_prompt: "Produzir asset",
  run_qa: "Executar QA",
  fix_qa_block: "Corrigir bloqueios do QA",
  send_client_approval: "Enviar para aprovação",
  wait_client_approval: "Aguardar cliente",
  revise_after_client_feedback: "Revisar após feedback",
  ready_for_operations: "Seguir para operação",
  wrong_format: "Corrigir formato",
  resolve_inconsistent_state: "Resolver inconsistência",
};

const SPEC_LABEL: Record<SpecDecisionKey, string> = {
  objective: "Objetivo",
  approach: "Abordagem",
  format: "Formato",
  concept: "Conceito",
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
  { key: "renderPrompt", label: "Render" },
  { key: "production", label: "Asset" },
  { key: "qa", label: "QA" },
  { key: "clientApproval", label: "Cliente" },
  { key: "operations", label: "Operação" },
];

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

function EmptyStage({
  title,
  icon,
}: {
  title: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-muted/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground">{icon}</span>
            {title}
          </CardTitle>
          <Badge variant="outline">
            <CircleDashed className="mr-1 h-3.5 w-3.5" />
            Aguardando Creation
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Este painel será alimentado pelo orquestrador assim que uma Creation V2 for selecionada.
        </p>
      </CardContent>
    </Card>
  );
}

function completedPercent(snapshot: PostV2PipelineSnapshot) {
  const complete = TIMELINE.filter(
    ({ key }) => snapshot.steps[key].state === "complete",
  ).length;
  return Math.round((complete / TIMELINE.length) * 100);
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
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Pipeline V2</Badge>
            <Badge variant="outline">Paralelo</Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold sm:text-3xl">
              {loaded?.project.display_title ||
                loaded?.project.internal_title ||
                "Post V2 Studio"}
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Studio paralelo conectado ao pipeline canônico. Nesta entrega, $Spec, Strategy,
              Copy Core, Post Copy e Design Spec possuem ações operacionais; Render Prompt,
              Asset, QA e aprovação do cliente continuam em leitura.
            </p>
          </div>

          {loaded && (
            <div className="rounded-xl border bg-card px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Creation ID
              </p>
              <p className="max-w-[260px] truncate font-mono text-xs">{loaded.project.id}</p>
            </div>
          )}
        </div>
      </header>

      {!snapshot || !loaded ? (
        <>
          {actionConsole}

          <Card className="border-dashed">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-semibold">Nenhuma Creation V2 selecionada</p>
                <p className="text-sm text-muted-foreground">
                  Inicie um Post V2 acima. O Post atual e o Reel2 seguem preservados em paralelo.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/app/create/post">Continuar usando o Post atual</Link>
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <EmptyStage title="$Spec" icon={<Target className="h-4 w-4" />} />
            <EmptyStage title="Strategy" icon={<RouteIcon className="h-4 w-4" />} />
            <EmptyStage title="Copy" icon={<FileText className="h-4 w-4" />} />
            <EmptyStage title="Design" icon={<Palette className="h-4 w-4" />} />
            <EmptyStage title="Production + QA" icon={<ImageIcon className="h-4 w-4" />} />
            <EmptyStage title="Aprovação" icon={<UserRoundCheck className="h-4 w-4" />} />
          </div>
        </>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Próxima ação canônica
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {ACTION_LABEL[snapshot.nextAction]}
                  </p>
                </div>
                <Badge
                  variant={snapshot.blockingReason ? "destructive" : "secondary"}
                  className="px-3 py-1"
                >
                  {snapshot.blockingReason ? "Bloqueado" : "Orquestrador"}
                </Badge>
              </div>

              {snapshot.blockingReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  {snapshot.blockingReason}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progresso do pipeline</span>
                  <span>{completedPercent(snapshot)}%</span>
                </div>
                <Progress value={completedPercent(snapshot)} />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {TIMELINE.map(({ key, label }) => {
                  const step = snapshot.steps[key];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-lg border px-3 py-2",
                        stepTone(step.state),
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <StepIcon state={step.state} />
                        <span>{label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  A próxima ação vem do orquestrador. A interface libera ações até Design Spec;
                  Render, Asset, QA e aprovação do cliente permanecem somente leitura nesta fase.
                </p>
                {snapshot.readyForOperations ? (
                  <Button asChild size="sm">
                    <Link to="/app/library">Abrir Biblioteca</Link>
                  </Button>
                ) : (
                  <Button size="sm" disabled>
                    Siga a ação operacional abaixo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {actionConsole}

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
                  Render Prompt · somente leitura
                </p>
                <p className="mt-1 text-xs">
                  {STEP_STATE_LABEL[snapshot.steps.renderPrompt.state]}
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
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Asset
                  </p>
                  <p className="mt-1 text-xs">
                    {STEP_STATE_LABEL[snapshot.steps.production.state]}
                  </p>
                </div>
                <div className="rounded-md border bg-background/70 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">QA</p>
                  <p className="mt-1 text-xs">{STEP_STATE_LABEL[snapshot.steps.qa.state]}</p>
                </div>
              </div>
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
                    {STEP_STATE_LABEL[snapshot.steps.clientApproval.state]}
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
            </StageCard>
          </div>
        </>
      )}
    </div>
  );
}
