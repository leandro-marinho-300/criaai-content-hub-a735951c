// Diálogo para upload em lote com associação manual das artes às peças.
// O usuário seleciona vários arquivos e arrasta/seleciona em quais peças cada um deve ser anexado.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { extractFileNumber, uploadPieceAsset, validateFile } from "@/lib/pieceAssets";

export interface BatchTargetPiece {
  outputId: string;
  label: string;     // "Página 1 — Capa"
  currentCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  projectId: string;
  pieces: BatchTargetPiece[];
  onComplete: () => void;
}

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  targetOutputId: string | "skip";
  error?: string;
}

export function BatchAssetUploadDialog({ open, onOpenChange, userId, projectId, pieces, onComplete }: Props) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const piecesSorted = useMemo(() => pieces, [pieces]);

  const autoAssign = (files: File[]): QueueItem[] => {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return sorted.map((file, i) => {
      const err = validateFile(file);
      const num = extractFileNumber(file.name);
      let target: string | "skip" = "skip";
      if (num && piecesSorted[num - 1]) target = piecesSorted[num - 1].outputId;
      else if (piecesSorted[i]) target = piecesSorted[i].outputId;
      return {
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
        targetOutputId: target,
        error: err || undefined,
      };
    });
  };

  const handleSelect = (fileList: FileList | null) => {
    if (!fileList) return;
    const next = autoAssign(Array.from(fileList));
    setItems((prev) => [...prev, ...next]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) handleSelect(e.dataTransfer.files);
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const setTarget = (id: string, outputId: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, targetOutputId: outputId } : p)));
  };

  const move = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const confirm = async () => {
    const usable = items.filter((it) => !it.error && it.targetOutputId !== "skip");
    if (!usable.length) {
      toast.error("Selecione pelo menos um arquivo e uma peça.");
      return;
    }
    setBusy(true);
    try {
      // Para cada peça, considera a ordem atual + novos arquivos
      const counters: Record<string, number> = {};
      pieces.forEach((p) => (counters[p.outputId] = p.currentCount));
      for (const it of usable) {
        const order = counters[it.targetOutputId]++;
        await uploadPieceAsset({
          userId, projectId, outputId: it.targetOutputId, file: it.file, displayOrder: order,
        });
      }
      toast.success(`${usable.length} arte(s) enviada(s) e associada(s).`);
      onComplete();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio em lote.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Enviar várias artes</DialogTitle>
          <DialogDescription>
            Selecione ou arraste os arquivos. A associação automática usa números no nome (ex.: pagina-01, slide-2). Você pode trocar manualmente abaixo.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="rounded-md border-2 border-dashed border-border/60 bg-muted/20 p-4 text-center"
        >
          <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Arraste e solte ou clique no botão abaixo.</p>
          <label className="mt-2 inline-block cursor-pointer">
            <input
              type="file"
              hidden
              multiple
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => handleSelect(e.target.files)}
            />
            <span className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted">
              Selecionar arquivos
            </span>
          </label>
        </div>

        {items.length > 0 && (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {items.map((it, idx) => (
              <div key={it.id} className="flex items-center gap-3 rounded-md border border-border/60 p-2">
                <img src={it.previewUrl} alt="" className="h-14 w-14 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={it.file.name}>{it.file.name}</p>
                  {it.error ? (
                    <p className="text-[11px] text-destructive">{it.error}</p>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      <Label className="text-[11px] text-muted-foreground">Associar a:</Label>
                      <select
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                        value={it.targetOutputId}
                        onChange={(e) => setTarget(it.id, e.target.value)}
                      >
                        <option value="skip">— não enviar —</option>
                        {piecesSorted.map((p) => (
                          <option key={p.outputId} value={p.outputId}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(it.id, -1)} disabled={idx === 0}>↑</Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(it.id, 1)} disabled={idx === items.length - 1}>↓</Button>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(it.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={confirm} disabled={busy || items.length === 0}>
            {busy ? "Enviando..." : `Confirmar (${items.filter((i) => !i.error && i.targetOutputId !== "skip").length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
