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
  Sparkles,
  Star,
  PenSquare,
  AlertTriangle,
  Shuffle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { parsePiece, pieceToPlainText, type Piece } from "@/lib/promptBuilder";
import type { Tables } from "@/integrations/supabase/types";
import { AdjustPieceDialog } from "@/components/adjust-piece-dialog";
import { PieceAssetUploader } from "@/components/piece-asset-uploader";
import { fetchAssetsForProject, type PieceAsset } from "@/lib/pieceAssets";
import { useAuth } from "@/hooks/use-auth";
import { FileImage } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/content/$projectId/result")({
  head: () => ({ meta: [{ title: "Resultado — Cria Aí" }] }),
  component: ResultPage,
});

type Output = Tables<"content_outputs">;

function ResultPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["project-result", projectId],
    queryFn: async () => {
      const { data: project, error } = await supabase
        .from("content_projects").select("*, brands(*)").eq("id", projectId).single();
      if (error) throw error;
      const { data: outputs, error: e2 } = await supabase
        .from("content_outputs").select("*").eq("project_id", projectId).order("display_order");
      if (e2) throw e2;
      const assets = await fetchAssetsForProject(projectId);
      return {
        project: project as Tables<"content_projects"> & { brands: Tables<"brands"> | null },
        outputs: outputs as Output[],
        assets,
      };
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("content_projects").update({ status }).eq("id", projectId);
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
      const { error } = await supabase.from("content_projects").update({ is_favorite: !data.project.is_favorite }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-result", projectId] }),
  });

  const summaryRow = useMemo(() => data?.outputs.find((o) => o.output_type === "summary"), [data]);
  const masterRow = useMemo(() => data?.outputs.find((o) => o.output_type === "master"), [data]);
  const pieceRows = useMemo(() => data?.outputs.filter((o) => o.output_type === "piece") ?? [], [data]);
  const legacyRows = useMemo(
    () => data?.outputs.filter((o) => !["summary", "master", "piece"].includes(o.output_type)) ?? [],
    [data],
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data) return <p>Projeto não encontrado.</p>;

  const project = data.project;

  const pieces: { row: Output; piece: Piece | null }[] = pieceRows.map((row) => ({
    row,
    piece: parsePiece(row.edited_content ?? row.original_content),
  }));

  const allPiecesText = pieces
    .map(({ piece }) => (piece ? pieceToPlainText(piece) : ""))
    .filter(Boolean)
    .join("\n\n---\n\n");

  const fullExport = [
    summaryRow ? `# Resumo da campanha\n${summaryRow.edited_content ?? summaryRow.original_content}` : "",
    allPiecesText,
    masterRow ? `# Prompt mestre\n${masterRow.edited_content ?? masterRow.original_content}` : "",
  ].filter(Boolean).join("\n\n===\n\n");

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/library"><ArrowLeft className="mr-2 h-4 w-4" />Biblioteca</Link>
        </Button>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant="outline">{project.brands?.name ?? "Sem marca"}</Badge>
              <Badge variant={(project as unknown as { content_source?: string }).content_source === "external_chatgpt" ? "default" : "secondary"}>
                Fonte da copy: {
                  (project as unknown as { content_source?: string }).content_source === "external_chatgpt"
                    ? "ChatGPT externo"
                    : (project as unknown as { content_source?: string }).content_source === "manual"
                      ? "Edição manual"
                      : "Gerador automático"
                }
              </Badge>
            </div>
            <h1 className="truncate text-2xl font-bold">{project.internal_title || "Pacote de produção"}</h1>
            <p className="text-sm text-muted-foreground">
              {pieces.length} peça{pieces.length === 1 ? "" : "s"} gerada{pieces.length === 1 ? "" : "s"} ·
              ordem sugerida de publicação abaixo.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => toggleFavorite.mutate()} aria-label="Favoritar">
            <Heart className={`h-5 w-5 ${project.is_favorite ? "fill-primary text-primary" : ""}`} />
          </Button>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg gradient-brand">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">Seu pacote de produção está pronto</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada peça abaixo já tem texto sugerido, legenda, hashtags e um <b>prompt operacional pronto</b>.
                  Copie o prompt da peça desejada e cole no ChatGPT (ou outra IA) para gerar a arte final.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="default" size="sm">
                <Link to="/app/content/$projectId/client-pdf" params={{ projectId }}>
                  <FileImage className="mr-2 h-4 w-4" />Gerar PDF para o cliente
                </Link>
              </Button>
              <CopyButton text={fullExport} label="Copiar pacote completo" variant="outline" />
              <Button variant="outline" size="sm" onClick={exportTxt}>
                <Download className="mr-2 h-4 w-4" />Exportar TXT
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/app/content/new"><PenSquare className="mr-2 h-4 w-4" />Voltar e melhorar briefing</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />Exportar relatório interno
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("approved")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Marcar como aprovado
          </Button>
          <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("published")}>
            <Send className="mr-2 h-4 w-4" />Marcar como publicado
          </Button>
          <Badge variant="secondary" className="ml-auto">Status: {statusLabel(project.status)}</Badge>
        </div>
      </header>

      {/* SEÇÃO 1 — RESUMO DA CAMPANHA */}
      {summaryRow && (
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

      {/* SEÇÃO 2 — PEÇAS GERADAS */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Peças geradas ({pieces.length})</h2>
          <div className="flex items-center gap-2">
            {(() => {
              const assetsByOutput: Record<string, PieceAsset[]> = {};
              (data.assets ?? []).forEach((a) => { (assetsByOutput[a.output_id] ||= []).push(a); });
              const withArt = pieces.filter((p) => (assetsByOutput[p.row.id] ?? []).length > 0).length;
              return (
                <Badge variant="outline" className="text-xs">
                  Artes finais: {withArt} de {pieces.length} peça(s)
                </Badge>
              );
            })()}
            {pieces.length > 0 && (
              <CopyButton text={allPiecesText} label="Copiar todas as peças" variant="outline" size="sm" />
            )}
          </div>
        </div>
        {pieces.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma peça foi gerada para este projeto.</p>
        )}
        {pieces.map(({ row, piece }) =>
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
              onAssetsChanged={() => qc.invalidateQueries({ queryKey: ["project-result", projectId] })}
            />
          ) : (
            <LegacyBlockCard key={row.id} block={row} />
          ),
        )}
      </section>

      {/* Blocos legados (projetos antigos) */}
      {legacyRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Blocos auxiliares</h2>
          {legacyRows.map((o) => <LegacyBlockCard key={o.id} block={o} />)}
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
                Use somente se quiser passar todas as peças de uma vez para a IA. O fluxo recomendado é copiar peça por peça.
              </p>
              <CopyButton text={masterRow.edited_content ?? masterRow.original_content} label="Copiar prompt mestre" variant="outline" size="sm" />
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 text-xs leading-relaxed">
                {masterRow.edited_content ?? masterRow.original_content}
              </pre>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}

function statusLabel(s: string) {
  return ({ draft: "Rascunho", review: "Em revisão", approved: "Aprovado", published: "Publicado", archived: "Arquivado" } as Record<string, string>)[s] ?? s;
}

// ============ PIECE CARD ============

function PieceCard({
  row, piece, brand, project, allPieces, onCopyAndOpen,
}: {
  row: Output; piece: Piece;
  brand: Tables<"brands"> | null;
  project: Tables<"content_projects">;
  allPieces: Piece[];
  onCopyAndOpen: (text: string) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Piece>(piece);
  const [variationIdx, setVariationIdx] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustFocus, setAdjustFocus] = useState<"mainText" | "supportText" | "cta" | "bullets" | undefined>(undefined);

  const cycleVariation = () => {
    const heads = piece.headlineOptions ?? [];
    const supports = piece.supportTextOptions ?? [];
    if (heads.length <= 1 && supports.length <= 1) {
      toast.info("Sem variações alternativas disponíveis. Enriqueça o briefing para gerar mais opções.");
      return;
    }
    const next = variationIdx + 1;
    const newMain = heads.length ? heads[next % heads.length] : draft.mainText;
    const newSupport = supports.length ? supports[next % Math.max(supports.length, 1)] : draft.supportText;
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
      const { error } = await supabase.from("content_outputs").update({ is_favorite: !row.is_favorite }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-result", row.project_id] }),
  });

  const markProduced = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_outputs").update({ is_favorite: true }).eq("id", row.id);
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
              <Badge variant="outline" className="text-[10px]">{piece.formatLabel}</Badge>
              {row.is_favorite && <Badge variant="secondary" className="text-[10px]">Produzida</Badge>}
            </div>
            <h3 className="truncate font-display text-lg font-semibold">{piece.name}</h3>
            <p className="text-xs text-muted-foreground">Objetivo: {piece.objective}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAdjustFocus(undefined); setAdjustOpen(true); }}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />Ajustar esta peça
            </Button>
            <Button variant="ghost" size="icon" onClick={() => fav.mutate()} aria-label="Favoritar">
              <Star className={`h-4 w-4 ${row.is_favorite ? "fill-primary text-primary" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setExpanded((v) => !v)} aria-label="Expandir">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {piece.warning && (
          <button
            type="button"
            onClick={() => { setAdjustFocus(undefined); setAdjustOpen(true); }}
            className="mt-3 flex w-full items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-left text-xs text-amber-900 transition hover:bg-amber-500/20 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{piece.warning} <span className="underline">Clique para ajustar.</span></span>
          </button>
        )}
        {draft.qualityStatus === "blocked" && (
          <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />Esta copy precisa ser revisada antes da produção
            </p>
            {piece.qualityIssues && piece.qualityIssues.length > 0 && (
              <ul className="ml-5 mt-1 list-disc space-y-0.5">
                {piece.qualityIssues.map((q, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => { setAdjustFocus(focusFromIssue(q.code)); setAdjustOpen(true); }}
                    >
                      {q.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[11px] opacity-80">Clique em um aviso para abrir o editor com o campo destacado, ou use "Ajustar esta peça".</p>
          </div>
        )}
        {draft.qualityStatus !== "blocked" && piece.qualityIssues && piece.qualityIssues.length > 0 && (
          <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-900 dark:text-amber-200">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />Avisos de copy (não bloqueia o prompt)
            </p>
            <ul className="ml-5 list-disc space-y-0.5">
              {piece.qualityIssues.map((q, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline"
                    onClick={() => { setAdjustFocus(focusFromIssue(q.code)); setAdjustOpen(true); }}
                  >
                    {q.message}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] opacity-80">Clique no aviso para ajustar, ou use "Gerar variação de copy".</p>
          </div>
        )}

        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Estrutura semântica (síntese) */}
            <div className="grid gap-2 rounded-md border border-border/50 bg-muted/30 p-3 text-xs">
              <SemRow label="Ângulo" value={draft.communicationAngle} />
              {draft.mainPromise && draft.mainPromise !== "[PREENCHER]" && <SemRow label="Promessa" value={draft.mainPromise} />}
              {draft.mainProblem && draft.mainProblem !== "[PREENCHER]" && <SemRow label="Dor principal" value={draft.mainProblem} />}
              {draft.mainBenefit && draft.mainBenefit !== "[PREENCHER]" && <SemRow label="Benefício principal" value={draft.mainBenefit} />}
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
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Destaques</span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
                    {draft.bullets.map((b, i) => <li key={i}>{b}</li>)}
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
                  extra={<CopyButton text={draft.caption ?? ""} label="Copiar legenda" variant="ghost" size="sm" />}
                />
              )}
              {(piece.hashtags?.length || draft.hashtags?.length) ? (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hashtags</span>
                    <CopyButton text={(draft.hashtags ?? []).join(" ")} label="Copiar hashtags" variant="ghost" size="sm" />
                  </div>
                  {editing ? (
                    <Input
                      value={(draft.hashtags ?? []).join(" ")}
                      onChange={(e) => setDraft({ ...draft, hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(draft.hashtags ?? []).map((h) => (
                        <Badge key={h} variant="outline" className="font-normal">{h}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              {draft.productionNotes.length > 0 && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observações de produção</span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
                    {draft.productionNotes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {/* Prompt pronto */}
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {draft.qualityStatus === "blocked"
                    ? "Prompt indisponível — copy bloqueada"
                    : "Prompt pronto para colar no ChatGPT"}
                </span>
                {draft.qualityStatus !== "blocked" && (
                  <div className="flex gap-1">
                    <CopyButton text={draft.readyPrompt} label="Copiar prompt da página" variant="default" size="sm" />
                    <Button size="sm" variant="secondary" onClick={() => onCopyAndOpen(draft.readyPrompt)} className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />Abrir ChatGPT
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
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">{draft.readyPrompt}</pre>
              )}
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
              <CopyButton text={allOfPiece} label="Copiar tudo" variant="outline" size="sm" />
              <Button size="sm" variant="outline" onClick={cycleVariation}>
                <Shuffle className="mr-2 h-3.5 w-3.5" />Gerar variação de copy
              </Button>
              {!editing ? (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />Editar conteúdo
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={() => save.mutate()}>
                    <Save className="mr-2 h-3.5 w-3.5" />Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => restore.mutate()}>
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />Restaurar original
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setDraft(piece); setEditing(false); }}>
                    Cancelar
                  </Button>
                </>
              )}
              {!row.is_favorite && (
                <Button size="sm" variant="ghost" onClick={() => markProduced.mutate()} className="ml-auto">
                  <CheckCircle2 className="mr-2 h-3.5 w-3.5" />Marcar como produzida
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
      {brand && (
        <AdjustPieceDialog
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          piece={draft}
          brand={brand}
          project={project}
          otherPieces={allPieces}
          initialFocus={adjustFocus}
          prohibited={Array.isArray(brand.prohibited_words) ? brand.prohibited_words.filter(Boolean) : []}
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
  if (/raw_list|too_long|too_many_semicolons|placeholder|empty|incomplete/.test(code)) return "supportText";
  if (/cta/i.test(code)) return "cta";
  return "supportText";
}

function PieceField({
  label, value, editing, multiline, onChange, extra,
}: {
  label: string; value: string; editing: boolean; multiline?: boolean;
  onChange: (v: string) => void; extra?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
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
        <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 text-sm">{value}</p>
      ) : (
        <p className="text-xs italic text-muted-foreground">— não informado —</p>
      )}
    </div>
  );
}

function SemRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
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
      const { error } = await supabase.from("content_outputs").update({ edited_content: draft }).eq("id", block.id);
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
              <Button variant="ghost" size="icon" onClick={() => { setDraft(display); setEditing(true); }}><Pencil className="h-4 w-4" /></Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => save.mutate()}><Save className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
        {editing ? (
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.min(20, Math.max(6, draft.split("\n").length + 1))} className="font-mono text-sm" />
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 text-sm leading-relaxed">{display}</pre>
        )}
      </CardContent>
    </Card>
  );
}

// silencia imports não usados em alguns paths
void Copy;
