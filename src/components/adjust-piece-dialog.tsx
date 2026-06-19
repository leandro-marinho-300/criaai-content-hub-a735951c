// Cria Aí — Painel "Ajustar esta peça": editor manual + revisão via ChatGPT externo.
// Sem IA, sem chamadas externas. Só copia/cola.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, RotateCcw, Save, Wand2, X, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildReviewPrompt,
  parseChatGPTRevision,
  EMPTY_GUIDANCE,
  OBJECTIVE_OPTIONS,
  ANGLE_OPTIONS,
  INTENSITY_OPTIONS,
  CTA_OPTIONS,
  type ReviewGuidance,
  type ParsedRevision,
} from "@/lib/reviewPrompt";
import {
  buildReadyPrompt,
  summarizeRestrictions,
  variationByAngle,
  type Brand,
  type Project,
  type Piece,
  type CopyAngle,
} from "@/lib/promptBuilder";
import { checkCopyQuality } from "@/lib/copyQuality";

type Mode = "editor" | "review" | "import" | "preview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  piece: Piece;
  brand: Brand;
  project: Project;
  otherPieces: Piece[];
  initialFocus?: "supportText" | "mainText" | "cta" | "bullets";
  /** Ao salvar uma nova versão da peça (já com readyPrompt regenerado). */
  onSave: (updated: Piece) => Promise<void> | void;
  prohibited?: string[];
}

const MAX_HISTORY = 3;

function pushHistory(p: Piece, source: "manual" | "external_chatgpt" | "deterministic", guidance?: Record<string, unknown>): Piece["revisionHistory"] {
  const entry = {
    date: new Date().toISOString(),
    source,
    mainText: p.mainText,
    supportText: p.supportText,
    bullets: [...p.bullets],
    cta: p.cta,
    angle: p.communicationAngle,
    guidance,
  };
  return [entry, ...(p.revisionHistory ?? [])].slice(0, MAX_HISTORY);
}

function rebuild(piece: Piece, brand: Brand, project: Project): Piece {
  // recheca qualidade do conteúdo atual
  const prohibited = Array.isArray(brand.prohibited_words) ? brand.prohibited_words.filter(Boolean) : [];
  const checks = [
    checkCopyQuality(piece.mainText, { prohibited, isHeadline: true, minLen: 6 }),
    checkCopyQuality(piece.supportText, { prohibited, minLen: 0, maxLen: 600 }),
  ];
  const issues = checks.flatMap((c) => c.issues);
  const status = issues.some((i) => i.severity === "blocked")
    ? "blocked"
    : issues.length
    ? "warning"
    : "approved";
  const updated: Piece = { ...piece, qualityIssues: issues.length ? issues : undefined, qualityStatus: status };
  const ready = buildReadyPrompt({
    piece: updated,
    brand,
    project,
    mode: "safe",
    productionNotes: piece.productionNotes ?? [],
    restrictionsBrief: summarizeRestrictions(brand),
  });
  return { ...updated, readyPrompt: ready };
}

