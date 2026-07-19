import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, FileJson2, Info, WandSparkles, AlertCircle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import {
  brandJsonFieldLabels,
  buildBrandJsonPrompt,
  parseBrandJsonImport,
  type BrandJsonFieldKey,
  type BrandJsonImportResult,
  type BrandJsonProfile,
} from "@/lib/brandJson";
import type { BrandFormValues } from "@/components/brand-form";

interface BrandJsonAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: BrandFormValues;
  onApply: (values: Partial<BrandJsonProfile>, options: { overwriteFilled: boolean }) => void;
}

export function BrandJsonAssistantDialog({ open, onOpenChange, values, onApply }: BrandJsonAssistantDialogProps) {
  const [context, setContext] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [result, setResult] = useState<BrandJsonImportResult | null>(null);
  const [overwriteFilled, setOverwriteFilled] = useState(false);

  const prompt = useMemo(
    () => buildBrandJsonPrompt({ currentValues: values, extraContext: context }),
    [context, values],
  );

  const reset = () => {
    setContext("");
    setRawJson("");
    setResult(null);
    setOverwriteFilled(false);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const validate = () => {
    setResult(parseBrandJsonImport(rawJson));
  };

  const apply = () => {
    if (!result?.ok || !result.values) return;
    onApply(result.values, { overwriteFilled });
    handleOpenChange(false);
  };

  const openChatGpt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {}
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5 text-primary" /> Preencher cadastro com ChatGPT
          </DialogTitle>
          <DialogDescription>
            Copie o pedido, anexe o logo em uma conversa do ChatGPT e depois cole o JSON devolvido aqui. O Cria Aí não envia dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section className="space-y-3 rounded-lg border border-border/70 p-4">
            <div>
              <h3 className="font-semibold">1. Preparar pedido</h3>
              <p className="text-sm text-muted-foreground">
                O logo salvo no Cria Aí é privado. Para o ChatGPT analisar, anexe o arquivo manualmente na conversa externa.
              </p>
            </div>

            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Se você tiver informações do cliente além do logo, coloque abaixo. Ex.: segmento, público, serviços, região, tom desejado ou restrições.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Contexto opcional</Label>
              <Textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                rows={5}
                placeholder="Ex.: clínica veterinária em Osasco, foco em comportamento canino, atendimento acolhedor, evitar promessas de resultado..."
              />
            </div>

            <div className="space-y-2">
              <Label>Pedido que será enviado ao ChatGPT</Label>
              <Textarea value={prompt} readOnly rows={16} className="font-mono text-xs" />
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyButton text={prompt} label="Copiar pedido" />
              <Button type="button" variant="secondary" size="sm" onClick={openChatGpt} className="gap-2">
                <ExternalLink className="h-4 w-4" /> Abrir ChatGPT
              </Button>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border/70 p-4">
            <div>
              <h3 className="font-semibold">2. Importar JSON</h3>
              <p className="text-sm text-muted-foreground">
                Cole o JSON gerado pelo ChatGPT. Você poderá aplicar só campos vazios ou sobrescrever dados atuais.
              </p>
            </div>

            <Textarea
              value={rawJson}
              onChange={(event) => {
                setRawJson(event.target.value);
                setResult(null);
              }}
              rows={14}
              placeholder='Cole aqui o JSON com campos como "name", "segment", "primary_color"...'
              className="font-mono text-xs"
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={validate} className="gap-2">
                <FileJson2 className="h-4 w-4" /> Validar JSON
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={overwriteFilled}
                  onCheckedChange={(checked) => setOverwriteFilled(checked === true)}
                />
                Sobrescrever campos já preenchidos
              </label>
            </div>

            {result && (
              <ImportResultPreview result={result} />
            )}
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!result?.ok || !result.values} onClick={apply}>
            Aplicar ao cadastro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportResultPreview({ result }: { result: BrandJsonImportResult }) {
  if (!result.ok) {
    return (
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
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4" /> JSON validado
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{result.filledFields.length} campos úteis</Badge>
        {(result.values?.assumptions?.length ?? 0) > 0 && <Badge variant="outline">Hipóteses informadas</Badge>}
        {(result.values?.missing_information?.length ?? 0) > 0 && <Badge variant="outline">Faltam confirmações</Badge>}
      </div>

      {result.filledFields.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campos encontrados</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.filledFields.map((field) => (
              <Badge key={field} variant="secondary" className="text-xs">
                {brandJsonFieldLabels[field as BrandJsonFieldKey]}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-background/50 p-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Avisos</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {result.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {(result.values?.missing_information?.length ?? 0) > 0 && (
        <div className="rounded-md border border-border/60 bg-background/50 p-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Informações a confirmar depois</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {result.values?.missing_information?.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
