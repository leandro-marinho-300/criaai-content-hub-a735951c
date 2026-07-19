import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileVideo,
  Loader2,
  PlayCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  deletePieceAsset,
  getSignedUrl,
  isReelFinalVideoAsset,
  toggleApproval,
  uploadReelFinalVideoAsset,
  type PieceAsset,
} from "@/lib/pieceAssets";
import type { Reel2ImportedScript } from "@/lib/reel2Script";
import {
  attachReel2ProductionMeta,
  buildReel2EditorKit,
  buildReel2RecordingChecklist,
  buildReel2ReviewChecklist,
  getReel2ProductionMeta,
  REEL2_PRODUCTION_FLOW,
  REEL2_PRODUCTION_STATUS_LABEL,
  type Reel2ProductionMeta,
  type Reel2ProductionStatus,
} from "@/lib/reel2Production";

interface Reel2ProductionPanelProps {
  userId: string;
  projectId: string;
  outputId: string;
  outputImportedContent: unknown;
  script: Reel2ImportedScript;
  brand: Tables<"brands"> | null;
  assets: PieceAsset[];
  onChange: () => void;
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatBytes(value: number | null | undefined): string {
  if (!value) return "—";
  const mb = value / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export function Reel2ProductionPanel({
  userId,
  projectId,
  outputId,
  outputImportedContent,
  script,
  brand,
  assets,
  onChange,
}: Reel2ProductionPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Reel2ProductionMeta>(() => getReel2ProductionMeta(outputImportedContent));

  useEffect(() => {
    setMeta(getReel2ProductionMeta(outputImportedContent));
  }, [outputImportedContent]);

  const finalVideos = useMemo(
    () => assets.filter(isReelFinalVideoAsset).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [assets],
  );
  const latestVideo = finalVideos.at(-1) ?? null;
  const recordingChecklist = useMemo(() => buildReel2RecordingChecklist(script), [script]);
  const reviewChecklist = useMemo(() => buildReel2ReviewChecklist(script), [script]);
  const editorKit = useMemo(() => buildReel2EditorKit(script, brand), [script, brand]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const asset of finalVideos) {
        try {
          next[asset.id] = await getSignedUrl(asset.storage_path, 1800);
        } catch {
          // preview opcional
        }
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [finalVideos]);

  const persistMeta = async (nextMeta: Reel2ProductionMeta) => {
    const { error } = await supabase
      .from("content_outputs")
      .update({ imported_content: attachReel2ProductionMeta(outputImportedContent, nextMeta) as any })
      .eq("id", outputId);
    if (error) throw error;
    setMeta(nextMeta);
  };

  const patchMeta = async (patch: Partial<Reel2ProductionMeta>) => {
    const next: Reel2ProductionMeta = {
      ...meta,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    await persistMeta(next);
    onChange();
  };

  const toggleRecording = async (id: string) => {
    const checked = new Set(meta.recording_checked);
    if (checked.has(id)) checked.delete(id);
    else checked.add(id);
    try {
      await patchMeta({ recording_checked: Array.from(checked) });
    } catch {
      toast.error("Não foi possível salvar o checklist.");
    }
  };

  const toggleReview = async (id: string) => {
    const checked = new Set(meta.review_checked);
    if (checked.has(id)) checked.delete(id);
    else checked.add(id);
    try {
      await patchMeta({ review_checked: Array.from(checked) });
    } catch {
      toast.error("Não foi possível salvar o checklist.");
    }
  };

  const changeStatus = async (status: Reel2ProductionStatus) => {
    try {
      await patchMeta({ status });
      toast.success("Status de produção atualizado.");
    } catch {
      toast.error("Não foi possível atualizar o status.");
    }
  };

  const copyEditorKit = async () => {
    try {
      await navigator.clipboard.writeText(editorKit);
      toast.success("Kit do editor copiado.");
    } catch {
      toast.error("Não foi possível copiar o kit.");
    }
  };

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadReelFinalVideoAsset({
        userId,
        projectId,
        outputId,
        file,
        displayOrder: finalVideos.length,
      });
      await patchMeta({ status: "final_video_attached" });
      toast.success("Vídeo final anexado.");
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível anexar o vídeo final.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async (asset: PieceAsset) => {
    try {
      const url = await getSignedUrl(asset.storage_path, 600);
      const link = document.createElement("a");
      link.href = url;
      link.download = asset.file_name;
      link.target = "_blank";
      link.click();
    } catch {
      toast.error("Não foi possível baixar o arquivo.");
    }
  };

  const approveLatest = async () => {
    if (!latestVideo) return;
    try {
      const nextApproved = !latestVideo.is_approved;
      await toggleApproval(latestVideo.id, nextApproved);
      await patchMeta({ status: nextApproved ? "ready_to_publish" : "final_video_attached" });
      toast.success(nextApproved ? "Vídeo marcado como pronto para publicar." : "Aprovação do vídeo removida.");
      onChange();
    } catch {
      toast.error("Não foi possível atualizar o vídeo final.");
    }
  };

  const remove = async (asset: PieceAsset) => {
    if (!confirm(`Excluir “${asset.file_name}”?`)) return;
    try {
      await deletePieceAsset(asset);
      const remaining = finalVideos.filter((item) => item.id !== asset.id);
      await patchMeta({ status: remaining.length ? "final_video_attached" : "editing" });
      toast.success("Vídeo excluído.");
      onChange();
    } catch {
      toast.error("Não foi possível excluir o vídeo.");
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Produção final do Reel</h2>
        <p className="text-sm text-muted-foreground">
          Use esta área depois do roteiro/storyboard para gravar, editar, anexar o vídeo final e revisar antes de publicar.
        </p>
      </div>

      <Card className="border-violet-500/25 bg-violet-500/5">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-semibold">Linha de produção</p>
              <p className="text-xs text-muted-foreground">Atualize o status conforme o Reel avança na produção.</p>
            </div>
            <Select value={meta.status} onValueChange={(value) => changeStatus(value as Reel2ProductionStatus)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REEL2_PRODUCTION_FLOW.map((status) => (
                  <SelectItem key={status} value={status}>{REEL2_PRODUCTION_STATUS_LABEL[status]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {REEL2_PRODUCTION_FLOW.map((status) => {
              const activeIndex = REEL2_PRODUCTION_FLOW.indexOf(meta.status);
              const currentIndex = REEL2_PRODUCTION_FLOW.indexOf(status);
              const done = currentIndex <= activeIndex;
              return (
                <div key={status} className={done ? "rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-xs" : "rounded-xl border bg-background p-3 text-xs text-muted-foreground"}>
                  <div className="mb-1 flex items-center gap-1.5">
                    {done ? <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" /> : <span className="h-3.5 w-3.5 rounded-full border" />}
                    <span className="font-semibold">{REEL2_PRODUCTION_STATUS_LABEL[status]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-orange-500" /> Checklist de gravação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recordingChecklist.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 text-sm">
                <Checkbox checked={meta.recording_checked.includes(item.id)} onCheckedChange={() => toggleRecording(item.id)} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  {item.helper && <span className="mt-0.5 block text-xs text-muted-foreground">{item.helper}</span>}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Edit3 className="h-4 w-4 text-violet-500" /> Kit do editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pacote copiável para CapCut, Canva, editor de vídeo ou para enviar a quem vai editar.
            </p>
            <Button size="sm" onClick={copyEditorKit}>
              <Copy className="mr-1.5 h-4 w-4" /> Copiar kit do editor
            </Button>
            <Textarea readOnly value={editorKit} className="min-h-[420px] font-mono text-xs" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-orange-500/25">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileVideo className="h-4 w-4 text-orange-500" /> Vídeo final
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Anexe o MP4, MOV ou WebM final quando a edição terminar.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                {latestVideo ? "Anexar nova versão" : "Anexar vídeo final"}
              </Button>
              <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" hidden onChange={(event) => upload(event.target.files)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestVideo ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{latestVideo.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(latestVideo.file_size)} · {formatDate(latestVideo.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {urls[latestVideo.id] && (
                    <Button asChild size="sm" variant="outline">
                      <a href={urls[latestVideo.id]} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => download(latestVideo)}>
                    <Download className="mr-1.5 h-4 w-4" /> Baixar
                  </Button>
                  <Button size="sm" variant="outline" onClick={approveLatest}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    {latestVideo.is_approved ? "Remover pronto" : "Pronto para publicar"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(latestVideo)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
                  </Button>
                </div>
              </div>
              {urls[latestVideo.id] ? (
                <video src={urls[latestVideo.id]} controls className="max-h-[620px] w-full rounded-xl bg-black" />
              ) : (
                <div className="grid min-h-48 place-items-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
                  Não foi possível carregar a prévia do vídeo.
                </div>
              )}
            </div>
          ) : (
            <div className="grid min-h-36 place-items-center rounded-xl border border-dashed bg-muted/10 p-6 text-center">
              <div>
                <PlayCircle className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
                <p className="text-sm font-medium">Nenhum vídeo final anexado</p>
                <p className="mt-1 text-xs text-muted-foreground">Quando a edição terminar, suba o vídeo aqui para revisão final e aprovação.</p>
              </div>
            </div>
          )}

          {finalVideos.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico de vídeos</p>
              {finalVideos.map((asset, index) => (
                <div key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">Versão {index + 1} · {asset.file_name}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(asset.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Revisão antes de publicar
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {reviewChecklist.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3 text-sm">
              <Checkbox checked={meta.review_checked.includes(item.id)} onCheckedChange={() => toggleReview(item.id)} className="mt-0.5" />
              <span>
                <span className="block font-medium">{item.label}</span>
                {item.helper && <span className="mt-0.5 block text-xs text-muted-foreground">{item.helper}</span>}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
