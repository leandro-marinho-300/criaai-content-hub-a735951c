import { useState } from "react";
import { AlertCircle, CheckCircle2, FileJson2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  parseAndValidateReelScript,
  type ReelScript,
  type ReelScriptExpectations,
  type ReelScriptValidationResult,
} from "@/lib/reelScript";

interface ImportReelScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectations: ReelScriptExpectations;
  hasExistingScript?: boolean;
  onImport: (script: ReelScript, raw: string) => Promise<void> | void;
}

export function ImportReelScriptDialog({
  open,
  onOpenChange,
  expectations,
  hasExistingScript = false,
  onImport,
}: ImportReelScriptDialogProps) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ReelScriptValidationResult | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setRaw("");
    setResult(null);
    setSaving(false);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const validate = () => {
    setResult(parseAndValidateReelScript(raw, expectations));
  };

  const confirm = async () => {
    if (!result?.ok || !result.script) return;
    setSaving(true);
    try {
      await onImport(result.script, raw);
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar roteiro completo</DialogTitle>
          <DialogDescription>
            Cole o JSON devolvido pelo ChatGPT. O Cria Aí valida duração, cenas, pontos
            obrigatórios, legenda e CTA antes de salvar.
          </DialogDescription>
        </DialogHeader>

        {!result?.script && (
          <div className="space-y-3">
            <Textarea
              value={raw}
              onChange={(event) => {
                setRaw(event.target.value);
                setResult(null);
              }}
              placeholder='Cole aqui o JSON com "schema_version": "reel_script_v1"'
              className="min-h-[360px] font-mono text-xs"
            />
            {result && result.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-destructive">
                  <AlertCircle className="h-4 w-4" /> Não foi possível validar
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {result.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {result?.script && (
          <div className="space-y-4">
            <div
              className={`rounded-md border p-3 ${result.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}
            >
              <p className="flex items-center gap-2 font-semibold">
                {result.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                {result.ok ? "Roteiro validado" : "O roteiro precisa de correções"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{result.script.scenes.length} cenas</Badge>
                <Badge variant="outline">{result.script.overview.duration_seconds}s</Badge>
                <Badge variant="outline">
                  Cobertura: {result.coveredPoints.length} de{" "}
                  {(expectations.requiredPoints ?? []).length}
                </Badge>
                <Badge variant="outline">Fala estimada: {result.estimatedSpeechSeconds}s</Badge>
                <Badge variant="outline">Linha do tempo: {result.durationCoverage}%</Badge>
              </div>
            </div>

            <section className="rounded-md border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <FileJson2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Prévia</h3>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Título</dt>
                  <dd className="font-medium">{result.script.title}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Formato narrativo</dt>
                  <dd>{result.script.overview.narrative_format}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Gancho</dt>
                  <dd>{result.script.hooks.primary}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">CTA</dt>
                  <dd>{result.script.closing.cta}</dd>
                </div>
              </dl>
            </section>

            {result.coveredPoints.length > 0 && (
              <section className="rounded-md border border-border/60 p-3 text-sm">
                <h3 className="font-semibold">Pontos contemplados</h3>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {result.coveredPoints.map((point) => (
                    <li key={point}>✓ {point}</li>
                  ))}
                </ul>
              </section>
            )}

            {result.errors.length > 0 && (
              <section className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <h3 className="font-semibold text-destructive">Erros que impedem a importação</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {result.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </section>
            )}

            {result.warnings.length > 0 && (
              <section className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  Avisos para revisão
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {result.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </section>
            )}

            {hasExistingScript && result.ok && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                Já existe um roteiro importado. A nova importação será salva como uma nova versão no
                mesmo output.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {result?.script && (
            <Button variant="ghost" onClick={() => setResult(null)} disabled={saving}>
              Voltar ao JSON
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          {!result?.script ? (
            <Button onClick={validate} disabled={!raw.trim()}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Validar JSON
            </Button>
          ) : (
            <Button onClick={confirm} disabled={!result.ok || saving}>
              <Upload className="mr-2 h-4 w-4" /> {saving ? "Importando..." : "Importar roteiro"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
