import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileJson2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseAndValidateReel2Script, type Reel2ImportedScript, type Reel2ImportResult } from "@/lib/reel2Script";

interface ImportReel2ScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (script: Reel2ImportedScript, raw: string, result: Reel2ImportResult) => void;
}

export function ImportReel2ScriptDialog({ open, onOpenChange, onImport }: ImportReel2ScriptDialogProps) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<Reel2ImportResult | null>(null);

  const script = result?.script;
  const summary = useMemo(() => {
    if (!script) return null;
    return {
      hooks: script.hook_options.length,
      scenes: script.main_script.scenes.length,
      duration: script.main_script.duration_seconds,
      shortDuration: script.short_version.duration_seconds,
      hashtags: script.publication.hashtags.length,
      cover: script.cover.needs_cover ? "Com capa" : "Sem capa personalizada",
    };
  }, [script]);

  const validate = () => {
    const parsed = parseAndValidateReel2Script(raw);
    setResult(parsed);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setRaw("");
      setResult(null);
    }
  };

  const confirm = () => {
    if (!result?.script || !result.ok) return;
    onImport(result.script, raw, result);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar JSON Reel 2.0</DialogTitle>
          <DialogDescription>
            Cole o JSON devolvido pelo ChatGPT. O Cria Aí valida o schema, os ganchos, o roteiro por cenas,
            a versão reduzida, a legenda completa do vídeo e o limite de 5 hashtags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              setResult(null);
            }}
            placeholder='Cole aqui o JSON com "schema_version": "reel_2_0"'
            rows={14}
            className="font-mono text-xs"
          />

          {result && (
            <div className="space-y-3 rounded-2xl border bg-muted/30 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                {result.ok ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> JSON validado
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Revisar JSON
                  </Badge>
                )}
                {result.normalizedFromLegacy && <Badge variant="secondary">Convertido de roteiro antigo</Badge>}
                {result.sourceSchema && <Badge variant="outline">{result.sourceSchema}</Badge>}
              </div>

              {summary && (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Info label="Ganchos" value={String(summary.hooks)} />
                  <Info label="Cenas" value={`${summary.scenes} · ${summary.duration}s`} />
                  <Info label="Versão curta" value={`${summary.shortDuration}s`} />
                  <Info label="Hashtags" value={`${summary.hashtags}/5`} />
                  <Info label="Capa" value={summary.cover} />
                  <Info label="CTA" value={script?.publication.cta || "—"} />
                </div>
              )}

              {result.errors.length > 0 && (
                <section>
                  <p className="font-medium text-destructive">Erros que precisam ser corrigidos</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {result.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
                  </ul>
                </section>
              )}

              {result.warnings.length > 0 && (
                <section>
                  <p className="font-medium text-amber-600 dark:text-amber-300">Avisos para revisar</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {result.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {result?.script && (
            <Button variant="ghost" onClick={() => setResult(null)}>
              Voltar ao JSON
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          {!result?.script ? (
            <Button onClick={validate} disabled={!raw.trim()}>
              <FileJson2 className="mr-2 h-4 w-4" /> Validar JSON
            </Button>
          ) : (
            <Button onClick={confirm} disabled={!result.ok}>
              <Upload className="mr-2 h-4 w-4" /> Importar roteiro
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
      <p className="mt-1 line-clamp-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
