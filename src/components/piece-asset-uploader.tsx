// Componente de upload de arte final para uma peça específica.
// Mostra preview, ações (substituir, baixar, excluir, aprovar) e suporta upload em lote.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Trash2, Download, CheckCircle2, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  uploadPieceAsset,
  deletePieceAsset,
  getSignedUrl,
  toggleApproval,
  type PieceAsset,
} from "@/lib/pieceAssets";

interface Props {
  userId: string;
  projectId: string;
  outputId: string;
  assets: PieceAsset[];
  /** Quando true, oferece upload múltiplo (carrosséis). */
  multiple?: boolean;
  onChange: () => void;
}

export function PieceAssetUploader({ userId, projectId, outputId, assets, multiple, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const a of assets) {
        try {
          map[a.id] = await getSignedUrl(a.storage_path, 1800);
        } catch {
          // ignore
        }
      }
      if (!cancelled) setPreviews(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [assets]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      let order = assets.length;
      for (const f of sorted) {
        await uploadPieceAsset({ userId, projectId, outputId, file: f, displayOrder: order++ });
      }
      toast.success(sorted.length === 1 ? "Arte anexada." : `${sorted.length} artes anexadas.`);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (asset: PieceAsset) => {
    if (!confirm("Excluir esta arte?")) return;
    try {
      await deletePieceAsset(asset);
      toast.success("Arte excluída.");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  };

  const handleApprove = async (asset: PieceAsset) => {
    try {
      await toggleApproval(asset.id, !asset.is_approved);
      onChange();
    } catch {
      toast.error("Não foi possível atualizar aprovação.");
    }
  };

  const handleDownload = async (asset: PieceAsset) => {
    try {
      const url = await getSignedUrl(asset.storage_path, 600);
      const a = document.createElement("a");
      a.href = url;
      a.download = asset.file_name;
      a.target = "_blank";
      a.click();
    } catch {
      toast.error("Não foi possível baixar.");
    }
  };

  return (
    <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" /> Arte final
          {assets.length > 0 && <Badge variant="secondary" className="text-[10px]">{assets.length}</Badge>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="mr-1 h-3.5 w-3.5" />
            {assets.length === 0 ? "Anexar arte final" : multiple ? "Adicionar mais" : "Substituir"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          multiple={multiple}
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {assets.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          Nenhuma arte anexada. Faça o upload do PNG / JPG / WebP final para incluir no PDF do cliente.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {assets.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-md border border-border/50 bg-background">
              {previews[a.id] ? (
                <img
                  src={previews[a.id]}
                  alt={a.file_name}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center bg-muted text-xs text-muted-foreground">
                  carregando…
                </div>
              )}
              {a.is_approved && (
                <Badge className="absolute left-1 top-1 bg-green-600 text-[10px]">aprovada</Badge>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/60 p-1 opacity-0 transition group-hover:opacity-100">
                {previews[a.id] && (
                  <Button asChild size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20">
                    <a href={previews[a.id]} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5" /></a>
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => handleDownload(a)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => handleApprove(a)} title={a.is_approved ? "Desaprovar" : "Aprovar"}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => fileRef.current?.click()} title="Substituir / adicionar">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-red-500/40" onClick={() => handleDelete(a)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="truncate px-1 py-0.5 text-[10px] text-muted-foreground" title={a.file_name}>{a.file_name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
