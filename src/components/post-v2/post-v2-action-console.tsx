import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Clipboard, Loader2, Play, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LoadedPostV2Pipeline } from "@/lib/creation/post-v2-pipeline-loader";
import {
  approveCopy,
  approveDesign,
  approveStrategy,
  bootstrapExistingPostV2,
  bootstrapPostV2,
  importCopyResponse,
  importPostCopyResponse,
  importStrategyResponse,
  importVisualDirectorResponse,
  listPostV2Brands,
  prepareCopyManualTask,
  preparePostCopyManualTask,
  prepareStrategyManualTask,
  prepareVisualDirectorManualTask,
  savePostV2SpecDecision,
  type PreparedManualTask,
} from "@/lib/creation/post-v2-workflow";
import { getNextSpecDecision, type SpecDecisionKey } from "@/lib/creation/spec";

const OBJECTIVE_OPTIONS = [
  ["engage", "Engajar"],
  ["convert", "Converter"],
  ["inform_position", "Informar & Posicionar"],
] as const;

const APPROACH_OPTIONS = [
  ["viral", "Viral"],
  ["educational", "Educativo"],
  ["community", "Comunidade"],
  ["offer", "Oferta"],
  ["storytelling", "Storytelling"],
  ["social_proof", "Prova Social"],
] as const;

const SPEC_LABEL: Record<SpecDecisionKey, string> = {
  objective: "Objetivo",
  approach: "Abordagem",
  format: "Formato",
  concept: "Conceito",
};

type Props = {
  loaded: LoadedPostV2Pipeline | null;
  onChanged: () => Promise<unknown> | unknown;
  onBootstrapped: (projectId: string) => void;
};

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}

