import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  deletePieceAsset,
  getSignedUrl,
  toggleApproval,
  uploadReelScriptVisualAsset,
  type PieceAsset,
} from "@/lib/pieceAssets";
import type { ReelScript } from "@/lib/reelScript";
import {
  attachReelScriptVisualMeta,
  buildReelScriptVisualPrompt,
  getStoredReelScriptVisualMeta,
  type ReelScriptVisualMeta,
  type ReelScriptVisualStatus,
} from "@/lib/reelScriptVisual";

interface Props {
  userId: string;
  projectId: string;
  projectTitle: string;
  outputId: string;
  outputImportedContent: unknown;
  script: ReelScript;
  scriptVersion: number;
  brand: Tables<"brands"> | null;
  assets: PieceAsset[];
  onChange: () => void;
}

const STATUS_LABEL: Record<ReelScriptVisualStatus, string> = {
  not_requested: "Ainda não solicitado",
  prompt_ready: "Pedido pronto",
  sent_to_chatgpt: "Enviado ao ChatGPT",
  waiting_upload: "Aguardando arquivo",
  uploaded: "Arquivo anexado",
  approved: "Visual aprovado",
  needs_revision: "Precisa de nova versão",
};

const STATUS_CLASS: Record<ReelScriptVisualStatus, string> = {
  not_requested: "border-border text-muted-foreground",
  prompt_ready: "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  sent_to_chatgpt: "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  waiting_upload: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  uploaded: "border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  needs_revision: "border-destructive/40 bg-destructive/10 text-destructive",
};

