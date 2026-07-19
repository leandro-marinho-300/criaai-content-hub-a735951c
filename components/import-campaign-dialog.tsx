// Import dialog para colar JSON do ChatGPT, validar e aplicar à campanha/peças.
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check } from "lucide-react";
import { parseCampaignJSON } from "@/lib/externalPrompt";
import type { CampaignFields, ImportedCampaignContent, ImportedPiece } from "@/lib/campaignDevelopment";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Conteúdo atual da campanha (para prévia lado a lado). */
  currentCampaign?: CampaignFields;
  currentPieces?: ImportedPiece[];
  /** Campos editados manualmente — vêm desmarcados por padrão com aviso. */
  manuallyEditedKeys?: Array<keyof CampaignFields>;
  onApply: (selection: {
    campaign: Partial<CampaignFields>;
    pieces: ImportedPiece[];
    caption?: ImportedCampaignContent["caption"];
    full: ImportedCampaignContent;
  }) => void;
}

const CAMPAIGN_FIELDS: Array<{ key: keyof CampaignFields; label: string }> = [
  { key: "angle", label: "Ângulo" },
  { key: "central_message", label: "Mensagem central" },
  { key: "main_promise", label: "Promessa" },
  { key: "main_pain", label: "Dor principal" },
  { key: "main_benefit", label: "Benefício" },
  { key: "main_cta", label: "CTA principal" },
  { key: "cta_strategy", label: "Estratégia de CTA" },
  { key: "narrative_structure", label: "Estrutura narrativa" },
  { key: "visual_focus", label: "Foco visual" },
  { key: "commercial_intensity", label: "Intensidade comercial" },
];

export function ImportCampaignDialog({
  open,
  onOpenChange,
  currentCampaign,
  currentPieces,
  manuallyEditedKeys,
  onApply,
}: Props) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ImportedCampaignContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fieldSel, setFieldSel] = useState<Record<string, boolean>>({});
  const [pieceSel, setPieceSel] = useState<Record<number, boolean>>({});

  const editedSet = useMemo(() => new Set((manuallyEditedKeys ?? []) as string[]), [manuallyEditedKeys]);

  const handleValidate = () => {
    setError(null);
    const r = parseCampaignJSON(raw);
    if (!r.ok || !r.content) {
      setParsed(null);
      setError(r.error ?? "Não foi possível interpretar o JSON.");
      return;
    }
    setParsed(r.content);
    const fs: Record<string, boolean> = {};
    CAMPAIGN_FIELDS.forEach(({ key }) => {
      const has = !!(r.content!.campaign as Record<string, unknown>)?.[key as string];
      fs[key as string] = has && !editedSet.has(key as string);
    });
    setFieldSel(fs);
    const ps: Record<number, boolean> = {};
    (r.content.pieces ?? []).forEach((_, i) => (ps[i] = true));
    setPieceSel(ps);
  };

  const handleClear = () => {
    setRaw("");
    setParsed(null);
    setError(null);
  };

  const handleApplyAll = (all: boolean) => {
    if (!parsed) return;
    const camp: Partial<CampaignFields> = {};
    CAMPAIGN_FIELDS.forEach(({ key }) => {
      if ((all || fieldSel[key as string]) && (parsed.campaign as Record<string, unknown>)?.[key as string]) {
        (camp as Record<string, unknown>)[key as string] = (parsed.campaign as Record<string, unknown>)[key as string];
      }
    });
    // arrays
    (["audience_desires", "key_points", "selected_differentiators", "terms_to_avoid"] as const).forEach((k) => {
      const v = parsed.campaign?.[k];
      if (v && v.length && (all || fieldSel[k])) (camp as Record<string, unknown>)[k] = v;
    });
    const pcs = (parsed.pieces ?? []).filter((_, i) => all || pieceSel[i]);
    onApply({ campaign: camp, pieces: pcs, caption: parsed.caption, full: parsed });
    onOpenChange(false);
    handleClear();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar resposta do ChatGPT</DialogTitle>
          <DialogDescription>
            Cole o JSON devolvido pelo ChatGPT. Você pode escolher o que aplicar antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {!parsed && (
          <div className="space-y-3">
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='Cole aqui o JSON (ou um bloco ```json ... ```)'
              className="min-h-[260px] font-mono text-xs"
            />
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClear}>Limpar</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleValidate} disabled={!raw.trim()}>Validar</Button>
            </div>
          </div>
        )}

        {parsed && (
          <div className="space-y-4">
            <section className="rounded-md border border-border/60 bg-card/60 p-3">
              <h3 className="mb-2 text-sm font-semibold">Campos da campanha</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {CAMPAIGN_FIELDS.map(({ key, label }) => {
                  const val = (parsed.campaign as Record<string, unknown>)?.[key as string] as string | undefined;
                  if (!val) return null;
                  const current = (currentCampaign as Record<string, unknown> | undefined)?.[key as string] as string | undefined;
                  const isEdited = editedSet.has(key as string);
                  return (
                    <label key={key as string} className="flex items-start gap-2 rounded border border-border/50 p-2 text-xs">
                      <Checkbox
                        checked={!!fieldSel[key as string]}
                        onCheckedChange={(v) => setFieldSel((s) => ({ ...s, [key as string]: !!v }))}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{label}</span>
                          {isEdited && <Badge variant="outline" className="text-[10px]">edição manual</Badge>}
                        </div>
                        {current && <div className="mt-1 text-muted-foreground line-through">{current}</div>}
                        <div className="mt-1">{val}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            {parsed.pieces && parsed.pieces.length > 0 && (
              <section className="rounded-md border border-border/60 bg-card/60 p-3">
                <h3 className="mb-2 text-sm font-semibold">Peças propostas ({parsed.pieces.length})</h3>
                <div className="space-y-2">
                  {parsed.pieces.map((p, i) => {
                    const cur = currentPieces?.[i];
                    return (
                      <label key={i} className="flex items-start gap-2 rounded border border-border/50 p-2 text-xs">
                        <Checkbox
                          checked={!!pieceSel[i]}
                          onCheckedChange={(v) => setPieceSel((s) => ({ ...s, [i]: !!v }))}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{p.format ?? "—"}</Badge>
                            {p.role && <span className="text-muted-foreground">{p.role}</span>}
                            {p.id && <span className="text-muted-foreground">· {p.id}</span>}
                          </div>
                          {cur?.headline && <div className="mt-1 text-muted-foreground line-through">{cur.headline}</div>}
                          <div className="mt-1 font-medium">{p.headline || "—"}</div>
                          {p.support_text && <div className="mt-0.5 text-muted-foreground">{p.support_text}</div>}
                          {p.cta && <div className="mt-0.5">CTA: <span className="font-medium">{p.cta}</span></div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {parsed.warnings && parsed.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <strong>Avisos do ChatGPT:</strong>
                <ul className="mt-1 list-disc pl-4">{parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="ghost" onClick={handleClear}>Recomeçar</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button variant="secondary" onClick={() => handleApplyAll(false)}>
                <Check className="mr-1 h-4 w-4" /> Aplicar selecionados
              </Button>
              <Button onClick={() => handleApplyAll(true)}>
                <Check className="mr-1 h-4 w-4" /> Aplicar tudo
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
