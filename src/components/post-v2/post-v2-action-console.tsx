import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Clipboard, Loader2, Play, Save, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  registerPostV2ProductionAsset,
  runPostV2ProductionQa,
  savePostV2SpecDecision,
  type PreparedManualTask,
} from "@/lib/creation/post-v2-workflow";
import { getNextSpecDecision, type SpecDecisionKey } from "@/lib/creation/spec";
import {
  deriveOverallQaStatus,
  deriveQaStatusesWithFindings,
  evaluateDeterministicProductionAssetChecks,
  type QaAxisStatuses,
  type QaStatus,
} from "@/lib/creation/qa";
import { getSignedUrl } from "@/lib/pieceAssets";

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
    return <ProductionAssetCard loaded={loaded} onChanged={onChanged} />;
  }

  if (action === "run_qa") {
    return <ProductionQaCard loaded={loaded} onChanged={onChanged} />;
  }

  if (action === "fix_qa_block") {
    return (
      <ProductionAssetCard
        loaded={loaded}
        onChanged={onChanged}
        mode="qa_correction"
      />
    );
  }

  if (action === "send_client_approval") {
    const qa = loaded.production.latestQaReview;
    return (
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>QA concluído · checkpoint desta entrega</AlertTitle>
        <AlertDescription>
          {qa
            ? `O QA ${qa.overallStatus} está registrado para o Asset atual. O orquestrador liberou a aprovação do cliente, que permanece fora do escopo operacional desta entrega.`
            : "O QA foi concluído e o próximo estágio é aprovação do cliente, ainda somente em leitura."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <Sparkles className="h-4 w-4" />
      <AlertTitle>Ação fora do escopo operacional atual</AlertTitle>
      <AlertDescription>
        O Studio respeitou a próxima ação do orquestrador, mas esta entrega libera ações somente até QA e a correção de Production quando um QA BLOCK exigir nova versão. Aprovação do cliente e operação continuam em leitura.
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
            <AlertTitle>Pendências para execução</AlertTitle>
            <AlertDescription>
              {design.informationToConfirm.join(" · ")}
              <span className="mt-1 block">
                Não bloqueiam a aprovação conceitual do Design; serão levadas explicitamente para Production.
              </span>
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

function ProductionAssetCard({
  loaded,
  onChanged,
  mode = "initial",
}: {
  loaded: LoadedPostV2Pipeline;
  onChanged: () => Promise<unknown> | unknown;
  mode?: "initial" | "qa_correction";
}) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const renderPrompt = loaded.snapshot.renderPromptPlan;
  const approvedDesign = loaded.design.approvedVersion;
  const approvedCopy = loaded.copy.approvedVersion;

  const copyExtension =
    approvedCopy?.formatExtension &&
    typeof approvedCopy.formatExtension === "object" &&
    !Array.isArray(approvedCopy.formatExtension)
      ? (approvedCopy.formatExtension as Record<string, unknown>)
      : null;

  const copyConfirmations = Array.isArray(copyExtension?.informationToConfirm)
    ? copyExtension.informationToConfirm.filter(
        (value): value is string => typeof value === "string" && Boolean(value.trim()),
      )
    : [];
  const designConfirmations = approvedDesign?.design.informationToConfirm ?? [];
  const mandatoryAssetRequirements =
    approvedDesign?.design.assetRequirements
      .filter((item) => item.mandatory)
      .map(
        (item) =>
          `${item.role}: ${item.requirement}${
            item.sourcePreference ? ` · fonte preferida: ${item.sourcePreference}` : ""
          }`,
      ) ?? [];
  const productionDependencies = Array.from(
    new Set([
      ...designConfirmations,
      ...copyConfirmations,
      ...mandatoryAssetRequirements,
    ]),
  );

  const mutation = useMutation({
    mutationFn: () =>
      registerPostV2ProductionAsset({
        projectId: loaded.project.id,
        file: file!,
        source,
      }),
    onSuccess: async () => {
      toast.success(
        mode === "qa_correction"
          ? "Asset corrigido registrado. Execute um novo QA."
          : "Production Asset registrado. QA é a próxima etapa.",
      );
      setFile(null);
      setSource("");
      await onChanged();
    },
    onError: (error) => toast.error(mutationError(error)),
  });

  if (!renderPrompt || !approvedDesign) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Render Prompt não disponível</AlertTitle>
        <AlertDescription>
          O orquestrador solicitou Production, mas o Design aprovado ou o Render Prompt canônico não foi carregado. Recarregue a Creation antes de continuar.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {mode === "qa_correction"
            ? "Corrigir Production após QA BLOCK"
            : "Production externa · registrar Asset final"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {mode === "qa_correction"
            ? "O QA atual bloqueou este Asset. Corrija a peça externamente, preserve o Design aprovado e registre um novo arquivo final. A versão anterior e o QA BLOCK permanecem no histórico; a nova versão volta para QA pendente."
            : "Produza a arte fora do Cria Aí usando exatamente o Render Prompt abaixo. Depois anexe somente o arquivo final. O registro cria uma Production Asset Version imutável vinculada ao Design aprovado; QA ainda não é executado aqui."}
        </p>

        {mode === "qa_correction" && loaded.production.latestQaReview && (
          <Alert variant="destructive">
            <AlertTitle>Bloqueios registrados no QA #{loaded.production.latestQaReview.reviewNumber}</AlertTitle>
            <AlertDescription>
              {loaded.production.latestQaReview.findings.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {loaded.production.latestQaReview.findings.map((finding, index) => (
                    <li key={`${finding.code}-${index}`}>
                      <strong>{finding.axis}</strong> · {finding.status}: {finding.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2">Revise os eixos marcados como BLOCK no QA antes de gerar a nova versão.</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Render Prompt canônico · v{renderPrompt.promptVersion}</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(renderPrompt.promptText);
                toast.success("Render Prompt copiado.");
              }}
            >
              <Clipboard className="mr-1.5 h-3.5 w-3.5" /> Copiar prompt
            </Button>
          </div>
          <Textarea
            readOnly
            value={renderPrompt.promptText}
            rows={14}
            className="font-mono text-xs"
          />
          <p className="break-all font-mono text-[10px] text-muted-foreground">
            Design {renderPrompt.versionRefs.designVersionId} · Copy {renderPrompt.versionRefs.copyVersionId}
          </p>
        </div>

        {productionDependencies.length > 0 && (
          <Alert>
            <AlertTitle>Pendências / dependências para execução</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {productionDependencies.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-2">
                Elas não alteram o Design aprovado. Devem ser respeitadas ou supridas na ferramenta de produção; o QA será a etapa de verificação posterior.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {loaded.production.currentAsset &&
          loaded.snapshot.productionFreshness === "review_required" && (
            <Alert>
              <AlertTitle>Asset anterior preservado como histórico</AlertTitle>
              <AlertDescription>
                A Production Asset v{loaded.production.currentAsset.versionNumber} foi criada para outro Design aprovado. O novo upload inicia uma nova linhagem sem apagar a versão anterior.
              </AlertDescription>
            </Alert>
          )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="post-v2-production-source">Origem / ferramenta de produção</Label>
            <Input
              id="post-v2-production-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Ex.: ChatGPT, Canva, Photoshop…"
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Se vazio, o registro usa a origem genérica de produção externa.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-v2-production-file">Asset final</Label>
            <Input
              id="post-v2-production-file"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              PNG, JPG, JPEG ou WebP · máximo de 15 MB.
            </p>
          </div>
        </div>

        {file && (
          <div className="rounded-lg border bg-background/70 p-3 text-sm">
            <p className="font-medium">{file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || "tipo não informado"}
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => mutation.mutate()}
            disabled={!file || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {mode === "qa_correction" ? "Registrar Asset corrigido" : "Registrar Asset final"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const QA_AXIS_CONFIG = [
  {
    key: "factual",
    label: "Factual",
    description:
      "Confirme textos, datas, nomes, números, promessas e informações que aparecem na peça.",
  },
  {
    key: "strategic",
    label: "Estratégico",
    description:
      "Valide aderência à mensagem aprovada, objetivo, hierarquia e CTA do Post.",
  },
  {
    key: "brand",
    label: "Marca",
    description:
      "Valide identidade, tom, restrições e coerência com o Brand Snapshot congelado.",
  },
  {
    key: "visualTechnical",
    label: "Visual / técnico",
    description:
      "Valide legibilidade, composição, recortes, resolução, proporção e acabamento do arquivo.",
  },
] as const;

type QaUiAxisKey = (typeof QA_AXIS_CONFIG)[number]["key"];
type QaDraftStatuses = Record<QaUiAxisKey, QaStatus | "">;
type QaDraftNotes = Record<QaUiAxisKey, string>;

function qaStatusClass(status: QaStatus) {
  if (status === "BLOCK") return "border-destructive/50 bg-destructive/5";
  if (status === "WARN") return "border-amber-500/40 bg-amber-500/5";
  return "border-emerald-500/30 bg-emerald-500/5";
}

function ProductionQaCard({
  loaded,
  onChanged,
}: {
  loaded: LoadedPostV2Pipeline;
  onChanged: () => Promise<unknown> | unknown;
}) {
  const [statuses, setStatuses] = useState<QaDraftStatuses>({
    factual: "",
    strategic: "",
    brand: "",
    visualTechnical: "",
  });
  const [notes, setNotes] = useState<QaDraftNotes>({
    factual: "",
    strategic: "",
    brand: "",
    visualTechnical: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const asset = loaded.production.currentAsset;
  const pieceAsset = loaded.production.currentPieceAsset;
  const designState = loaded.design.state;
  const approvedCopy = loaded.copy.approvedVersion;
  const approvedDesign = loaded.design.approvedVersion;

  const automaticChecks = useMemo(() => {
    if (!asset || !pieceAsset || !designState) return null;
    return evaluateDeterministicProductionAssetChecks({
      asset,
      designState,
      pieceAsset,
    });
  }, [asset, designState, pieceAsset]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!pieceAsset) throw new Error("Arquivo do Production Asset não foi carregado.");
      return getSignedUrl(pieceAsset.storage_path, 1800);
    },
    onSuccess: (url) => setPreviewUrl(url),
    onError: (error) => toast.error(mutationError(error)),
  });

  const allSelected = QA_AXIS_CONFIG.every(({ key }) => statuses[key] !== "");
  const missingRequiredNotes = QA_AXIS_CONFIG.some(
    ({ key }) =>
      statuses[key] !== "" &&
      statuses[key] !== "PASS" &&
      !notes[key].trim(),
  );

  const baseStatuses: QaAxisStatuses | null = allSelected
    ? {
        factual: statuses.factual as QaStatus,
        strategic: statuses.strategic as QaStatus,
        brand: statuses.brand as QaStatus,
        visualTechnical: statuses.visualTechnical as QaStatus,
      }
    : null;

  const projectedStatuses =
    baseStatuses && automaticChecks
      ? deriveQaStatusesWithFindings({
          baseStatuses,
          findings: automaticChecks.findings,
        })
      : baseStatuses;
  const projectedOverall = projectedStatuses
    ? deriveOverallQaStatus(projectedStatuses)
    : null;

  const qaMutation = useMutation({
    mutationFn: () =>
      runPostV2ProductionQa({
        projectId: loaded.project.id,
        statuses: baseStatuses!,
        notes,
      }),
    onSuccess: async (review) => {
      toast.success(`QA ${review.overallStatus} registrado.`);
      await onChanged();
    },
    onError: (error) => toast.error(mutationError(error)),
  });

  if (!asset || !pieceAsset || !designState || !approvedCopy || !approvedDesign) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Contexto de QA incompleto</AlertTitle>
        <AlertDescription>
          O QA exige o Production Asset atual, seu arquivo, Copy aprovada e Design aprovado. Recarregue a Creation antes de continuar.
        </AlertDescription>
      </Alert>
    );
  }

  const extension =
    approvedCopy.formatExtension &&
    typeof approvedCopy.formatExtension === "object" &&
    !Array.isArray(approvedCopy.formatExtension)
      ? (approvedCopy.formatExtension as Record<string, unknown>)
      : null;
  const headline =
    typeof extension?.headline === "string" && extension.headline.trim()
      ? extension.headline.trim()
      : approvedCopy.core.primaryMessage;
  const supportText =
    typeof extension?.supportText === "string" && extension.supportText.trim()
      ? extension.supportText.trim()
      : null;
  const caption =
    typeof extension?.caption === "string" && extension.caption.trim()
      ? extension.caption.trim()
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>QA do Production Asset · v{asset.versionNumber}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Revise explicitamente os quatro eixos abaixo. Nenhum eixo começa aprovado por padrão. Checks determinísticos são recalculados no momento do registro e podem elevar PASS para WARN/BLOCK, nunca esconder um problema automático.
        </p>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-3 rounded-lg border bg-background/70 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium">Asset atual</p>
                <p className="mt-1 text-xs text-muted-foreground">{pieceAsset.file_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {pieceAsset.image_width && pieceAsset.image_height
                    ? `${pieceAsset.image_width} × ${pieceAsset.image_height} · `
                    : ""}
                  {(pieceAsset.file_size / 1024 / 1024).toFixed(2)} MB · {pieceAsset.file_type}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
              >
                {previewMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {previewUrl ? "Atualizar preview" : "Carregar preview"}
              </Button>
            </div>
            {previewUrl && pieceAsset.file_type.startsWith("image/") && (
              <div className="overflow-hidden rounded-md border bg-muted/30">
                <img
                  src={previewUrl}
                  alt={`Preview de ${pieceAsset.file_name}`}
                  className="mx-auto max-h-[520px] w-auto max-w-full object-contain"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border bg-background/70 p-3 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Headline aprovada</p>
              <p className="mt-1 font-medium">{headline}</p>
            </div>
            {supportText && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Apoio</p>
                <p className="mt-1">{supportText}</p>
              </div>
            )}
            {caption && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Legenda</p>
                <p className="mt-1 line-clamp-6 whitespace-pre-wrap">{caption}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sistema visual aprovado</p>
              <p className="mt-1">{approvedDesign.design.visualSystem}</p>
            </div>
            {approvedDesign.design.restrictions.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Restrições</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {approvedDesign.design.restrictions.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        <Alert>
          <AlertTitle>Checks automáticos</AlertTitle>
          <AlertDescription>
            {automaticChecks && automaticChecks.findings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {automaticChecks.findings.map((finding, index) => (
                  <li key={`${finding.code}-${index}`}>
                    <strong>{finding.status}</strong> · {finding.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">Nenhum WARN/BLOCK determinístico encontrado no arquivo e na vinculação com o Design atual.</p>
            )}
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 md:grid-cols-2">
          {QA_AXIS_CONFIG.map(({ key, label, description }) => {
            const status = statuses[key];
            return (
              <div
                key={key}
                className={`space-y-3 rounded-lg border p-3 ${status ? qaStatusClass(status) : "bg-background/70"}`}
              >
                <div>
                  <Label htmlFor={`post-v2-qa-${key}`}>{label}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
                <select
                  id={`post-v2-qa-${key}`}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={status}
                  onChange={(event) =>
                    setStatuses((current) => ({
                      ...current,
                      [key]: event.target.value as QaStatus | "",
                    }))
                  }
                >
                  <option value="">Selecione…</option>
                  <option value="PASS">PASS · sem problema</option>
                  <option value="WARN">WARN · atenção, mas pode prosseguir</option>
                  <option value="BLOCK">BLOCK · precisa corrigir</option>
                </select>
                <Textarea
                  value={notes[key]}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [key]: event.target.value }))
                  }
                  rows={3}
                  placeholder={
                    status && status !== "PASS"
                      ? `Obrigatório: descreva o motivo do ${status}.`
                      : "Observação opcional."
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/70 p-3">
          <div>
            <p className="text-xs font-medium">Resultado projetado</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O resultado final usa o pior status entre os quatro eixos depois dos checks automáticos.
            </p>
          </div>
          {projectedOverall ? (
            <Badge variant={projectedOverall === "BLOCK" ? "destructive" : "outline"}>
              {projectedOverall}
            </Badge>
          ) : (
            <Badge variant="outline">4 eixos pendentes</Badge>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => qaMutation.mutate()}
            disabled={!baseStatuses || missingRequiredNotes || qaMutation.isPending}
          >
            {qaMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Registrar QA
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