export function AdjustPieceDialog({
  open, onOpenChange, piece, brand, project, otherPieces, initialFocus, onSave, prohibited,
}: Props) {
  const [mode, setMode] = useState<Mode>("editor");
  const [draft, setDraft] = useState<Piece>(piece);
  const [guidance, setGuidance] = useState<ReviewGuidance>(EMPTY_GUIDANCE);
  const [reviewPrompt, setReviewPrompt] = useState<string>("");
  const [pasted, setPasted] = useState<string>("");
  const [parseError, setParseError] = useState<string>("");
  const [variations, setVariations] = useState<ParsedRevision[]>([]);
  const [chosenIdx, setChosenIdx] = useState<number>(0);
  const [chosenEditable, setChosenEditable] = useState<ParsedRevision | null>(null);
  const [saving, setSaving] = useState(false);

  // reset quando abrir com peça nova
  const pieceKey = `${piece.index}-${piece.name}`;
  useMemo(() => {
    setDraft(piece);
    setMode("editor");
    setGuidance(EMPTY_GUIDANCE);
    setReviewPrompt("");
    setPasted("");
    setParseError("");
    setVariations([]);
    setChosenIdx(0);
    setChosenEditable(null);
  }, [pieceKey]);

  const focusHint =
    initialFocus === "supportText" ? "Texto de apoio destacado abaixo."
    : initialFocus === "mainText" ? "Texto principal destacado abaixo."
    : initialFocus === "cta" ? "CTA destacado abaixo."
    : initialFocus === "bullets" ? "Bullets destacados abaixo."
    : "";

  const persist = async (next: Piece, source: "manual" | "external_chatgpt") => {
    setSaving(true);
    try {
      const withHistory: Piece = { ...next, copySource: source, revisionHistory: pushHistory(draft, source, source === "external_chatgpt" ? guidance as unknown as Record<string, unknown> : undefined) };
      const rebuilt = rebuild(withHistory, brand, project);
      await onSave(rebuilt);
      setDraft(rebuilt);
      toast.success(source === "external_chatgpt" ? "Revisão importada e prompt atualizado." : "Peça salva.");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const saveManual = () => persist(draft, "manual");

  const restorePrev = () => {
    const prev = draft.revisionHistory?.[0];
    if (!prev) return toast.info("Não há versão anterior salva.");
    const restored: Piece = {
      ...draft,
      mainText: prev.mainText,
      supportText: prev.supportText,
      bullets: prev.bullets,
      cta: prev.cta,
      communicationAngle: (prev.angle as CopyAngle) ?? draft.communicationAngle,
      revisionHistory: draft.revisionHistory?.slice(1),
    };
    setDraft(restored);
    toast.success("Versão anterior restaurada na edição. Salve para confirmar.");
  };

  const [autoIdx, setAutoIdx] = useState(0);
  const autoVariation = () => {
    const heads = draft.headlineOptions ?? [];
    const supports = draft.supportTextOptions ?? [];
    if (heads.length <= 1 && supports.length <= 1) {
      toast.info("Sem variações automáticas disponíveis. Enriqueça o briefing ou use a revisão no ChatGPT.");
      return;
    }
    const next = autoIdx + 1;
    setAutoIdx(next);
    setDraft({
      ...draft,
      mainText: heads.length ? heads[next % heads.length] : draft.mainText,
      supportText: supports.length ? supports[next % Math.max(supports.length, 1)] : draft.supportText,
    });
    toast.success("Variação automática aplicada (modelos internos, sem IA). Revise antes de salvar.");
  };

  const prepareReview = () => {
    const prompt = buildReviewPrompt({ piece: draft, brand, project, otherPieces, guidance });
    setReviewPrompt(prompt);
    setMode("review");
  };

  const copyReview = async (openExternal: boolean) => {
    try {
      await navigator.clipboard.writeText(reviewPrompt);
      toast.success(openExternal ? "Pedido copiado. Cole no ChatGPT e envie." : "Pedido de revisão copiado.");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
    if (openExternal) window.open("https://chat.openai.com/", "_blank", "noopener,noreferrer");
  };

  const validatePaste = () => {
    setParseError("");
    const r = parseChatGPTRevision(pasted);
    if (!r.ok) {
      setParseError(r.error);
      setVariations([]);
      return;
    }
    setVariations(r.variations);
    setChosenIdx(0);
    setChosenEditable(r.variations[0]);
    setMode("preview");
  };

  const applyChosen = async () => {
    const chosen = chosenEditable ?? variations[chosenIdx];
    if (!chosen) return;
    const next: Piece = {
      ...draft,
      mainText: chosen.headline || draft.mainText,
      supportText: chosen.support_text,
      bullets: chosen.bullets,
      cta: chosen.cta,
      communicationAngle: (chosen.angle as CopyAngle) || draft.communicationAngle,
    };
    await persist(next, "external_chatgpt");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ajustar esta peça — {piece.name}
          </DialogTitle>
          <DialogDescription>
            Edite manualmente, peça uma revisão ao ChatGPT (copia/cola, sem API) ou importe uma resposta colada.
            {focusHint && <span className="ml-1 font-medium text-foreground">{focusHint}</span>}
          </DialogDescription>
        </DialogHeader>

        {mode === "editor" && (
          <div className="space-y-5">
            {/* Avisos atuais */}
            {draft.qualityIssues && draft.qualityIssues.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />Avisos atuais
                </p>
                <ul className="ml-5 list-disc space-y-0.5">
                  {draft.qualityIssues.map((q, i) => <li key={i}>{q.message}</li>)}
                </ul>
              </div>
            )}

            <div className="grid gap-3">
              <div data-focus={initialFocus === "mainText"} className={initialFocus === "mainText" ? "rounded-md ring-2 ring-primary/40 p-2 -m-2" : ""}>
                <Label>Headline / Texto principal</Label>
                <Input value={draft.mainText} onChange={(e) => setDraft({ ...draft, mainText: e.target.value })} />
              </div>
              <div data-focus={initialFocus === "supportText"} className={initialFocus === "supportText" ? "rounded-md ring-2 ring-primary/40 p-2 -m-2" : ""}>
                <Label>Texto de apoio</Label>
                <Textarea rows={3} value={draft.supportText} onChange={(e) => setDraft({ ...draft, supportText: e.target.value })} />
              </div>
              <div data-focus={initialFocus === "bullets"} className={initialFocus === "bullets" ? "rounded-md ring-2 ring-primary/40 p-2 -m-2" : ""}>
                <Label>Bullets (um por linha)</Label>
                <Textarea
                  rows={3}
                  value={(draft.bullets ?? []).join("\n")}
                  onChange={(e) => setDraft({ ...draft, bullets: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div data-focus={initialFocus === "cta"} className={initialFocus === "cta" ? "rounded-md ring-2 ring-primary/40 p-2 -m-2" : ""}>
                <Label>CTA</Label>
                <Input value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} />
              </div>
            </div>

            {prohibited && prohibited.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Palavras proibidas:</span> {prohibited.slice(0, 10).join(", ")}
              </p>
            )}

            {/* Orientações para revisão */}
            <details className="rounded-lg border border-border/60 p-3" open>
              <summary className="cursor-pointer text-sm font-semibold">Orientações para revisão</summary>
              <div className="mt-3 grid gap-3">
                <div>
                  <Label>O que deve ser destacado?</Label>
                  <Textarea rows={2} value={guidance.highlight} onChange={(e) => setGuidance({ ...guidance, highlight: e.target.value })}
                    placeholder="Ex.: Destinos nacionais com natureza, descanso e cultura." />
                </div>
                <div>
                  <Label>O que deve ser evitado?</Label>
                  <Textarea rows={2} value={guidance.avoid} onChange={(e) => setGuidance({ ...guidance, avoid: e.target.value })}
                    placeholder="Ex.: Não mencionar atendimento humano, suporte ou orçamento." />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Objetivo desta peça</Label>
                    <Select value={guidance.objective} onValueChange={(v) => setGuidance({ ...guidance, objective: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OBJECTIVE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ângulo desejado</Label>
                    <Select value={guidance.angle} onValueChange={(v) => setGuidance({ ...guidance, angle: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ANGLE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Intensidade comercial</Label>
                    <Select value={guidance.intensity} onValueChange={(v) => setGuidance({ ...guidance, intensity: v as ReviewGuidance["intensity"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTENSITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>CTA desejado</Label>
                    <Select value={guidance.cta} onValueChange={(v) => setGuidance({ ...guidance, cta: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CTA_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {guidance.cta === "Personalizado" && (
                  <div>
                    <Label>CTA personalizado</Label>
                    <Input value={guidance.ctaCustom ?? ""} onChange={(e) => setGuidance({ ...guidance, ctaCustom: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label>Informação obrigatória</Label>
                  <Input value={guidance.mustInclude} onChange={(e) => setGuidance({ ...guidance, mustInclude: e.target.value })} placeholder="Ex.: incluir o telefone (11) 99999-9999" />
                </div>
                <div>
                  <Label>Instrução adicional</Label>
                  <Textarea rows={2} value={guidance.extraInstruction} onChange={(e) => setGuidance({ ...guidance, extraInstruction: e.target.value })}
                    placeholder="Ex.: headline curta e apoio com no máximo duas linhas." />
                </div>
              </div>
            </details>

            <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveManual} disabled={saving}><Save className="mr-2 h-4 w-4" />Salvar edição manual</Button>
                <Button variant="outline" onClick={autoVariation}>
                  <Wand2 className="mr-2 h-4 w-4" />Criar variação automática
                </Button>
                <Button variant="outline" onClick={prepareReview}>
                  <ExternalLink className="mr-2 h-4 w-4" />Preparar revisão no ChatGPT
                </Button>
                <Button variant="ghost" onClick={() => setMode("import")}>
                  Importar revisão
                </Button>
              </div>
              <div className="flex gap-2">
                {draft.revisionHistory && draft.revisionHistory.length > 0 && (
                  <Button variant="ghost" onClick={restorePrev}>
                    <RotateCcw className="mr-2 h-4 w-4" />Restaurar anterior
                  </Button>
                )}
                <Button variant="ghost" onClick={() => onOpenChange(false)}><X className="mr-2 h-4 w-4" />Cancelar</Button>
              </div>
            </DialogFooter>
            <p className="text-[11px] text-muted-foreground">
              Variação automática usa modelos internos sem IA. Para reescrita interpretativa, use o ChatGPT externo.
            </p>
          </div>
        )}

        {mode === "review" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Copie o pedido abaixo e cole no ChatGPT. A resposta deve vir como JSON válido para ser importada de volta.
            </p>
            <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted/40 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">{reviewPrompt}</pre>
            <DialogFooter className="flex flex-wrap gap-2">
              <Button onClick={() => copyReview(false)}><Copy className="mr-2 h-4 w-4" />Copiar pedido de revisão</Button>
              <Button variant="secondary" onClick={() => copyReview(true)}>
                <ExternalLink className="mr-2 h-4 w-4" />Copiar e abrir ChatGPT
              </Button>
              <Button variant="ghost" onClick={() => setMode("import")}>Já tenho a resposta — importar</Button>
              <Button variant="ghost" onClick={() => setMode("editor")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao editor</Button>
            </DialogFooter>
          </div>
        )}

        {mode === "import" && (
          <div className="space-y-3">
            <Label>Cole aqui a resposta recebida do ChatGPT</Label>
            <Textarea
              rows={12}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder='{"headline":"...","support_text":"...","bullets":[],"cta":"...","angle":"...","status":"approved","warnings":[]}'
              className="font-mono text-xs"
            />
            {parseError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{parseError}</p>
            )}
            <DialogFooter className="flex flex-wrap gap-2">
              <Button onClick={validatePaste}><CheckCircle2 className="mr-2 h-4 w-4" />Validar resposta</Button>
              <Button variant="ghost" onClick={() => setMode("editor")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao editor</Button>
            </DialogFooter>
            <p className="text-[11px] text-muted-foreground">
              Nenhum código é executado. HTML é removido. Aceitamos JSON puro ou dentro de bloco de código.
            </p>
          </div>
        )}

        {mode === "preview" && variations.length > 0 && (
          <div className="space-y-4">
            {variations.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {variations.map((_, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={i === chosenIdx ? "default" : "outline"}
                    onClick={() => { setChosenIdx(i); setChosenEditable(variations[i]); }}
                  >
                    Variação {i + 1}
                  </Button>
                ))}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Card title="Versão atual">
                <Row label="Headline" value={draft.mainText} />
                <Row label="Apoio" value={draft.supportText} />
                {draft.bullets.length > 0 && <Row label="Bullets" value={draft.bullets.join("\n")} multi />}
                <Row label="CTA" value={draft.cta} />
              </Card>
              <Card title="Nova versão (editável)">
                {chosenEditable && (
                  <>
                    <Field label="Headline" value={chosenEditable.headline} onChange={(v) => setChosenEditable({ ...chosenEditable, headline: v })} />
                    <Field label="Apoio" value={chosenEditable.support_text} multi onChange={(v) => setChosenEditable({ ...chosenEditable, support_text: v })} />
                    <Field label="Bullets (uma por linha)" value={chosenEditable.bullets.join("\n")} multi
                      onChange={(v) => setChosenEditable({ ...chosenEditable, bullets: v.split("\n").map((s) => s.trim()).filter(Boolean) })} />
                    <Field label="CTA" value={chosenEditable.cta} onChange={(v) => setChosenEditable({ ...chosenEditable, cta: v })} />
                    <Field label="Ângulo" value={chosenEditable.angle} onChange={(v) => setChosenEditable({ ...chosenEditable, angle: v })} />
                    {chosenEditable.warnings.length > 0 && (
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px]">
                        Avisos: {chosenEditable.warnings.join("; ")}
                      </div>
                    )}
                    <Badge variant="secondary" className="text-[10px]">status: {chosenEditable.status}</Badge>
                  </>
                )}
              </Card>
            </div>

            <DialogFooter className="flex flex-wrap gap-2">
              <Button onClick={applyChosen} disabled={saving}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Aplicar nova versão
              </Button>
              <Button variant="ghost" onClick={() => setMode("import")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar e editar texto colado</Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}><X className="mr-2 h-4 w-4" />Cancelar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({ label, value, multi }: { label: string; value: string; multi?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {multi
        ? <pre className="whitespace-pre-wrap break-words text-xs">{value || "—"}</pre>
        : <p className="text-xs">{value || "—"}</p>}
    </div>
  );
}
function Field({ label, value, multi, onChange }: { label: string; value: string; multi?: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wide">{label}</Label>
      {multi ? <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} /> : <Input value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
