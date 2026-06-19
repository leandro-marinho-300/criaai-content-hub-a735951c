// Tela "Gerar PDF para o cliente": configuração + prévia textual + geração com jsPDF.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, RotateCcw, Image as ImageIcon, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { fetchAssetsForProject, getSignedUrl, type PieceAsset } from "@/lib/pieceAssets";
import { generateClientPdf, slugifyFileName, type ClientPdfPiece } from "@/lib/clientPdf";
import { parsePiece, type Piece } from "@/lib/promptBuilder";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/content/$projectId/client-pdf")({
  head: () => ({ meta: [{ title: "PDF para o cliente — Cria Aí" }] }),
  component: ClientPdfPage,
});

interface PieceConfig {
  outputId: string;
  label: string;
  hidden: boolean;
  order: number;
}

function ClientPdfPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-pdf-data", projectId],
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
        outputs: outputs as Tables<"content_outputs">[],
        assets,
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

  const initialTitle = useMemo(() => {
    const theme = (data?.project.theme || "").trim();
    const internal = (data?.project.internal_title || "").trim();
    if (internal) return internal;
    // Pega só a primeira frase curta do tema para não usar listas inteiras como título.
    const first = theme.split(/[.;\n]/)[0].trim();
    return first.length > 80 ? first.slice(0, 77) + "…" : first || "Apresentação";
  }, [data]);

  const initialCaption = useMemo(() => {
    const withCaption = pieces.find((p) => p.piece.caption && p.piece.caption.trim());
    return withCaption?.piece.caption ?? "";
  }, [pieces]);

  const initialHashtags = useMemo(() => {
    const withTags = pieces.find((p) => p.piece.hashtags && p.piece.hashtags.length);
    return (withTags?.piece.hashtags ?? []).join(" ");
  }, [pieces]);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
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

  // Aplica defaults quando carregar
  useEffect(() => {
    if (!data || pieces.length === 0) return;
    if (!title) setTitle(initialTitle);
    if (!caption) setCaption(initialCaption);
    if (!hashtags) setHashtags(initialHashtags);
    if (!accentColor) setAccentColor(data.project.brands?.primary_color ?? "");
    setPieceCfg((prev) =>
      prev.length === pieces.length
        ? prev
        : pieces.map((p, i) => ({
            outputId: p.row.id,
            label: `Página ${i + 1} de ${pieces.length} — ${p.piece.role || p.piece.name}`,
            hidden: false,
            order: i,
          })),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pieces.length]);

  // Pré-carrega thumbs da prévia
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const a of data.assets) {
        try {
          out[a.id] = await getSignedUrl(a.storage_path, 1800);
        } catch {/* skip */}
      }
      if (!cancelled) setPreviewByAsset(out);
    })();
    return () => { cancelled = true; };
  }, [data]);

  const restoreDefaults = () => {
    setTitle(initialTitle);
    setSubtitle("");
    setVersionLabel("");
    setCaption(initialCaption);
    setHashtags(initialHashtags);
    setTheme("light");
    setShowLogo(true);
    setShowPieceNumber(true);
    setIncludeCover(true);
    setIncludeFinalPage(true);
    setAccentColor(data?.project.brands?.primary_color ?? "");
    setPieceCfg(pieces.map((p, i) => ({
      outputId: p.row.id,
      label: `Página ${i + 1} de ${pieces.length} — ${p.piece.role || p.piece.name}`,
      hidden: false,
      order: i,
    })));
    toast.success("Configuração restaurada.");
  };

  const movePiece = (idx: number, dir: -1 | 1) => {
    setPieceCfg((prev) => {
      const next = [...prev].sort((a, b) => a.order - b.order);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((p, i) => ({ ...p, order: i }));
    });
  };

  const togglePieceHidden = (outputId: string) => {
    setPieceCfg((prev) => prev.map((p) => (p.outputId === outputId ? { ...p, hidden: !p.hidden } : p)));
  };

  const updateLabel = (outputId: string, label: string) => {
    setPieceCfg((prev) => prev.map((p) => (p.outputId === outputId ? { ...p, label } : p)));
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data) return <p>Projeto não encontrado.</p>;

  const orderedPieces = [...pieceCfg].sort((a, b) => a.order - b.order);
  const visiblePieces = orderedPieces.filter((p) => !p.hidden);
  const piecesWithoutArt = visiblePieces.filter((c) => (assetsByOutput[c.outputId] ?? []).length === 0).length;
  const totalAssets = visiblePieces.reduce((s, c) => s + (assetsByOutput[c.outputId] ?? []).length, 0);
  const lowResAssets = (data.assets ?? []).filter((a) => (a.image_width || 0) > 0 && (a.image_width || 0) < 720).length;

  const alerts: string[] = [];
  if (piecesWithoutArt > 0) alerts.push(`${piecesWithoutArt} peça(s) sem arte final — serão omitidas do PDF.`);
  if (!title.trim()) alerts.push("O título está vazio.");
  if (title.length > 90) alerts.push("Título muito longo — pode quebrar a capa.");
  if (!caption.trim()) alerts.push("Legenda vazia.");
  if (!hashtags.trim()) alerts.push("Sem hashtags.");
  if (!data.project.brands?.logo_url && showLogo) alerts.push("A marca não tem logo cadastrada.");
  if (lowResAssets > 0) alerts.push(`${lowResAssets} imagem(ns) com resolução baixa (<720px).`);

  const handleGenerate = async (autoDownload: boolean) => {
    if (totalAssets === 0) {
      toast.error("Anexe pelo menos uma arte final antes de gerar o PDF.");
      return;
    }
    if (piecesWithoutArt > 0) {
      const ok = confirm(`${piecesWithoutArt} peça(s) ainda não possuem arte final. Gerar o PDF somente com as peças anexadas?`);
      if (!ok) return;
    }
    setGenerating(true);
    try {
      const piecesInput: ClientPdfPiece[] = orderedPieces.map((c) => ({
        outputId: c.outputId,
        label: c.label,
        hidden: c.hidden,
        assets: (assetsByOutput[c.outputId] ?? []).slice().sort((a, b) => a.display_order - b.display_order),
      }));

      const blob = await generateClientPdf({
        brandName: data.project.brands?.name ?? "",
        brandLogoUrl: data.project.brands?.logo_url ?? null,
        primaryColor: data.project.brands?.primary_color ?? null,
        secondaryColor: data.project.brands?.secondary_color ?? null,
        title: title.trim() || "Apresentação",
        subtitle: subtitle.trim() || undefined,
        formatLabel: (data.project.selected_formats ?? []).join(" · ") || undefined,
        versionLabel: versionLabel.trim() || undefined,
        caption: caption.trim(),
        hashtags: hashtags.split(/\s+/).map((s) => s.trim()).filter(Boolean),
        pieces: piecesInput,
        options: {
          theme,
          showLogo,
          showPieceNumber,
          includeCover,
          includeFinalPage,
          accentColor: accentColor || undefined,
        },
      });

      const fileName = slugifyFileName(data.project.brands?.name ?? "marca", title);
      if (autoDownload) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("PDF do cliente criado com sucesso.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar PDF.");
    } finally {
      setGenerating(false);
    }
  };

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
          Configure a apresentação final com as artes anexadas. O documento gerado contém apenas título, peças, legenda e hashtags — sem prompts ou avisos técnicos.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Identificação */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="font-display text-base font-semibold">Identificação</h2>
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="title">Título da campanha</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
                  <Input id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ex.: Carrossel educativo para Instagram" maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="version">Data ou versão (opcional)</Label>
                  <Input id="version" value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="Ex.: Versão 1 — 19/06/2026" maxLength={60} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Peças */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Peças ({visiblePieces.length} de {pieces.length})</h2>
                <Badge variant="secondary">{totalAssets} arte(s)</Badge>
              </div>
              {orderedPieces.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma peça encontrada.</p>
              )}
              <div className="space-y-2">
                {orderedPieces.map((c, idx) => {
                  const assets = assetsByOutput[c.outputId] ?? [];
                  return (
                    <div key={c.outputId} className={`rounded-md border border-border/60 p-3 ${c.hidden ? "opacity-50" : ""}`}>
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="flex flex-col gap-0.5">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => movePiece(idx, -1)} disabled={idx === 0}>
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => movePiece(idx, 1)} disabled={idx === orderedPieces.length - 1}>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          {assets.length === 0 ? (
                            <div className="grid h-16 w-16 shrink-0 place-items-center rounded border border-dashed border-border/60 text-muted-foreground">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          ) : (
                            <div className="flex shrink-0 gap-1">
                              {assets.slice(0, 3).map((a) =>
                                previewByAsset[a.id] ? (
                                  <img key={a.id} src={previewByAsset[a.id]} alt="" className="h-16 w-16 rounded object-cover" />
                                ) : (
                                  <div key={a.id} className="h-16 w-16 rounded bg-muted" />
                                ),
                              )}
                              {assets.length > 3 && (
                                <div className="grid h-16 w-16 place-items-center rounded bg-muted text-xs">+{assets.length - 3}</div>
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
                              {assets.length === 0 ? "Sem arte anexada — peça será omitida do PDF." : `${assets.length} arte(s) anexada(s)`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-[11px] text-muted-foreground">Incluir</Label>
                            <Switch checked={!c.hidden} onCheckedChange={() => togglePieceHidden(c.outputId)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Para anexar ou trocar uma arte, volte para o resultado da campanha e use "Anexar arte final" no card da peça.
              </p>
            </CardContent>
          </Card>

          {/* Legenda */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Legenda</h2>
              <Textarea rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda da publicação" />
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
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#exemplo #marca"
              />
              <p className="text-xs text-muted-foreground">As hashtags são separadas por espaço.</p>
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
                    <Button size="sm" variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>Claro</Button>
                    <Button size="sm" variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>Escuro</Button>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 p-2">
                  <Label htmlFor="accent" className="text-sm">Cor de destaque</Label>
                  <Input id="accent" type="color" value={accentColor || "#6c5ce7"} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-16" />
                </div>
                <ToggleRow label="Usar logo da marca" checked={showLogo} onChange={setShowLogo} />
                <ToggleRow label="Mostrar número das peças" checked={showPieceNumber} onChange={setShowPieceNumber} />
                <ToggleRow label="Incluir capa" checked={includeCover} onChange={setIncludeCover} />
                <ToggleRow label="Incluir página final (legenda/hashtags)" checked={includeFinalPage} onChange={setIncludeFinalPage} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar de prévia / ações */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Prévia</h2>
              <div className="space-y-1 text-sm">
                <div><strong>Capa:</strong> {includeCover ? "Sim" : "Não"}</div>
                <div><strong>Peças no PDF:</strong> {totalAssets} imagem(ns) em {visiblePieces.length} peça(s)</div>
                <div><strong>Página final:</strong> {includeFinalPage ? "Legenda + Hashtags" : "Não"}</div>
                <div><strong>Estimativa:</strong> ~{(includeCover ? 1 : 0) + totalAssets + (includeFinalPage ? 1 : 0)} páginas</div>
              </div>

              {alerts.length > 0 && (
                <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                  <p className="flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avisos
                  </p>
                  <ul className="ml-4 list-disc space-y-0.5 text-amber-900 dark:text-amber-100">
                    {alerts.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Button className="w-full" onClick={() => handleGenerate(true)} disabled={generating}>
                  <Download className="mr-2 h-4 w-4" />
                  {generating ? "Gerando..." : "Gerar e baixar PDF"}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => handleGenerate(false)} disabled={generating}>
                  <FileText className="mr-2 h-4 w-4" /> Gerar (sem baixar)
                </Button>
                <Button variant="ghost" className="w-full" onClick={restoreDefaults}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/app/content/$projectId/result", params: { projectId } })}>
                  Voltar e editar
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => refetch()}>
                  Recarregar artes
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 p-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
