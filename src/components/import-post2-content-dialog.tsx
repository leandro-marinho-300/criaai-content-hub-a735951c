import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileJson2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  parseAndValidatePost2Content,
  type Post2ContentImportResult,
} from "@/lib/post2Content";
import type { Post2ImportedContent } from "@/lib/post2";

interface ImportPost2ContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    content: Post2ImportedContent,
    raw: string,
    result: Post2ContentImportResult,
  ) => void;
}

export function ImportPost2ContentDialog({
  open,
  onOpenChange,
  onImport,
}: ImportPost2ContentDialogProps) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<Post2ContentImportResult | null>(null);

  const summary = useMemo(() => {
    if (!result?.content) return null;
    return {
      title: result.content.art.title,
      captionLength: result.content.publication.caption.length,
      hashtags: result.content.publication.hashtags.length,
      confirmations: result.content.information_to_confirm.length,
    };
  }, [result]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setRaw("");
      setResult(null);
    }
  };

  const confirm = () => {
    if (!result?.ok || !result.content) return;
    onImport(result.content, raw, result);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar conteúdo do Post 2.0</DialogTitle>
          <DialogDescription>
            Cole o JSON devolvido pelo ChatGPT. O Cria Aí valida título, apoio, CTA, legenda,
            hashtags e direção visual sem cortar nenhum texto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              setResult(null);
            }}
            placeholder='Cole aqui o JSON com "schema_version": "post_2_0"'
            rows={15}
            className="font-mono text-xs"
          />

          {result && (
            <div className="space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {result.ok ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Conteúdo validado
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Revisar JSON
                  </Badge>
                )}
                <Badge variant="outline">post_2_0</Badge>
              </div>

              {summary && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Título" value={summary.title} />
                  <Info label="Legenda" value={`${summary.captionLength} caracteres`} />
                  <Info label="Hashtags" value={`${summary.hashtags}/5`} />
                  <Info label="Confirmações" value={String(summary.confirmations)} />
                </div>
              )}

              {result.errors.length > 0 && (
                <section>
                  <p className="font-medium text-destructive">Erros que precisam ser corrigidos</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {result.errors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </section>
              )}

              {result.warnings.length > 0 && (
                <section>
                  <p className="font-medium text-amber-600 dark:text-amber-300">Avisos para revisar</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {result.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          {!result ? (
            <Button onClick={() => setResult(parseAndValidatePost2Content(raw))} disabled={!raw.trim()}>
              <FileJson2 className="mr-2 h-4 w-4" /> Validar JSON
            </Button>
          ) : (
            <Button onClick={confirm} disabled={!result.ok || !result.content}>
              <Upload className="mr-2 h-4 w-4" /> Importar conteúdo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}