export function PostV2ActionConsole({ loaded, onChanged, onBootstrapped }: Props) {
  if (!loaded) {
    return <BootstrapCard onBootstrapped={onBootstrapped} />;
  }

  const action = loaded.snapshot.nextAction;

  if (action === "bootstrap_creation") {
    return (
      <SimpleActionCard
        title="Inicializar Creation V2"
        description="Este projeto ainda é apenas um envelope operacional. A inicialização cria os estados V2 sem alterar o conteúdo antigo."
        actionLabel="Inicializar V2"
        run={() => bootstrapExistingPostV2(loaded.project.id)}
        onChanged={onChanged}
      />
    );
  }

  if (action === "complete_spec") {
    return <SpecCard loaded={loaded} onChanged={onChanged} />;
  }

  if (action === "generate_strategy") {
    return (
      <ManualTaskCard
        title="Strategy externa"
        description="Prepare o briefing, copie para o ChatGPT externo e importe somente o JSON retornado."
        existingRun={loaded.aiTasks.strategy ? {
          runId: loaded.aiTasks.strategy.id,
          promptText: loaded.aiTasks.strategy.promptText,
          taskType: "strategy",
        } : null}
        prepare={() => prepareStrategyManualTask(loaded.project.id, loaded.spec)}
        importResponse={(runId, response) => importStrategyResponse({ projectId: loaded.project.id, spec: loaded.spec, runId, response })}
        onChanged={onChanged}
      />
    );
  }

  if (action === "approve_strategy") {
    const current = loaded.strategy.currentVersion;
    return (
      <SimpleActionCard
        title="Revisar e aprovar Strategy"
        description={current ? `Strategy v${current.versionNumber} está pronta para aprovação. A aprovação congela o Brand Snapshot usado pela Copy.` : "Nenhuma Strategy atual encontrada."}
        actionLabel="Aprovar Strategy"
        disabled={!current}
        run={() => approveStrategy(loaded.project.id, current!.id)}
        onChanged={onChanged}
      />
    );
  }

  if (action === "generate_copy_core") {
    return (
      <ManualTaskCard
        title="Copy Core externa"
        description="A Copy usa somente a Strategy aprovada e o Brand Snapshot congelado."
        existingRun={loaded.aiTasks.copyCore ? {
          runId: loaded.aiTasks.copyCore.id,
          promptText: loaded.aiTasks.copyCore.promptText,
          taskType: "copy",
        } : null}
        prepare={() => prepareCopyManualTask(loaded.project.id)}
        importResponse={(runId, response) => importCopyResponse({ projectId: loaded.project.id, runId, response })}
        onChanged={onChanged}
      />
    );
  }

  if (action === "approve_copy_core") {
    const current = loaded.copy.currentVersion;
    return (
      <SimpleActionCard
        title="Revisar e aprovar Copy Core"
        description={current ? current.core.primaryMessage : "Nenhuma Copy atual encontrada."}
        actionLabel="Aprovar Copy Core"
        disabled={!current}
        run={() => approveCopy(loaded.project.id, current!.id)}
        onChanged={onChanged}
      />
    );
  }

  if (action === "generate_post_copy") {
    return (
      <ManualTaskCard
        title="Adaptar Copy para Post"
        description="O adapter organiza headline, apoio, legenda e hashtags sem reescrever a Copy Core aprovada."
        existingRun={loaded.aiTasks.postCopy ? {
          runId: loaded.aiTasks.postCopy.id,
          promptText: loaded.aiTasks.postCopy.promptText,
          taskType: "copy",
        } : null}
        prepare={() => preparePostCopyManualTask(loaded.project.id)}
        importResponse={(runId, response) => importPostCopyResponse({ projectId: loaded.project.id, runId, response })}
        onChanged={onChanged}
      />
    );
  }

  if (action === "approve_post_copy") {
    const current = loaded.copy.currentVersion;
    const extension = current?.formatExtension && typeof current.formatExtension === "object" && !Array.isArray(current.formatExtension)
      ? current.formatExtension as Record<string, unknown>
      : null;
    const headline = typeof extension?.headline === "string" ? extension.headline : current?.core.primaryMessage;
    return (
      <SimpleActionCard
        title="Aprovar Copy de Post"
        description={headline || "A adaptação de Post está pronta para revisão."}
        actionLabel="Aprovar Copy de Post"
        disabled={!current}
        run={() => approveCopy(loaded.project.id, current!.id)}
        onChanged={onChanged}
      />
    );
  }

  if (action === "generate_design") {
    return (
      <ManualTaskCard
        title="Visual Director · Design Spec"
        description="Transforme a Post Copy aprovada em uma direção visual canônica. Esta etapa não gera arte, Render Prompt ou asset final."
        existingRun={loaded.aiTasks.visualDirector ? {
          runId: loaded.aiTasks.visualDirector.id,
          promptText: loaded.aiTasks.visualDirector.promptText,
          taskType: "visual_direction",
        } : null}
        prepare={() => prepareVisualDirectorManualTask(loaded.project.id)}
        importResponse={(runId, response) => importVisualDirectorResponse({
          projectId: loaded.project.id,
          runId,
          response,
        })}
        onChanged={onChanged}
      />
    );
  }

  if (action === "approve_design") {
    return <DesignApprovalCard loaded={loaded} onChanged={onChanged} />;
  }

  if (action === "produce_asset_from_render_prompt") {
    return (
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Design aprovado · checkpoint desta entrega</AlertTitle>
        <AlertDescription>
          O Design Spec está aprovado e o Render Prompt canônico já pode ser derivado pelo orquestrador. Produção do asset continua fora do escopo operacional desta fase.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <Sparkles className="h-4 w-4" />
      <AlertTitle>Ação fora do escopo operacional atual</AlertTitle>
      <AlertDescription>
        O Studio respeitou a próxima ação do orquestrador, mas esta entrega libera ações somente até a aprovação do Design Spec.
      </AlertDescription>
    </Alert>
  );
}

function BootstrapCard({ onBootstrapped }: { onBootstrapped: (projectId: string) => void }) {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [brandId, setBrandId] = useState("");
  const brands = useQuery({ queryKey: ["post-v2-brands"], queryFn: listPostV2Brands });
  const create = useMutation({
    mutationFn: () => bootstrapPostV2({ title, theme, brandId: brandId || null }),
    onSuccess: (projectId) => {
      toast.success("Creation V2 criada.");
      onBootstrapped(projectId);
    },
    onError: (error) => toast.error(mutationError(error)),
  });

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Começar um Post V2</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="post-v2-title">Nome interno</Label>
          <Input id="post-v2-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Dia do Voluntariado" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="post-v2-brand">Marca</Label>
          <select id="post-v2-brand" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Sem marca definida</option>
            {(brands.data ?? []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="post-v2-theme">O que você quer criar?</Label>
          <Textarea id="post-v2-theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Descreva o tema, a intenção ou o pedido em linguagem natural." rows={4} />
        </div>
        <div className="lg:col-span-2 flex justify-end">
          <Button onClick={() => create.mutate()} disabled={create.isPending || !theme.trim()}>
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Criar Creation V2
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SpecCard({ loaded, onChanged }: { loaded: LoadedPostV2Pipeline; onChanged: () => Promise<unknown> | unknown }) {
  const nextKey = getNextSpecDecision(loaded.spec);
  const [value, setValue] = useState("");
  const save = useMutation({
    mutationFn: () => savePostV2SpecDecision({ projectId: loaded.project.id, current: loaded.spec, key: nextKey!, value }),
    onSuccess: async () => {
      setValue("");
      toast.success("Decisão salva.");
      await onChanged();
    },
    onError: (error) => toast.error(mutationError(error)),
  });

  if (!nextKey) return null;
  const isSelect = nextKey === "objective" || nextKey === "approach";
  const options = nextKey === "objective" ? OBJECTIVE_OPTIONS : APPROACH_OPTIONS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completar $Spec · {SPEC_LABEL[nextKey]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O $Spec pergunta apenas a próxima decisão ainda não resolvida. O formato Post já está fixado por este Studio.
        </p>
        {isSelect ? (
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Selecione…</option>
            {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
          </select>
        ) : (
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Descreva o conceito central desta peça em uma frase." rows={3} />
        )}
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !value.trim()}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar e continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DesignApprovalCard({
  loaded,
  onChanged,
}: {
  loaded: LoadedPostV2Pipeline;
  onChanged: () => Promise<unknown> | unknown;
}) {
  const current = loaded.design.currentVersion;
  const mutation = useMutation({
    mutationFn: () => approveDesign(loaded.project.id, current!.id),
    onSuccess: async () => {
      toast.success("Design Spec aprovado.");
      await onChanged();
    },
    onError: (error) => toast.error(mutationError(error)),
  });

  if (!current) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Design atual não encontrado</AlertTitle>
        <AlertDescription>
          O orquestrador solicitou aprovação, mas nenhuma Design Version atual foi carregada. Recarregue a Creation antes de continuar.
        </AlertDescription>
      </Alert>
    );
  }

  const design = current.design;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisar e aprovar Design Spec · v{current.versionNumber}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Revise a direção visual antes de congelá-la para a etapa seguinte. A aprovação não produz imagem nem asset.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Sistema visual", design.visualSystem],
            ["Conceito de composição", design.compositionConcept],
            ["Gesto visual", design.visualGesture],
            ["Comportamento tipográfico", design.typographyBehavior],
            ["Modo de imagem", design.imageryMode],
            ["Nível de intervenção", design.interventionLevel],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-background/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-sm">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-background/70 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Escolha anti-genérica</p>
          <p className="mt-1 text-sm">{design.antiGenericity.distinctiveChoice}</p>
          {design.antiGenericity.avoid.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Evitar: {design.antiGenericity.avoid.join(" · ")}
            </p>
          )}
        </div>

        {design.informationToConfirm.length > 0 && (
          <Alert>
            <AlertTitle>Informações registradas para confirmação</AlertTitle>
            <AlertDescription>
              {design.informationToConfirm.join(" · ")}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Aprovar Design Spec
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ManualTaskCard({
  title,
  description,
  existingRun,
  prepare,
  importResponse,
  onChanged,
}: {
  title: string;
  description: string;
  existingRun: PreparedManualTask | null;
  prepare: () => Promise<PreparedManualTask>;
  importResponse: (runId: string, response: string) => Promise<unknown>;
  onChanged: () => Promise<unknown> | unknown;
}) {
  const [prepared, setPrepared] = useState<PreparedManualTask | null>(null);
  const [response, setResponse] = useState("");
  const task = prepared ?? existingRun;
  const prepareMutation = useMutation({
    mutationFn: prepare,
    onSuccess: (result) => {
      setPrepared(result);
      toast.success("Prompt preparado.");
    },
    onError: (error) => toast.error(mutationError(error)),
  });
  const importMutation = useMutation({
    mutationFn: () => importResponse(task!.runId, response),
    onSuccess: async () => {
      toast.success("Resposta validada e versão criada.");
      setResponse("");
      setPrepared(null);
      await onChanged();
    },
    onError: (error) => toast.error(mutationError(error)),
  });

  const prompt = useMemo(() => task?.promptText ?? "", [task]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {!task ? (
          <Button onClick={() => prepareMutation.mutate()} disabled={prepareMutation.isPending}>
            {prepareMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Preparar prompt
          </Button>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Prompt para execução externa</Label>
                <Button type="button" size="sm" variant="outline" onClick={async () => {
                  await navigator.clipboard.writeText(prompt);
                  toast.success("Prompt copiado.");
                }}>
                  <Clipboard className="mr-1.5 h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
              <Textarea readOnly value={prompt} rows={9} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label>JSON retornado pelo ChatGPT externo</Label>
              <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={9} className="font-mono text-xs" placeholder='Cole somente o JSON válido aqui.' />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || !response.trim()}>
                {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Validar e importar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SimpleActionCard({ title, description, actionLabel, run, onChanged, disabled = false }: {
  title: string;
  description: string;
  actionLabel: string;
  run: () => Promise<unknown>;
  onChanged: () => Promise<unknown> | unknown;
  disabled?: boolean;
}) {
  const mutation = useMutation({
    mutationFn: run,
    onSuccess: async () => {
      toast.success("Ação concluída.");
      await onChanged();
    },
    onError: (error) => toast.error(mutationError(error)),
  });
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button onClick={() => mutation.mutate()} disabled={disabled || mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
