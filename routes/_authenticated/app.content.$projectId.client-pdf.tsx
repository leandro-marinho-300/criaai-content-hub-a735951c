import { MAX_HASHTAGS, normalizeHashtags } from "@/lib/hashtags";
// Tela "PDF para o cliente": modelos compacto (3 páginas) e detalhado,
// upload em lote, planejamento de publicação, validação textual e geração via html2canvas+jsPDF.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  RotateCcw,
  Image as ImageIcon,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Upload,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  fetchAssetsForProject,
  getSignedUrl,
  toggleIncludeInPdf,
  type PieceAsset,
} from "@/lib/pieceAssets";
import {
  generateClientPdf,
  buildPdfFileName,
  type ClientPdfPiece,
  type PdfModel,
  type ScheduleMode,
  type PdfScheduleData,
} from "@/lib/clientPdf";
import { parsePiece, type Piece } from "@/lib/promptBuilder";
import {
  normalizeForPdf,
  suggestShortTitle,
  validatePdfTextIntegrity,
} from "@/lib/pdfTextIntegrity";
import { BatchAssetUploadDialog } from "@/components/batch-asset-upload-dialog";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/content/$projectId/client-pdf")({
  head: () => ({ meta: [{ title: "PDF para o cliente — Cria Aí" }] }),
  component: ClientPdfPage,
});

interface PieceConfig {
  outputId: string;
  label: string;
  shortLabel: string;
  hidden: boolean;
  order: number;
}

const STATUS_OPTIONS = ["Para aprovação", "Aprovado", "Aprovado com ajustes", "Agendado"];

function ClientPdfPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-pdf-data", projectId],
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
      const { data: schedule } = await supabase
        .from("publication_schedule_items")
        .select("*")
        .eq("project_id", projectId)
        .limit(1)
        .maybeSingle();
      return {
        project: project as Tables<"content_projects"> & { brands: Tables<"brands"> | null },
        outputs: outputs as Tables<"content_outputs">[],
        assets,
        schedule: schedule as Tables<"publication_schedule_items"> | null,
      };
    },
  });

  const pieces = useMemo(() => {
    if (!data) return [] as { row: Tables<"content_outputs">; piece: Piece }[];
    return data.outputs
      .filter((o) => o.output_type === "piece")
      .map((row) => {
        const p = parsePiece(row.edited_content ?? row.original_content);
        return p ? { row, piece: p } : null;
      })
      .filter(Boolean) as { row: Tables<"content_outputs">; piece: Piece }[];
  }, [data]);

  const assetsByOutput = useMemo(() => {
    const map: Record<string, PieceAsset[]> = {};
    (data?.assets ?? []).forEach((a) => {
      (map[a.output_id] ||= []).push(a);
    });
    return map;
  }, [data]);

  // ============ Estado de configuração ============
  const [model, setModel] = useState<PdfModel>("compact");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [statusLabel, setStatusLabel] = useState(STATUS_OPTIONS[0]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showLogo, setShowLogo] = useState(true);
  const [showPieceNumber, setShowPieceNumber] = useState(true);
  const [includeCover, setIncludeCover] = useState(true);
  const [includeFinalPage, setIncludeFinalPage] = useState(true);
  const [accentColor, setAccentColor] = useState("");
  const [pieceCfg, setPieceCfg] = useState<PieceConfig[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewByAsset, setPreviewByAsset] = useState<Record<string, string>>({});
  const [showBatch, setShowBatch] = useState(false);

  // Planejamento
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("client_defines");
  const [channel, setChannel] = useState("");
  const [suggestedDate, setSuggestedDate] = useState("");
  const [suggestedTime, setSuggestedTime] = useState("");
  const [confirmedDate, setConfirmedDate] = useState("");
  const [confirmedTime, setConfirmedTime] = useState("");
  const [responsible, setResponsible] = useState("");
  const [notes, setNotes] = useState("");

  // Defaults
  const initialTitle = useMemo(() => {
    const project = data?.project as
      | {
          display_title?: string | null;
          internal_title?: string | null;
          theme?: string | null;
          main_message?: string | null;
        }
      | undefined;
    const display = (project?.display_title || "").trim();
    if (display && display.length <= 100) return display;
    const internal = (project?.internal_title || "").trim();
    if (internal && internal.length <= 80) return internal;
    return suggestShortTitle(internal || project?.theme || "", "Apresentação");
  }, [data]);
  const initialCaption = useMemo(() => {
    const withCaption = pieces.find((p) => p.piece.caption && p.piece.caption.trim());
    return withCaption?.piece.caption ?? "";
  }, [pieces]);
  const initialHashtags = useMemo(() => {
    const withTags = pieces.find((p) => p.piece.hashtags && p.piece.hashtags.length);
    return (withTags?.piece.hashtags ?? []).join(" ");
  }, [pieces]);

  useEffect(() => {
    if (!data || pieces.length === 0) return;
    if (!title) setTitle(initialTitle);
    if (!caption) setCaption(initialCaption);
    if (!hashtags) setHashtags(initialHashtags);
    if (!accentColor) setAccentColor(data.project.brands?.primary_color ?? "");
    if (data.schedule) {
      setScheduleMode(
        data.schedule.schedule_status === "agendado" || data.schedule.schedule_status === "aprovado"
          ? "confirmed"
          : data.schedule.suggested_date
            ? "suggested"
            : "client_defines",
      );
      setChannel(data.schedule.channel ?? "");
      setSuggestedDate(data.schedule.suggested_date ?? "");
      setSuggestedTime(data.schedule.suggested_time ?? "");
      setConfirmedDate(data.schedule.confirmed_date ?? "");
      setConfirmedTime(data.schedule.confirmed_time ?? "");
      setResponsible(data.schedule.approved_by ?? "");
      setNotes(data.schedule.client_notes ?? "");
    }
    setPieceCfg((prev) =>
      prev.length === pieces.length
        ? prev
        : pieces.map((p, i) => {
            const role = (p.piece.role || p.piece.name || "Peça").trim();
            return {
              outputId: p.row.id,
              label: `Página ${i + 1} de ${pieces.length} — ${role}`,
              shortLabel: role,
              hidden: false,
              order: i,
            };
          }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pieces.length]);

  // Pré-carrega thumbs
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const a of data.assets) {
        try {
          out[a.id] = await getSignedUrl(a.storage_path, 1800);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setPreviewByAsset(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data) return <p>Projeto não encontrado.</p>;

  const orderedPieces = [...pieceCfg].sort((a, b) => a.order - b.order);
  const visiblePieces = orderedPieces.filter((p) => !p.hidden);
  const includedAssets = visiblePieces.flatMap((c) =>
    (assetsByOutput[c.outputId] ?? []).filter((a) => a.include_in_client_pdf !== false),
  );
  const piecesWithoutArt = visiblePieces.filter(
    (c) => (assetsByOutput[c.outputId] ?? []).length === 0,
  ).length;
  const totalAssets = includedAssets.length;
  const lowResAssets = includedAssets.filter(
    (a) => (a.image_width || 0) > 0 && (a.image_width || 0) < 720,
  ).length;

  const movePiece = (idx: number, dir: -1 | 1) => {
    setPieceCfg((prev) => {
      const next = [...prev].sort((a, b) => a.order - b.order);
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((p, i) => ({ ...p, order: i }));
    });
  };

  const togglePieceHidden = (outputId: string) => {
    setPieceCfg((prev) =>
      prev.map((p) => (p.outputId === outputId ? { ...p, hidden: !p.hidden } : p)),
    );
  };

  const updateLabel = (outputId: string, label: string) => {
    setPieceCfg((prev) =>
      prev.map((p) =>
        p.outputId === outputId
          ? { ...p, label, shortLabel: label.replace(/^Página\s+\d+\s+de\s+\d+\s+—\s+/i, "") }
          : p,
      ),
    );
  };

  const handleToggleIncludeAsset = async (asset: PieceAsset) => {
    try {
      await toggleIncludeInPdf(asset.id, !(asset.include_in_client_pdf ?? true));
      refetch();
    } catch {
      toast.error("Não foi possível atualizar.");
    }
  };

  const restoreDefaults = () => {
    setModel("compact");
    setTitle(initialTitle);
    setSubtitle("");
    setVersionLabel("");
    setStatusLabel(STATUS_OPTIONS[0]);
    setCaption(initialCaption);
    setHashtags(initialHashtags);
    setTheme("light");
    setShowLogo(true);
    setShowPieceNumber(true);
    setIncludeCover(true);
    setIncludeFinalPage(true);
    setAccentColor(data?.project.brands?.primary_color ?? "");
    setScheduleMode("client_defines");
    setChannel("");
    setSuggestedDate("");
    setSuggestedTime("");
    setConfirmedDate("");
    setConfirmedTime("");
    setResponsible("");
    setNotes("");
    setPieceCfg(
      pieces.map((p, i) => {
        const role = (p.piece.role || p.piece.name || "Peça").trim();
        return {
          outputId: p.row.id,
          label: `Página ${i + 1} de ${pieces.length} — ${role}`,
          shortLabel: role,
          hidden: false,
          order: i,
        };
      }),
    );
    toast.success("Configuração restaurada.");
  };

  // Salva planejamento no banco
  const persistSchedule = async () => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      project_id: projectId,
      brand_id: data?.project.brand_id ?? null,
      publication_unit: data?.project.selected_formats?.[0] ?? "post",
      channel: channel || null,
      title: title || null,
      suggested_date: suggestedDate || null,
      suggested_time: suggestedTime || null,
      confirmed_date: confirmedDate || null,
      confirmed_time: confirmedTime || null,
      schedule_status:
        scheduleMode === "confirmed"
          ? "agendado"
          : scheduleMode === "suggested"
            ? "sugerido"
            : "sem_data",
      client_notes: notes || null,
      approved_by: responsible || null,
    };
    if (data?.schedule) {
      await supabase.from("publication_schedule_items").update(payload).eq("id", data.schedule.id);
    } else {
      await supabase.from("publication_schedule_items").insert(payload);
    }
  };

  const handleGenerate = async (autoDownload: boolean, chosenModel: PdfModel) => {
    if (totalAssets === 0) {
      toast.error("Anexe pelo menos uma arte final antes de gerar o PDF.");
      return;
    }
    if (piecesWithoutArt > 0) {
      const ok = confirm(
        `${piecesWithoutArt} peça(s) ainda não possuem arte final. Gerar o PDF somente com as artes anexadas?`,
      );
      if (!ok) return;
    }
    // Validação textual
    const integrity = validatePdfTextIntegrity([
      { field: "titulo", original: title, prepared: normalizeForPdf(title) },
      { field: "legenda", original: caption, prepared: normalizeForPdf(caption) },
      { field: "hashtags", original: hashtags, prepared: normalizeForPdf(hashtags) },
    ]);
    const errors = integrity.filter((i) => i.severity === "error");
    if (errors.length) {
      toast.error(
        "Não foi possível preservar corretamente parte do texto: " +
          errors.map((e) => `${e.field}: ${e.message}`).join("; "),
      );
      return;
    }

    setGenerating(true);
    try {
      await persistSchedule();
      const piecesInput: ClientPdfPiece[] = orderedPieces.map((c) => ({
        outputId: c.outputId,
        label: c.label,
        shortLabel: c.shortLabel,
        hidden: c.hidden,
        assets: (assetsByOutput[c.outputId] ?? [])
          .filter((a) => a.include_in_client_pdf !== false)
          .slice()
          .sort((a, b) => a.display_order - b.display_order),
      }));

      const schedule: PdfScheduleData = {
        mode: scheduleMode,
        channel,
        suggestedDate,
        suggestedTime,
        confirmedDate,
        confirmedTime,
        responsible,
        notes,
      };

      const blob = await generateClientPdf({
        model: chosenModel,
        brandName: data.project.brands?.name ?? "",
        brandLogoUrl: data.project.brands?.logo_url ?? null,
        primaryColor: data.project.brands?.primary_color ?? null,
        secondaryColor: data.project.brands?.secondary_color ?? null,
        accentColor: accentColor || null,
        title: normalizeForPdf(title) || "Apresentação",
        subtitle: normalizeForPdf(subtitle) || undefined,
        formatLabel: (data.project.selected_formats ?? []).join(" · ") || undefined,
        versionLabel: normalizeForPdf(versionLabel) || undefined,
        statusLabel: chosenModel === "compact" ? statusLabel : undefined,
        caption: normalizeForPdf(caption),
        hashtags: normalizeHashtags(hashtags).map(normalizeForPdf),
        pieces: piecesInput,
        schedule,
        options: { theme, showLogo, showPieceNumber, includeCover, includeFinalPage },
      });

      const fileName = buildPdfFileName(data.project.brands?.name ?? "marca", title, chosenModel);
      if (autoDownload) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(
        chosenModel === "compact"
          ? "PDF para aprovação criado com sucesso."
          : "PDF detalhado criado com sucesso.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const batchTargets = orderedPieces.map((c) => ({
    outputId: c.outputId,
    label: c.label,
    currentCount: (assetsByOutput[c.outputId] ?? []).length,
  }));

  const alerts: string[] = [];
  if (piecesWithoutArt > 0)
    alerts.push(`${piecesWithoutArt} peça(s) sem arte final — serão omitidas.`);
  if (!title.trim()) alerts.push("O título está vazio.");
  if (title.length > 90) alerts.push("Título muito longo — pode quebrar a capa.");
  if (lowResAssets > 0) alerts.push(`${lowResAssets} imagem(ns) com resolução baixa (<720px).`);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/content/$projectId/result" params={{ projectId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o resultado
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-bold">PDF para o cliente</h1>
        <p className="text-sm text-muted-foreground">
          O modelo compacto reúne conteúdo, peças e planejamento em três páginas. Os textos
          aprovados são preservados (acentos, emojis e quebras).
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Modelo */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Modelo do documento</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <ModelOption
                  active={model === "compact"}
                  title="Compacto para aprovação"
                  desc="Reúne conteúdo, peças e planejamento de publicação em um documento compacto."
                  onClick={() => setModel("compact")}
                />
                <ModelOption
                  active={model === "detailed"}
                  title="Detalhado"
                  desc="Apresenta uma arte por página, indicado para análise ampliada ou arquivo interno."
                  onClick={() => setModel("detailed")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Identificação */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="font-display text-base font-semibold">Identificação</h2>
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="title">Título da campanha</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {title.length > 80
                      ? "Aviso: título longo pode quebrar a capa."
                      : "Mantenha curto (até 2 linhas)."}
                  </p>
                </div>
                <div>
                  <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
                  <Input
                    id="subtitle"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ex.: Carrossel para Instagram"
                    maxLength={120}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="version">Data ou versão</Label>
                    <Input
                      id="version"
                      value={versionLabel}
                      onChange={(e) => setVersionLabel(e.target.value)}
                      placeholder="Versão 1 — 19/06/2026"
                      maxLength={60}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={statusLabel}
                      onChange={(e) => setStatusLabel(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Peças */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold">
                  Peças ({visiblePieces.length} de {pieces.length})
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{totalAssets} arte(s) no PDF</Badge>
                  <Button size="sm" variant="outline" onClick={() => setShowBatch(true)}>
                    <Upload className="mr-1 h-3.5 w-3.5" /> Enviar várias artes
                  </Button>
                </div>
              </div>
              {orderedPieces.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma peça encontrada.</p>
              )}
              <div className="space-y-2">
                {orderedPieces.map((c, idx) => {
                  const assets = assetsByOutput[c.outputId] ?? [];
                  return (
                    <div
                      key={c.outputId}
                      className={`rounded-md border border-border/60 p-3 ${c.hidden ? "opacity-50" : ""}`}
                    >
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => movePiece(idx, -1)}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => movePiece(idx, 1)}
                            disabled={idx === orderedPieces.length - 1}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          {assets.length === 0 ? (
                            <div className="grid h-16 w-16 shrink-0 place-items-center rounded border border-dashed border-border/60 text-muted-foreground">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          ) : (
                            <div className="flex shrink-0 flex-wrap gap-1">
                              {assets.slice(0, 4).map((a) => (
                                <button
                                  key={a.id}
                                  onClick={() => handleToggleIncludeAsset(a)}
                                  className="relative h-16 w-16 overflow-hidden rounded border border-border/40"
                                  title={
                                    a.include_in_client_pdf !== false
                                      ? "Remover do PDF"
                                      : "Incluir no PDF"
                                  }
                                >
                                  {previewByAsset[a.id] ? (
                                    <img
                                      src={previewByAsset[a.id]}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-full w-full bg-muted" />
                                  )}
                                  {a.include_in_client_pdf === false && (
                                    <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
                                      <EyeOff className="h-4 w-4" />
                                    </div>
                                  )}
                                </button>
                              ))}
                              {assets.length > 4 && (
                                <div className="grid h-16 w-16 place-items-center rounded bg-muted text-xs">
                                  +{assets.length - 4}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <Input
                              value={c.label}
                              onChange={(e) => updateLabel(c.outputId, e.target.value)}
                              className="h-8 text-sm"
                            />
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {assets.length === 0
                                ? "Sem arte — peça será omitida."
                                : `${assets.filter((a) => a.include_in_client_pdf !== false).length}/${assets.length} no PDF · clique numa miniatura para incluir/remover`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-[11px] text-muted-foreground">Incluir</Label>
                            <Switch
                              checked={!c.hidden}
                              onCheckedChange={() => togglePieceHidden(c.outputId)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Para anexar artes individuais, use "Anexar arte final" no card da peça em
                "Resultado".
              </p>
            </CardContent>
          </Card>

          {/* Legenda */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Legenda</h2>
              <Textarea
                rows={7}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Legenda da publicação"
              />
              <Button variant="ghost" size="sm" onClick={() => setCaption(initialCaption)}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restaurar legenda aprovada
              </Button>
            </CardContent>
          </Card>

          {/* Hashtags */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Hashtags</h2>
              <Textarea
                rows={3}
                value={hashtags}
                onChange={(e) => setHashtags(normalizeHashtags(e.target.value).join(" "))}
                placeholder="#exemplo #marca"
              />
              <p className="text-xs text-muted-foreground">Máximo de {MAX_HASHTAGS} hashtags.</p>
              <p className="text-xs text-muted-foreground">
                Separe por espaço. Mantenha o # — não quebram dentro de uma hashtag.
              </p>
            </CardContent>
          </Card>

          {/* Planejamento */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Planejamento da publicação</h2>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={scheduleMode === "client_defines" ? "default" : "outline"}
                  onClick={() => setScheduleMode("client_defines")}
                >
                  Cliente define
                </Button>
                <Button
                  size="sm"
                  variant={scheduleMode === "suggested" ? "default" : "outline"}
                  onClick={() => setScheduleMode("suggested")}
                >
                  Calendário sugerido
                </Button>
                <Button
                  size="sm"
                  variant={scheduleMode === "confirmed" ? "default" : "outline"}
                  onClick={() => setScheduleMode("confirmed")}
                >
                  Calendário confirmado
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Canal</Label>
                  <Input
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    placeholder="Instagram Feed"
                  />
                </div>
                <div>
                  <Label>Responsável</Label>
                  <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
                </div>
                {scheduleMode !== "client_defines" && (
                  <>
                    <div>
                      <Label>
                        {scheduleMode === "confirmed" ? "Data confirmada" : "Data sugerida"}
                      </Label>
                      <Input
                        type="date"
                        value={scheduleMode === "confirmed" ? confirmedDate : suggestedDate}
                        onChange={(e) =>
                          scheduleMode === "confirmed"
                            ? setConfirmedDate(e.target.value)
                            : setSuggestedDate(e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>
                        {scheduleMode === "confirmed" ? "Horário confirmado" : "Horário sugerido"}
                      </Label>
                      <Input
                        type="time"
                        value={scheduleMode === "confirmed" ? confirmedTime : suggestedTime}
                        onChange={(e) =>
                          scheduleMode === "confirmed"
                            ? setConfirmedTime(e.target.value)
                            : setSuggestedTime(e.target.value)
                        }
                      />
                    </div>
                  </>
                )}
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Aparência */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Aparência</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border border-border/60 p-2">
                  <span className="text-sm">Tema</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={theme === "light" ? "default" : "outline"}
                      onClick={() => setTheme("light")}
                    >
                      Claro
                    </Button>
                    <Button
                      size="sm"
                      variant={theme === "dark" ? "default" : "outline"}
                      onClick={() => setTheme("dark")}
                    >
                      Escuro
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 p-2">
                  <Label htmlFor="accent" className="text-sm">
                    Cor de destaque
                  </Label>
                  <Input
                    id="accent"
                    type="color"
                    value={accentColor || "#ea580c"}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-8 w-16"
                  />
                </div>
                <ToggleRow label="Usar logo da marca" checked={showLogo} onChange={setShowLogo} />
                <ToggleRow
                  label="Mostrar número das peças"
                  checked={showPieceNumber}
                  onChange={setShowPieceNumber}
                />
                {model === "detailed" && (
                  <>
                    <ToggleRow
                      label="Incluir capa"
                      checked={includeCover}
                      onChange={setIncludeCover}
                    />
                    <ToggleRow
                      label="Incluir planejamento"
                      checked={includeFinalPage}
                      onChange={setIncludeFinalPage}
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Prévia</h2>
              <div className="space-y-1 text-sm">
                <div>
                  <strong>Modelo:</strong>{" "}
                  {model === "compact" ? "Compacto (3 páginas)" : "Detalhado"}
                </div>
                <div>
                  <strong>Peças no PDF:</strong> {totalAssets} imagem(ns) em {visiblePieces.length}{" "}
                  peça(s)
                </div>
                <div>
                  <strong>Planejamento:</strong>{" "}
                  {scheduleMode === "confirmed"
                    ? "Confirmado"
                    : scheduleMode === "suggested"
                      ? "Sugerido"
                      : "Cliente define"}
                </div>
              </div>

              {alerts.length > 0 && (
                <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                  <p className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avisos
                  </p>
                  <ul className="ml-4 list-disc space-y-0.5 text-amber-900 dark:text-amber-100">
                    {alerts.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full"
                  onClick={() => handleGenerate(true, model)}
                  disabled={generating}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {generating
                    ? "Gerando..."
                    : model === "compact"
                      ? "Gerar PDF compacto"
                      : "Gerar PDF detalhado"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleGenerate(true, model === "compact" ? "detailed" : "compact")}
                  disabled={generating}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar também o {model === "compact" ? "detalhado" : "compacto"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={restoreDefaults}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() =>
                    navigate({ to: "/app/content/$projectId/result", params: { projectId } })
                  }
                >
                  <Eye className="mr-2 h-4 w-4" /> Voltar e editar
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => refetch()}>
                  Recarregar artes
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {user && (
        <BatchAssetUploadDialog
          open={showBatch}
          onOpenChange={setShowBatch}
          userId={user.id}
          projectId={projectId}
          pieces={batchTargets}
          onComplete={() => refetch()}
        />
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 p-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ModelOption({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border p-3 text-left transition ${active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border/60 hover:border-border"}`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-[11px] text-muted-foreground">{desc}</p>
    </button>
  );
}