function isVisualFile(asset: PieceAsset): boolean {
  return asset.file_type === "application/pdf" || asset.file_type.startsWith("image/");
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ReelScriptVisualPanel({
  userId,
  projectId,
  projectTitle,
  outputId,
  outputImportedContent,
  script,
  scriptVersion,
  brand,
  assets,
  onChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const prompt = useMemo(
    () => buildReelScriptVisualPrompt({ script, brand, projectTitle }),
    [script, brand, projectTitle],
  );
  const [meta, setMeta] = useState<ReelScriptVisualMeta>(() =>
    getStoredReelScriptVisualMeta(outputImportedContent),
  );

  useEffect(() => {
    setMeta(getStoredReelScriptVisualMeta(outputImportedContent));
  }, [outputImportedContent]);
  const visualAssets = useMemo(
    () =>
      assets
        .filter(isVisualFile)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [assets],
  );
  const latest = visualAssets.at(-1) ?? null;
  const stale = !!latest && meta.script_version !== scriptVersion;
  const effectiveStatus: ReelScriptVisualStatus = stale
    ? "needs_revision"
    : latest?.is_approved
      ? "approved"
      : latest
        ? "uploaded"
        : meta.status === "not_requested"
          ? "prompt_ready"
          : meta.status;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const asset of visualAssets) {
        try {
          next[asset.id] = await getSignedUrl(asset.storage_path, 1800);
        } catch {
          // Mantém o card sem preview quando a URL não puder ser gerada.
        }
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [visualAssets]);

  const persistMeta = async (patch: Partial<ReelScriptVisualMeta>) => {
    const nextMeta: ReelScriptVisualMeta = { ...meta, ...patch };
    const { error } = await supabase
      .from("content_outputs")
      .update({ imported_content: attachReelScriptVisualMeta(script, nextMeta) })
      .eq("id", outputId);
    if (error) throw error;
    setMeta(nextMeta);
  };

  const preparePrompt = async () => {
    setShowPrompt(true);
    if (!meta.generated_at) {
      try {
        await persistMeta({
          status: "prompt_ready",
          generated_at: new Date().toISOString(),
          prompt_version: 1,
        });
        onChange();
      } catch {
        // A geração do texto é local; falha de metadado não deve impedir o uso.
      }
    }
  };

  const copyPrompt = async (openChatGPT = false) => {
    const chatWindow = openChatGPT
      ? window.open("https://chat.openai.com/", "_blank", "noopener,noreferrer")
      : null;
    try {
      await navigator.clipboard.writeText(prompt);
      await persistMeta({
        status: openChatGPT ? "sent_to_chatgpt" : "waiting_upload",
        generated_at: meta.generated_at ?? new Date().toISOString(),
        copied_at: new Date().toISOString(),
      });
      toast.success(openChatGPT ? "Pedido copiado. Cole no ChatGPT." : "Pedido visual copiado.");
      onChange();
      chatWindow?.focus();
    } catch (error) {
      chatWindow?.close();
      toast.error(error instanceof Error ? error.message : "Não foi possível copiar o pedido.");
    }
  };

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadReelScriptVisualAsset({
        userId,
        projectId,
        outputId,
        file,
        displayOrder: visualAssets.length,
      });
      await persistMeta({
        status: "uploaded",
        visual_version: visualAssets.length + 1,
        last_uploaded_at: new Date().toISOString(),
        approved_at: null,
        script_version: scriptVersion,
      });
      toast.success(`Visual do roteiro anexado como versão ${visualAssets.length + 1}.`);
      onChange();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível anexar o visual.");
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
    if (!latest) return;
    try {
      const nextApproved = !latest.is_approved;
      await toggleApproval(latest.id, nextApproved);
      await persistMeta({
        status: nextApproved ? "approved" : "uploaded",
        approved_at: nextApproved ? new Date().toISOString() : null,
        script_version: scriptVersion,
      });
      toast.success(nextApproved ? "Visual aprovado." : "Aprovação removida.");
      onChange();
    } catch {
      toast.error("Não foi possível atualizar a aprovação.");
    }
  };

  const remove = async (asset: PieceAsset) => {
    if (!confirm(`Excluir “${asset.file_name}”?`)) return;
    try {
      await deletePieceAsset(asset);
      const remaining = visualAssets.filter((item) => item.id !== asset.id);
      await persistMeta({
        status: remaining.length ? "uploaded" : "prompt_ready",
        visual_version: remaining.length,
        approved_at: null,
        script_version: remaining.length ? meta.script_version : null,
      });
      toast.success("Versão excluída.");
      onChange();
    } catch {
      toast.error("Não foi possível excluir o arquivo.");
    }
  };

  return (
    <Card className="border-violet-500/30">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">Visual do roteiro</h3>
              <Badge variant="outline" className={STATUS_CLASS[effectiveStatus]}>
                {STATUS_LABEL[effectiveStatus]}
              </Badge>
              {visualAssets.length > 0 && (
                <Badge variant="secondary">Versão {visualAssets.length}</Badge>
              )}
            </div>
            <p className="max-w-2xl text-xs text-muted-foreground">
              Gere no ChatGPT um PDF visual de storyboard, anexe o resultado e mantenha o histórico
              de versões junto ao Reel. A versão mais recente também será exibida no link de
              aprovação para conferência do cliente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={preparePrompt}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              {showPrompt ? "Ver pedido visual" : "Criar pedido visual"}
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              {latest ? "Anexar nova versão" : "Anexar resultado"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
              hidden
              onChange={(event) => upload(event.target.files)}
            />
          </div>
        </div>

        {stale && (
          <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              O roteiro foi alterado depois da criação deste visual. Gere o pedido novamente e anexe
              uma nova versão antes de usar o arquivo na produção.
            </p>
          </div>
        )}

        {showPrompt && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Pedido para criar o storyboard no ChatGPT</p>
                <p className="text-xs text-muted-foreground">
                  O logo não é enviado automaticamente. Anexe o arquivo oficial na mesma conversa
                  antes de solicitar o PDF.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copyPrompt(false)}>
                  <Copy className="mr-1.5 h-4 w-4" /> Copiar pedido
                </Button>
                <Button size="sm" onClick={() => copyPrompt(true)}>
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir ChatGPT
                </Button>
              </div>
            </div>
            <Textarea readOnly value={prompt} className="min-h-[300px] font-mono text-xs" />
          </div>
        )}

        {latest ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Versão atual</p>
              <div className="flex flex-wrap gap-2">
                {urls[latest.id] && (
                  <Button asChild size="sm" variant="outline">
                    <a href={urls[latest.id]} target="_blank" rel="noopener noreferrer">
                      <Eye className="mr-1.5 h-4 w-4" /> Visualizar
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => download(latest)}>
                  <Download className="mr-1.5 h-4 w-4" /> Baixar
                </Button>
                <Button size="sm" variant="outline" onClick={approveLatest} disabled={stale}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {latest.is_approved ? "Desaprovar" : "Aprovar visual"}
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border bg-background">
              {urls[latest.id] ? (
                latest.file_type === "application/pdf" ? (
                  <iframe
                    title="Visual do roteiro"
                    src={urls[latest.id]}
                    className="h-[520px] w-full bg-white"
                  />
                ) : (
                  <img
                    src={urls[latest.id]}
                    alt={latest.file_name}
                    className="max-h-[620px] w-full object-contain"
                  />
                )
              ) : (
                <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
                  Não foi possível carregar a prévia.
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{latest.file_name}</span>
                <span>{formatDate(latest.created_at)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-32 place-items-center rounded-md border border-dashed bg-muted/10 p-6 text-center">
            <div>
              <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhum visual anexado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Crie o pedido, gere o PDF no ChatGPT e anexe o resultado aqui.
              </p>
            </div>
          </div>
        )}

        {visualAssets.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Histórico de versões
            </p>
            <div className="space-y-2">
              {visualAssets
                .map((asset, index) => ({ asset, version: index + 1 }))
                .reverse()
                .map(({ asset, version }) => (
                  <div
                    key={asset.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        Versão {version} · {asset.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(asset.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {urls[asset.id] && (
                        <Button asChild size="icon" variant="ghost" title="Abrir">
                          <a href={urls[asset.id]} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => download(asset)}
                        title="Baixar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => fileRef.current?.click()}
                        title="Anexar nova versão"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove(asset)}
                        title="Excluir versão"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
