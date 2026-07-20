import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Heart,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Send,
  Star,
  PenSquare,
  AlertTriangle,
  Shuffle,
  CalendarCheck,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { SendForApprovalDialog } from "@/components/send-for-approval-dialog";
import { ClientApprovalPanel } from "@/components/client-approval-panel";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { parsePiece, pieceToPlainText, type Piece } from "@/lib/promptBuilder";
import { OUTPUT_KIND_LABEL, type OutputKind } from "@/lib/formatOutputRules";
import type { Json, Tables } from "@/integrations/supabase/types";
import { AdjustPieceDialog } from "@/components/adjust-piece-dialog";
import { PieceAssetUploader } from "@/components/piece-asset-uploader";
import { fetchAssetsForProject, isReelFinalVideoAsset, type PieceAsset } from "@/lib/pieceAssets";
import { useAuth } from "@/hooks/use-auth";
import { FileImage } from "lucide-react";
import { AddToCalendarDialog } from "@/components/calendar/add-to-calendar-dialog";
import { getProjectDisplayTitle } from "@/lib/displayTitle";
import { RenameTitleDialog } from "@/components/rename-title-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportReelScriptDialog } from "@/components/import-reel-script-dialog";
import { ReelScriptView } from "@/components/reel-script-view";
import { ReelScriptVisualPanel } from "@/components/reel-script-visual-panel";
import { Reel2ResultOverview } from "@/components/reel2-result-overview";
import { Reel2ProductionPanel } from "@/components/reel2-production-panel";
import { Post2ResultOverview } from "@/components/post2-result-overview";
import { Post2ProductionPanel } from "@/components/post2-production-panel";
import { getStoredReelScript, reelScriptToPlainText, type ReelScript } from "@/lib/reelScript";
import { attachReelScriptVisualMeta, getStoredReelScriptVisualMeta } from "@/lib/reelScriptVisual";
import { getReel2ScriptFromProject } from "@/lib/reel2Project";
import { buildReel2StoryboardPrompt } from "@/lib/reel2Script";
import { inferReelDurationSeconds } from "@/lib/reelContent";
import { MAX_HASHTAGS, normalizeHashtags } from "@/lib/hashtags";
import { presetFromProject, saveUserPreset } from "@/lib/contentPresets";
import { getPost2ProjectSnapshot } from "@/lib/post2Project";

export const Route = createFileRoute("/_authenticated/app/content/$projectId/result")({
  head: () => ({ meta: [{ title: "Resultado — Cria Aí" }] }),
  component: ResultPage,
});

type Output = Tables<"content_outputs">;

function ResultPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [addToCalOpen, setAddToCalOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["project-result", projectId],
    queryFn: async () => {
      const { data: project, error } = await supabase
        .from("content_projects")
        .select("*, brands(*)")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      const { data: outputs, error: e2 } = await supabase
        .from("content_outputs")
        .select("*")
        .eq("project_id", projectId)
        .order("display_order");
      if (e2) throw e2;
      const assets = await fetchAssetsForProject(projectId);
      const { data: latestApproval } = await supabase
        .from("client_approvals")
        .select("id,status,decision,submitted_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: scheduleItems } = await supabase
        .from("publication_schedule_items")
        .select("id,schedule_status,confirmed_date,suggested_date,published_at")
        .eq("project_id", projectId)
        .limit(5);
      return {
        project: project as Tables<"content_projects"> & { brands: Tables<"brands"> | null },
        outputs: outputs as Output[],
        assets,
        latestApproval,
        scheduleItems: scheduleItems ?? [],
      };
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("content_projects")
        .update({ status })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-result", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Status atualizado.");
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const { error } = await supabase
        .from("content_projects")
        .update({ is_favorite: !data.project.is_favorite })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-result", projectId] }),
  });

  const summaryRow = useMemo(() => data?.outputs.find((o) => o.output_type === "summary"), [data]);
  const masterRow = useMemo(() => data?.outputs.find((o) => o.output_type === "master"), [data]);
  const pieceRows = useMemo(
    () => data?.outputs.filter((o) => o.output_type === "piece") ?? [],
    [data],
  );
  const legacyRows = useMemo(
    () =>
      data?.outputs.filter((o) => !["summary", "master", "piece"].includes(o.output_type)) ?? [],
    [data],
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data) return <p>Projeto não encontrado.</p>;

  const project = data.project;
  const reel2Script = getReel2ScriptFromProject(project);
  const post2Snapshot = getPost2ProjectSnapshot(project);

  const pieces: { row: Output; piece: Piece | null }[] = pieceRows.map((row) => {
    const piece = parsePiece(row.edited_content ?? row.original_content);
    if (piece && !piece.outputKind) {
      // Inferência para projetos antigos (especialmente Reel).
      if (piece.formatKey === "reel") {
        piece.outputKind =
          piece.role === "capa"
            ? "publishable_asset"
            : piece.role === "roteiro"
              ? "production_material"
              : piece.role === "legenda"
                ? "publication_copy"
                : "publishable_asset";
      } else {
        piece.outputKind = "publishable_asset";
      }
    }
    return { row, piece };
  });

  const selectedFormats: string[] = Array.isArray(project.selected_formats)
    ? (project.selected_formats as string[])
    : [];
  const hasReel =
    selectedFormats.includes("reel") || pieces.some(({ piece }) => piece?.formatKey === "reel");
  const reelPieces = pieces.filter(({ piece }) => piece?.formatKey === "reel");
  const nonReelPieces = pieces.filter(({ piece }) => piece?.formatKey !== "reel");
  const isReelOnly = hasReel && nonReelPieces.length === 0;

  const storedReelScriptForExport = getStoredReelScript(
    pieces.find(({ piece }) => piece?.formatKey === "reel" && piece.role === "roteiro")?.row
      .imported_content,
  );
  const allPiecesText = pieces
    .map(({ piece }) => {
      if (!piece) return "";
      if (piece.formatKey === "reel" && piece.role === "roteiro" && storedReelScriptForExport) {
        return reelScriptToPlainText(storedReelScriptForExport);
      }
      return pieceToPlainText(piece);
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  const fullExport = [
    summaryRow
      ? `# Resumo da campanha\n${summaryRow.edited_content ?? summaryRow.original_content}`
      : "",
    allPiecesText,
    masterRow ? `# Prompt mestre\n${masterRow.edited_content ?? masterRow.original_content}` : "",
  ]
    .filter(Boolean)
    .join("\n\n===\n\n");

  const exportTxt = () => {
    const blob = new Blob([fullExport], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(project.internal_title || "cria-ai").replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAndOpenChatGPT = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prompt copiado. Agora cole no ChatGPT e envie.");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
    window.open("https://chat.openai.com/", "_blank", "noopener,noreferrer");
  };

  const saveProjectAsPreset = () => {
    const suggestedName = `${getProjectDisplayTitle(project)} — preset`;
    const name = window.prompt("Nome do preset", suggestedName);
    if (!name?.trim()) return;
    try {
      const preset = saveUserPreset(presetFromProject({ project, name: name.trim() }));
      toast.success("Preset salvo.", { description: preset.name });
    } catch (error) {
      toast.error("Não foi possível salvar o preset", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/library">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Biblioteca
          </Link>
        </Button>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="break-words">
                {project.brands?.name ?? "Sem marca"}
              </Badge>
              {post2Snapshot && <Badge variant="secondary">Post 2.0</Badge>}
              <Badge
                variant={
                  (project as unknown as { content_source?: string }).content_source ===
                  "external_chatgpt"
                    ? "default"
                    : "secondary"
                }
              >
                Fonte da copy:{" "}
                {(project as unknown as { content_source?: string }).content_source ===
                "external_chatgpt"
                  ? "ChatGPT externo"
                  : (project as unknown as { content_source?: string }).content_source === "manual"
                    ? "Edição manual"
                    : "Gerador automático"}
              </Badge>
            </div>
            <div className="flex items-start gap-2">
              <h1
                className="line-clamp-2 min-w-0 break-words text-xl font-bold leading-tight sm:text-2xl"
                title={getProjectDisplayTitle(project)}
              >
                {getProjectDisplayTitle(project)}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setRenameOpen(true)}
                aria-label="Editar título"
                title="Editar título"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {reel2Script
                ? "Pacote do Reel 2.0 criado · roteiro, capa/frame, publicação e produção organizados abaixo."
                : post2Snapshot
                  ? "Pacote do Post 2.0 · conteúdo importado, arte final, aprovação e calendário no mesmo projeto."
                : `${pieces.length} peça${pieces.length === 1 ? "" : "s"} gerada${pieces.length === 1 ? "" : "s"} · ordem sugerida de publicação abaixo.`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => toggleFavorite.mutate()}
            aria-label="Favoritar"
          >
            <Heart
              className={`h-5 w-5 ${project.is_favorite ? "fill-primary text-primary" : ""}`}
            />
          </Button>
        </div>

        {!reel2Script && (
          <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-3">
            <Button asChild variant="default" size="sm">
              <Link to="/app/content/$projectId/client-pdf" params={{ projectId }}>
                <FileImage className="mr-2 h-4 w-4" />
                PDF para cliente
              </Link>
            </Button>
            <Button variant="default" size="sm" onClick={() => setAddToCalOpen(true)}>
              <CalendarCheck className="mr-2 h-4 w-4" />
              Calendário
            </Button>
            <Button variant="default" size="sm" onClick={() => setApprovalOpen(true)}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Aprovação
            </Button>
            <CopyButton text={fullExport} label="Copiar pacote" variant="outline" />
            <Button variant="outline" size="sm" onClick={exportTxt}>
              <Download className="mr-2 h-4 w-4" />
              TXT
            </Button>
            <Button variant="outline" size="sm" onClick={saveProjectAsPreset}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Salvar preset
            </Button>
            {post2Snapshot ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/app/create/post?projectId=${encodeURIComponent(projectId)}`}>
                  <PenSquare className="mr-2 h-4 w-4" />
                  Ajustar conteúdo no Post 2.0
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/app/content/new">
                  <PenSquare className="mr-2 h-4 w-4" />
                  Melhorar briefing
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Relatório interno
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("approved")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Marcar como aprovado
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("published")}>
            <Send className="mr-2 h-4 w-4" />
            Marcar como publicado
          </Button>
          <Badge variant="secondary" className="ml-auto">
            Status: {statusLabel(project.status)}
          </Badge>
        </div>
      </header>

      {summaryRow && !reel2Script && !post2Snapshot && (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold">Resumo da campanha</h2>
          <Card>
            <CardContent className="p-5">
              <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {summaryRow.edited_content ?? summaryRow.original_content}
              </pre>
            </CardContent>
          </Card>
        </section>
      )}

      {reel2Script && (
        <Reel2ResultOverview
          script={reel2Script}
          projectStatus={project.status}
          approvalStatus={(data.latestApproval as { status?: string; decision?: string } | null | undefined)?.status ?? (data.latestApproval as { decision?: string } | null | undefined)?.decision}
          hasSchedule={Boolean(project.publication_date || (data.scheduleItems ?? []).length)}
          hasFinalVideo={(data.assets ?? []).some(isReelFinalVideoAsset)}
        />
      )}

      {post2Snapshot && (
        <Post2ResultOverview
          projectId={projectId}
          snapshot={post2Snapshot}
          approvalStatus={
            (data.latestApproval as { status?: string; decision?: string } | null | undefined)
              ?.status ??
            (data.latestApproval as { decision?: string } | null | undefined)?.decision
          }
          hasSchedule={Boolean(project.publication_date || (data.scheduleItems ?? []).length)}
          hasFinalArt={(data.assets ?? []).length > 0}
        />
      )}

      {/* Aprovação do cliente */}
      <ClientApprovalPanel
        projectId={projectId}
        onOpenSendDialog={() => setApprovalOpen(true)}
        onOpenAddToCalendar={() => setAddToCalOpen(true)}
      />


      {/* SEÇÃO 2 — PEÇAS GERADAS */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">
            {hasReel
              ? reel2Script
                ? "Produção e arquivos do Reel"
                : isReelOnly
                  ? "Materiais do Reel"
                  : `Materiais do Reel e outros formatos (${pieces.length})`
              : post2Snapshot
                ? `Produção e arquivos do Post (${pieces.length})`
                : `Peças geradas (${pieces.length})`}
          </h2>
          <div className="flex items-center gap-2">
            {(() => {
              const assetsByOutput: Record<string, PieceAsset[]> = {};
              (data.assets ?? []).forEach((a) => {
                (assetsByOutput[a.output_id] ||= []).push(a);
              });
              const publishablePieces = pieces.filter(
                (p) => p.piece && p.piece.outputKind === "publishable_asset",
              );
              const denom = hasReel ? publishablePieces.length : pieces.length;
              const withArt = (hasReel ? publishablePieces : pieces).filter(
                (p) => (assetsByOutput[p.row.id] ?? []).length > 0,
              ).length;
              return (
                <Badge variant="outline" className="text-xs">
                  Arquivos finais anexados: {withArt} de {denom}
                </Badge>
              );
            })()}
            {pieces.length > 0 && (
              <CopyButton
                text={allPiecesText}
                label="Copiar todas as peças"
                variant="outline"
                size="sm"
              />
            )}
          </div>
        </div>
        {pieces.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {reel2Script
              ? "O pacote do Reel 2.0 está organizado acima. Use as abas abaixo para anexar storyboard, capa, vídeo final e arquivos finais."
              : "Nenhuma peça foi gerada para este projeto."}
          </p>
        )}

        {hasReel ? (
          <div className="space-y-6">
            <ReelTabs
              pieces={reelPieces}
              otherPieces={nonReelPieces}
              project={project}
              reel2Script={reel2Script}
              assets={data.assets ?? []}
              userId={user?.id ?? ""}
              onCopyAndOpen={copyAndOpenChatGPT}
              onAssetsChanged={() =>
                qc.invalidateQueries({ queryKey: ["project-result", projectId] })
              }
            />
          </div>
        ) : post2Snapshot ? (
          <Post2ProductionPanel
            projectId={projectId}
            outputId={pieceRows[0]?.id ?? ""}
            userId={user?.id ?? ""}
            snapshot={post2Snapshot}
            assets={(data.assets ?? []).filter((asset) => asset.output_id === pieceRows[0]?.id)}
            onAssetsChanged={() =>
              qc.invalidateQueries({ queryKey: ["project-result", projectId] })
            }
          />
        ) : (
          pieces.map(({ row, piece }) =>
            piece ? (
              <PieceCard
                key={row.id}
                row={row}
                piece={piece}
                brand={project.brands}
                project={project}
                allPieces={pieces.map((p) => p.piece).filter(Boolean) as Piece[]}
                onCopyAndOpen={copyAndOpenChatGPT}
                userId={user?.id ?? ""}
                assets={(data.assets ?? []).filter((a) => a.output_id === row.id)}
                isPost2={Boolean(post2Snapshot)}
                onAssetsChanged={() =>
                  qc.invalidateQueries({ queryKey: ["project-result", projectId] })
                }
              />
            ) : (
              <LegacyBlockCard key={row.id} block={row} />
            ),
          )
        )}
      </section>

      {/* Blocos legados (projetos antigos) */}
      {legacyRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Blocos auxiliares</h2>
          {legacyRows.map((o) => (
            <LegacyBlockCard key={o.id} block={o} />
          ))}
        </section>
      )}

      {/* SEÇÃO 3 — PROMPT MESTRE OPCIONAL */}
      {masterRow && (
        <section className="space-y-2">
          <details className="rounded-lg border border-border/60 bg-card/40">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Prompt mestre (opcional) — consolidação do pacote inteiro
            </summary>
            <div className="space-y-3 p-4 pt-0">
              <p className="text-xs text-muted-foreground">
                Use somente se quiser passar todas as peças de uma vez para a IA. O fluxo
                recomendado é copiar peça por peça.
              </p>
              <CopyButton
                text={masterRow.edited_content ?? masterRow.original_content}
                label="Copiar prompt mestre"
                variant="outline"
                size="sm"
              />
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 text-xs leading-relaxed">
                {masterRow.edited_content ?? masterRow.original_content}
              </pre>
            </div>
          </details>
        </section>
      )}
      <AddToCalendarDialog
        open={addToCalOpen}
        onOpenChange={setAddToCalOpen}
        projectId={projectId}
      />
      <RenameTitleDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        projectId={projectId}
        project={project}
      />
      <SendForApprovalDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        projectId={projectId}
        brandId={project.brand_id}
        defaultTitle={getProjectDisplayTitle(project)}
      />
    </div>
  );
}

function statusLabel(s: string) {
  return (
    (
      {
        draft: "Rascunho",
        review: "Em revisão",
        approved: "Aprovado",
        published: "Publicado",
        archived: "Arquivado",
      } as Record<string, string>
    )[s] ?? s
  );
}

// ============ PIECE CARD ============

function PieceCard({
  row,
  piece,
  brand,
  project,
  allPieces,
  onCopyAndOpen,
  userId,
  assets,
  onAssetsChanged,
  isPost2 = false,
}: {
  row: Output;
  piece: Piece;
  brand: Tables<"brands"> | null;
  project: Tables<"content_projects">;
  allPieces: Piece[];
  onCopyAndOpen: (text: string) => void;
  userId: string;
  assets: PieceAsset[];
  onAssetsChanged: () => void;
  isPost2?: boolean;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Piece>(piece);
  const [variationIdx, setVariationIdx] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustFocus, setAdjustFocus] = useState<
    "mainText" | "supportText" | "cta" | "bullets" | undefined
  >(undefined);

  const cycleVariation = () => {
    const heads = piece.headlineOptions ?? [];
    const supports = piece.supportTextOptions ?? [];
    if (heads.length <= 1 && supports.length <= 1) {
      toast.info(
        "Sem variações alternativas disponíveis. Enriqueça o briefing para gerar mais opções.",
      );
      return;
    }
    const next = variationIdx + 1;
    const newMain = heads.length ? heads[next % heads.length] : draft.mainText;
    const newSupport = supports.length
      ? supports[next % Math.max(supports.length, 1)]
      : draft.supportText;
    const newPrompt = draft.readyPrompt
      .replace(`"${draft.mainText}"`, `"${newMain}"`)
      .replace(`"${draft.supportText}"`, `"${newSupport}"`);
    setDraft({ ...draft, mainText: newMain, supportText: newSupport, readyPrompt: newPrompt });
    setVariationIdx(next);
    toast.success(`Variação ${next} aplicada — revise antes de salvar.`);
  };

  const save = useMutation({
    mutationFn: async () => {
      // ao salvar manualmente, consideramos a copy revisada pelo usuário
      const updated: Piece = { ...draft, qualityStatus: "approved", qualityIssues: undefined };
      const { error } = await supabase
        .from("content_outputs")
        .update({ edited_content: JSON.stringify(updated) })
        .eq("id", row.id);
      if (error) throw error;
      setDraft(updated);
    },
    onSuccess: () => {
      toast.success("Peça salva.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["project-result", row.project_id] });
    },
  });

  const restore = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("content_outputs")
        .update({ edited_content: null })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      const original = parsePiece(row.original_content);
      if (original) setDraft(original);
      toast.success("Peça restaurada.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["project-result", row.project_id] });
    },
  });

  const fav = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("content_outputs")
        .update({ is_favorite: !row.is_favorite })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-result", row.project_id] }),
  });

  const markProduced = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("content_outputs")
        .update({ is_favorite: true })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Peça marcada como produzida.");
      qc.invalidateQueries({ queryKey: ["project-result", row.project_id] });
    },
  });

  const allOfPiece = pieceToPlainText(draft);

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="text-[10px]">Peça {piece.index}</Badge>
              <Badge variant="outline" className="text-[10px]">
                {piece.formatLabel}
              </Badge>
              {piece.outputKind && <OutputKindBadge kind={piece.outputKind} />}
              {row.is_favorite && (
                <Badge variant="secondary" className="text-[10px]">
                  Produzida
                </Badge>
              )}
            </div>
            <h3 className="truncate font-display text-lg font-semibold">{piece.name}</h3>
            <p className="text-xs text-muted-foreground">Objetivo: {piece.objective}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {isPost2 ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={`/app/create/post?projectId=${encodeURIComponent(row.project_id)}`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Ajustar conteúdo no Post 2.0
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdjustFocus(undefined);
                  setAdjustOpen(true);
                }}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Ajustar esta peça
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => fav.mutate()} aria-label="Favoritar">
              <Star className={`h-4 w-4 ${row.is_favorite ? "fill-primary text-primary" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((v) => !v)}
              aria-label="Expandir"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {piece.warning && !isPost2 && (
          <button
            type="button"
            onClick={() => {
              setAdjustFocus(undefined);
              setAdjustOpen(true);
            }}
            className="mt-3 flex w-full items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-left text-xs text-amber-900 transition hover:bg-amber-500/20 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {piece.warning} <span className="underline">Clique para ajustar.</span>
            </span>
          </button>
        )}
        {!isPost2 && draft.qualityStatus === "blocked" && (
          <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              Esta copy precisa ser revisada antes da produção
            </p>
            {piece.qualityIssues && piece.qualityIssues.length > 0 && (
              <ul className="ml-5 mt-1 list-disc space-y-0.5">
                {piece.qualityIssues.map((q, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => {
                        setAdjustFocus(focusFromIssue(q.code));
                        setAdjustOpen(true);
                      }}
                    >
                      {q.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[11px] opacity-80">
              Clique em um aviso para abrir o editor com o campo destacado, ou use "Ajustar esta
              peça".
            </p>
          </div>
        )}
        {!isPost2 &&
          draft.qualityStatus !== "blocked" &&
          piece.qualityIssues &&
          piece.qualityIssues.length > 0 && (
            <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-900 dark:text-amber-200">
              <p className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Avisos de copy (não bloqueia o prompt)
              </p>
              <ul className="ml-5 list-disc space-y-0.5">
                {piece.qualityIssues.map((q, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => {
                        setAdjustFocus(focusFromIssue(q.code));
                        setAdjustOpen(true);
                      }}
                    >
                      {q.message}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] opacity-80">
                Clique no aviso para ajustar, ou use "Gerar variação de copy".
              </p>
            </div>
          )}

        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Estrutura semântica (síntese) */}
            <div className="grid gap-2 rounded-md border border-border/50 bg-muted/30 p-3 text-xs">
              <SemRow label="Ângulo" value={draft.communicationAngle} />
              {draft.mainPromise && draft.mainPromise !== "[PREENCHER]" && (
                <SemRow label="Promessa" value={draft.mainPromise} />
              )}
              {draft.mainProblem && draft.mainProblem !== "[PREENCHER]" && (
                <SemRow label="Dor principal" value={draft.mainProblem} />
              )}
              {draft.mainBenefit && draft.mainBenefit !== "[PREENCHER]" && (
                <SemRow label="Benefício principal" value={draft.mainBenefit} />
              )}
            </div>

            {/* Conteúdo textual */}
            <div className="grid gap-3">
              <PieceField
                label="Texto principal"
                value={draft.mainText}
                editing={editing}
                onChange={(v) => setDraft({ ...draft, mainText: v })}
              />
              <PieceField
                label="Texto de apoio"
                value={draft.supportText}
                editing={editing}
                multiline
                onChange={(v) => setDraft({ ...draft, supportText: v })}
              />
              {draft.bullets && draft.bullets.length > 0 && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Destaques
                  </span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
                    {draft.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              <PieceField
                label="CTA"
                value={draft.cta}
                editing={editing}
                onChange={(v) => setDraft({ ...draft, cta: v })}
              />
              {(piece.caption !== undefined || draft.caption !== undefined) && (
                <PieceField
                  label="Legenda"
                  value={draft.caption ?? ""}
                  editing={editing}
                  multiline
                  onChange={(v) => setDraft({ ...draft, caption: v })}
                  extra={
                    <CopyButton
                      text={draft.caption ?? ""}
                      label="Copiar legenda"
                      variant="ghost"
                      size="sm"
                    />
                  }
                />
              )}
              {piece.hashtags?.length || draft.hashtags?.length ? (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Hashtags
                    </span>
                    <CopyButton
                      text={(draft.hashtags ?? []).join(" ")}
                      label="Copiar hashtags"
                      variant="ghost"
                      size="sm"
                    />
                    <span className="text-xs text-muted-foreground">Máximo {MAX_HASHTAGS}</span>
                  </div>
                  {editing ? (
                    <Input
                      value={(draft.hashtags ?? []).join(" ")}
                      onChange={(e) =>
                        setDraft({ ...draft, hashtags: normalizeHashtags(e.target.value) })
                      }
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(draft.hashtags ?? []).map((h) => (
                        <Badge key={h} variant="outline" className="font-normal">
                          {h}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              {draft.productionNotes.length > 0 && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Observações de produção
                  </span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
                    {draft.productionNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Prompt pronto — não publicável esconde como "Material interno / Texto da publicação". */}
            {piece.outputKind === "production_material" &&
              piece.formatKey === "reel" &&
              piece.role === "roteiro" && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Pedido de roteiro — material interno
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Este ainda não é o roteiro final. Copie o pedido abaixo para desenvolver um
                        roteiro completo no ChatGPT.
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <CopyButton
                        text={draft.readyPrompt}
                        label="Copiar pedido"
                        variant="default"
                        size="sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onCopyAndOpen(draft.readyPrompt)}
                        className="gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir ChatGPT
                      </Button>
                    </div>
                  </div>
                  {draft.campaignPoints && draft.campaignPoints.length > 0 && (
                    <ol className="mt-3 list-decimal space-y-0.5 rounded-md border border-border/60 bg-background/60 p-3 pl-8 text-xs text-muted-foreground">
                      {draft.campaignPoints.map((point, index) => (
                        <li key={`${point}-${index}`}>{point}</li>
                      ))}
                    </ol>
                  )}
                  <pre className="mt-3 max-h-[460px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs leading-relaxed">
                    {draft.readyPrompt}
                  </pre>
                </div>
              )}
            {piece.outputKind === "production_material" &&
              !(piece.formatKey === "reel" && piece.role === "roteiro") && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                  <p className="font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Material interno
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Este conteúdo orienta a gravação / edição e <b>não deve ser publicado</b> como
                    uma arte. Não há prompt visual para esta peça.
                  </p>
                </div>
              )}
            {piece.outputKind === "publication_copy" && (
              <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-3 text-xs">
                <p className="font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  Usar na publicação
                </p>
                <p className="mt-1 text-muted-foreground">
                  A legenda do Reel usa a campanha completa e não é uma arte para gerar imagem.
                </p>
                {draft.campaignPoints && draft.campaignPoints.length > 0 && (
                  <ul className="mt-2 space-y-0.5 rounded-md border border-border/60 bg-background/60 p-2 text-muted-foreground">
                    {draft.campaignPoints.map((point, index) => (
                      <li key={`${point}-${index}`}>✓ {point}</li>
                    ))}
                  </ul>
                )}
                {draft.cta && (
                  <p className="mt-2 text-muted-foreground">
                    CTA preservado: <span className="font-medium text-foreground">{draft.cta}</span>
                  </p>
                )}
                {draft.captionCoverage && draft.captionCoverage.missingPoints.length > 0 && (
                  <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-200">
                    A legenda ainda não cobre: {draft.captionCoverage.missingPoints.join("; ")}
                  </p>
                )}
                <div className="mt-2">
                  <CopyButton
                    text={draft.caption || draft.mainText || ""}
                    label="Copiar texto da publicação"
                    variant="default"
                    size="sm"
                  />
                </div>
              </div>
            )}
            {(!piece.outputKind ||
              piece.outputKind === "publishable_asset" ||
              piece.outputKind === "reference_material") && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {draft.qualityStatus === "blocked"
                      ? "Prompt indisponível — copy bloqueada"
                      : "Prompt pronto para colar no ChatGPT"}
                  </span>
                  {draft.qualityStatus !== "blocked" && (
                    <div className="flex gap-1">
                      <CopyButton
                        text={draft.readyPrompt}
                        label="Copiar prompt da página"
                        variant="default"
                        size="sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onCopyAndOpen(draft.readyPrompt)}
                        className="gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir ChatGPT
                      </Button>
                    </div>
                  )}
                </div>
                {editing ? (
                  <Textarea
                    rows={Math.min(20, Math.max(6, draft.readyPrompt.split("\n").length + 1))}
                    value={draft.readyPrompt}
                    onChange={(e) => setDraft({ ...draft, readyPrompt: e.target.value })}
                    className="font-mono text-xs"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                    {draft.readyPrompt}
                  </pre>
                )}
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
              <CopyButton text={allOfPiece} label="Copiar tudo" variant="outline" size="sm" />
              <Button size="sm" variant="outline" onClick={cycleVariation}>
                <Shuffle className="mr-2 h-3.5 w-3.5" />
                Gerar variação de copy
              </Button>
              {!editing ? (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Editar conteúdo
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => save.mutate()}>
                    <Save className="mr-2 h-3.5 w-3.5" />
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => restore.mutate()}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Restaurar original
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft(piece);
                      setEditing(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </>
              )}
              {!row.is_favorite && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => markProduced.mutate()}
                  className="ml-auto"
                >
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                  Marcar como produzida
                </Button>
              )}
            </div>

            {/* Arte final anexada — somente para peças publicáveis (vídeo / capa / arte). */}
            {userId && (piece.outputKind ?? "publishable_asset") === "publishable_asset" && (
              <PieceAssetUploader
                userId={userId}
                projectId={row.project_id}
                outputId={row.id}
                assets={assets}
                multiple={piece.formatKey === "carrossel"}
                onChange={onAssetsChanged}
              />
            )}
          </div>
        )}
      </CardContent>
      {brand && !isPost2 && (
        <AdjustPieceDialog
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          piece={draft}
          brand={brand}
          project={project}
          otherPieces={allPieces}
          initialFocus={adjustFocus}
          prohibited={
            Array.isArray(brand.prohibited_words) ? brand.prohibited_words.filter(Boolean) : []
          }
          onSave={async (updated) => {
            const { error } = await supabase
              .from("content_outputs")
              .update({ edited_content: JSON.stringify(updated) })
              .eq("id", row.id);
            if (error) throw error;
            setDraft(updated);
            qc.invalidateQueries({ queryKey: ["project-result", row.project_id] });
          }}
        />
      )}
    </Card>
  );
}

function focusFromIssue(code: string): "mainText" | "supportText" | "cta" | "bullets" | undefined {
  // heurística simples para destacar o campo provavelmente problemático
  if (/headline|too_short|no_verb|missing_subject/.test(code)) return "mainText";
  if (/raw_list|too_long|too_many_semicolons|placeholder|empty|incomplete/.test(code))
    return "supportText";
  if (/cta/i.test(code)) return "cta";
  return "supportText";
}

function PieceField({
  label,
  value,
  editing,
  multiline,
  onChange,
  extra,
}: {
  label: string;
  value: string;
  editing: boolean;
  multiline?: boolean;
  onChange: (v: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {extra}
          {!editing && value && <CopyButton text={value} variant="ghost" size="sm" label="" />}
        </div>
      </div>
      {editing ? (
        multiline ? (
          <Textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        )
      ) : value ? (
        <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 text-sm">
          {value}
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground">— não informado —</p>
      )}
    </div>
  );
}

function SemRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-xs leading-snug">{value}</span>
    </div>
  );
}

// ============ FALLBACK PARA BLOCOS LEGADOS (projetos antigos) ============

function LegacyBlockCard({ block }: { block: Output }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.edited_content ?? block.original_content);
  const display = block.edited_content ?? block.original_content;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("content_outputs")
        .update({ edited_content: draft })
        .eq("id", block.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bloco salvo.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["project-result", block.project_id] });
    },
  });

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="truncate font-display text-base font-semibold">{block.title}</h3>
          <div className="flex gap-1">
            <CopyButton text={display} variant="ghost" size="icon" label="" />
            {!editing ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDraft(display);
                  setEditing(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => save.mutate()}>
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(20, Math.max(6, draft.split("\n").length + 1))}
            className="font-mono text-sm"
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 text-sm leading-relaxed">
            {display}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

// ============ BADGE DE CLASSIFICAÇÃO ============

function OutputKindBadge({ kind }: { kind: OutputKind }) {
  const cls =
    kind === "publishable_asset"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300"
      : kind === "publication_copy"
        ? "bg-sky-500/15 text-sky-700 border-sky-500/40 dark:text-sky-300"
        : kind === "production_material"
          ? "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`text-[10px] ${cls}`}>
      {OUTPUT_KIND_LABEL[kind]}
    </Badge>
  );
}

// ============ ABAS DO REEL ============

function ReelTabs({
  pieces,
  otherPieces = [],
  project,
  reel2Script,
  assets,
  userId,
  onCopyAndOpen,
  onAssetsChanged,
}: {
  pieces: { row: Output; piece: Piece | null }[];
  otherPieces?: { row: Output; piece: Piece | null }[];
  project: Tables<"content_projects"> & { brands: Tables<"brands"> | null };
  reel2Script?: import("@/lib/reel2Script").Reel2ImportedScript | null;
  assets: PieceAsset[];
  userId: string;
  onCopyAndOpen: (text: string) => void;
  onAssetsChanged: () => void;
}) {
  const qc = useQueryClient();
  const [importScriptOpen, setImportScriptOpen] = useState(false);
  const allPieces = [...pieces, ...otherPieces].map((p) => p.piece).filter(Boolean) as Piece[];
  const find = (role: string) => pieces.find((p) => p.piece?.role === role);
  const roteiro = find("roteiro");
  const capa = find("capa");
  const legenda = find("legenda");
  const publishables = pieces.filter((p) => p.piece && p.piece.outputKind === "publishable_asset");
  const storedScript = getStoredReelScript(roteiro?.row.imported_content);
  const expectedPoints = roteiro?.piece?.campaignPoints ?? [];
  const expectedCta = roteiro?.piece?.cta ?? project.call_to_action ?? "";
  const expectedDuration = inferReelDurationSeconds(project);
  const reel2StoryboardPrompt = reel2Script ? buildReel2StoryboardPrompt(reel2Script, project.brands, { mode: "complete" }) : undefined;

  const importScript = useMutation({
    mutationFn: async ({ script }: { script: ReelScript; raw: string }) => {
      if (!roteiro?.piece) throw new Error("O output de roteiro não foi encontrado.");

      const updatedScriptPiece: Piece = {
        ...roteiro.piece,
        name: "Reel — Roteiro completo",
        objective: "roteiro completo do vídeo com falas, cenas e orientações de produção",
        mainText: script.title,
        supportText: script.overview.central_concept,
        bullets: script.required_points,
        cta: script.closing.cta,
        contentStage: "script_complete",
        copySource: "external_chatgpt",
        qualityStatus: "approved",
        qualityIssues: undefined,
      };

      const nextScriptVersion = (roteiro.row.version ?? 1) + 1;
      const currentVisualMeta = getStoredReelScriptVisualMeta(roteiro.row.imported_content);
      const hasVisualAttached = assets.some((asset) => asset.output_id === roteiro.row.id);
      const importedScriptContent = attachReelScriptVisualMeta(script, {
        ...currentVisualMeta,
        status: hasVisualAttached ? "needs_revision" : "prompt_ready",
        script_version: hasVisualAttached ? currentVisualMeta.script_version : null,
        approved_at: hasVisualAttached ? null : currentVisualMeta.approved_at,
      });

      const { error: scriptError } = await supabase
        .from("content_outputs")
        .update({
          imported_content: importedScriptContent,
          edited_content: JSON.stringify(updatedScriptPiece),
          source: "external_chatgpt",
          title: "Reel — Roteiro completo",
          copy_status: "review",
          version: nextScriptVersion,
        })
        .eq("id", roteiro.row.id);
      if (scriptError) throw scriptError;

      if (legenda?.piece) {
        const captionCoverage = {
          coveredPoints: [...expectedPoints],
          missingPoints: [] as string[],
          coveragePercentage: 100,
        };
        const updatedCaptionPiece: Piece = {
          ...legenda.piece,
          name: "Reel — Legenda + CTA",
          mainText: script.publication.caption,
          supportText: "",
          bullets: [],
          cta: script.closing.cta,
          caption: script.publication.caption,
          hashtags: normalizeHashtags(script.publication.hashtags),
          campaignPoints: script.required_points.length ? script.required_points : expectedPoints,
          captionCoverage,
          contentStage: "publication_copy",
          copySource: "external_chatgpt",
          qualityStatus: "approved",
          qualityIssues: undefined,
          readyPrompt: [
            "Texto da publicação — Legenda do Reel.",
            "",
            "Este conteúdo deve ser usado como texto da publicação. NÃO gerar imagem para esta saída.",
            "",
            script.publication.caption,
            normalizeHashtags(script.publication.hashtags).length
              ? `\n${normalizeHashtags(script.publication.hashtags).join(" ")}`
              : "",
          ]
            .join("\n")
            .trim(),
        };

        const { error: captionError } = await supabase
          .from("content_outputs")
          .update({
            imported_content: {
              caption: script.publication.caption,
              hashtags: normalizeHashtags(script.publication.hashtags),
              cta: script.closing.cta,
              source_schema: script.schema_version,
            } as Json,
            edited_content: JSON.stringify(updatedCaptionPiece),
            source: "external_chatgpt",
            copy_status: "review",
            version: (legenda.row.version ?? 1) + 1,
          })
          .eq("id", legenda.row.id);
        if (captionError) throw captionError;
      }

      const { error: projectError } = await supabase
        .from("content_projects")
        .update({
          content_source: "external_chatgpt",
          content_development_status: "script_imported",
          imported_at: new Date().toISOString(),
        })
        .eq("id", project.id);
      if (projectError) throw projectError;
    },
    onSuccess: () => {
      toast.success("Roteiro completo importado e legenda atualizada.");
      qc.invalidateQueries({ queryKey: ["project-result", project.id] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível importar o roteiro."),
  });

  const renderPiece = (
    entry: { row: Output; piece: Piece | null } | undefined,
    emptyHint: string,
  ) => {
    if (!entry?.piece) {
      return <p className="text-sm italic text-muted-foreground">{emptyHint}</p>;
    }
    return (
      <PieceCard
        row={entry.row}
        piece={entry.piece}
        brand={project.brands}
        project={project}
        allPieces={allPieces}
        onCopyAndOpen={onCopyAndOpen}
        userId={userId}
        assets={assets.filter((a) => a.output_id === entry.row.id)}
        onAssetsChanged={onAssetsChanged}
      />
    );
  };

  return (
    <>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1 overflow-x-auto">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="roteiro">Roteiro</TabsTrigger>
          <TabsTrigger value="capa">Capa</TabsTrigger>
          <TabsTrigger value="legenda">Legenda e hashtags</TabsTrigger>
          <TabsTrigger value="arquivos">Arquivos finais</TabsTrigger>
          {reel2Script && <TabsTrigger value="producao">Produção final</TabsTrigger>}
          {otherPieces.length > 0 && (
            <TabsTrigger value="outros">Outros formatos ({otherPieces.length})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <p>
                <b>Título:</b> {getProjectDisplayTitle(project)}
              </p>
              <p>
                <b>Marca:</b> {project.brands?.name ?? "—"}
              </p>
              <p>
                <b>Tema:</b> {project.theme || "—"}
              </p>
              <p>
                <b>Objetivo:</b> {project.objective || "—"}
              </p>
              <p>
                <b>Status:</b> {statusLabel(project.status)}
              </p>
              <p>
                <b>Roteiro:</b>{" "}
                {storedScript
                  ? `Completo · ${storedScript.scenes.length} cenas · ${storedScript.overview.duration_seconds}s`
                  : "Aguardando desenvolvimento externo"}
              </p>
              <p className="text-xs text-muted-foreground">
                Reel é uma publicação única no calendário (vídeo + capa + legenda). Roteiro e
                storyboard são materiais internos de produção.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roteiro" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <span>
              <b>MATERIAL INTERNO.</b>{" "}
              {storedScript
                ? "O roteiro abaixo foi importado e validado."
                : "Copie o pedido, gere o JSON no ChatGPT e importe a resposta para criar o roteiro completo."}
            </span>
            <Button size="sm" onClick={() => setImportScriptOpen(true)}>
              {storedScript ? "Importar nova versão" : "Importar roteiro JSON"}
            </Button>
          </div>
          {storedScript ? (
            <>
              <ReelScriptView
                script={storedScript}
                onImportNewVersion={() => setImportScriptOpen(true)}
              />
              {roteiro && (
                <ReelScriptVisualPanel
                  userId={userId}
                  projectId={project.id}
                  projectTitle={getProjectDisplayTitle(project)}
                  outputId={roteiro.row.id}
                  outputImportedContent={roteiro.row.imported_content}
                  script={storedScript}
                  scriptVersion={roteiro.row.version ?? 1}
                  brand={project.brands}
                  promptOverride={reel2StoryboardPrompt}
                  assets={assets.filter((asset) => asset.output_id === roteiro.row.id)}
                  onChange={onAssetsChanged}
                />
              )}
            </>
          ) : (
            renderPiece(roteiro, "Nenhum pedido de roteiro registrado para este Reel.")
          )}
        </TabsContent>

        <TabsContent value="capa" className="mt-4 space-y-3">
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
            <b>PUBLICAR.</b> Capa estática do Reel — gere a arte a partir do prompt e anexe abaixo.
          </div>
          {renderPiece(capa, "Nenhuma capa registrada para este Reel.")}
        </TabsContent>

        <TabsContent value="legenda" className="mt-4 space-y-3">
          <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-200">
            <b>USAR NA PUBLICAÇÃO.</b>{" "}
            {storedScript
              ? "A legenda abaixo foi atualizada automaticamente a partir do roteiro completo importado."
              : "Texto provisório baseado na campanha. Será substituído pela legenda do roteiro importado."}
          </div>
          {renderPiece(legenda, "Nenhuma legenda registrada para este Reel.")}
        </TabsContent>

        <TabsContent value="arquivos" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Apenas peças publicáveis (vídeo final e capa) aparecem aqui e no PDF para o cliente.
          </p>
          {publishables.length === 0 && (
            <p className="text-sm italic text-muted-foreground">
              Nenhum arquivo publicável anexado ainda.
            </p>
          )}
          {publishables.map((entry) => (
            <div key={entry.row.id}>{renderPiece(entry, "")}</div>
          ))}
        </TabsContent>


        {reel2Script && roteiro && (
          <TabsContent value="producao" className="mt-4 space-y-4">
            <Reel2ProductionPanel
              userId={userId}
              projectId={project.id}
              outputId={roteiro.row.id}
              outputImportedContent={roteiro.row.imported_content}
              script={reel2Script}
              brand={project.brands}
              assets={assets.filter((asset) => asset.output_id === roteiro.row.id)}
              onChange={onAssetsChanged}
            />
          </TabsContent>
        )}

        {otherPieces.length > 0 && (
          <TabsContent value="outros" className="mt-4 space-y-3">
            <div>
              <h3 className="font-display text-base font-semibold">Outros formatos da campanha</h3>
              <p className="text-xs text-muted-foreground">
                Stories, posts e demais entregas permanecem separados das etapas internas do Reel.
              </p>
            </div>
            {otherPieces.map(({ row, piece }) =>
              piece ? (
                <PieceCard
                  key={row.id}
                  row={row}
                  piece={piece}
                  brand={project.brands}
                  project={project}
                  allPieces={allPieces}
                  onCopyAndOpen={onCopyAndOpen}
                  userId={userId}
                  assets={assets.filter((asset) => asset.output_id === row.id)}
                  onAssetsChanged={onAssetsChanged}
                />
              ) : null,
            )}
          </TabsContent>
        )}
      </Tabs>

      <ImportReelScriptDialog
        open={importScriptOpen}
        onOpenChange={setImportScriptOpen}
        expectations={{
          durationSeconds: expectedDuration,
          requiredPoints: expectedPoints,
          strategicCta: expectedCta,
        }}
        hasExistingScript={!!storedScript}
        onImport={(script, raw) => importScript.mutateAsync({ script, raw })}
      />
    </>
  );
}

// silencia imports não usados em alguns paths
void Copy;
