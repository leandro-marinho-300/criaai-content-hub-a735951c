// Portal público de aprovação do cliente.
// Rota pública: não exige login. Consome /api/public/approval/$token.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, MessageSquare, Send, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/approval/$token")({
  head: () => ({ meta: [{ title: "Aprovação de conteúdo" }] }),
  component: PortalPage,
});

type PieceDecision = "pending" | "approved" | "changes_requested" | "rejected";
type GeneralDecision = "approved" | "approved_with_changes" | "changes_requested" | "rejected";

interface PieceData {
  outputId: string;
  title: string;
  caption: string | null;
  hashtags: string[] | null;
  order: number;
  assets: Array<{ id: string; url: string | null; width: number | null; height: number | null }>;
  decision: PieceDecision;
  comment: string;
}

interface Payload {
  state: "ok" | "expired" | "revoked";
  alreadyResponded: boolean;
  allowMultipleResponses: boolean;
  allowPieceApproval: boolean;
  allowPieceComments: boolean;
  includeCaption: boolean;
  includeHashtags: boolean;
  approval: { id: string; title: string; introductionMessage: string | null; decision: string | null; clientName: string | null; generalComment: string | null };
  brand: { name: string; logoUrl: string | null } | null;
  project: { title: string };
  pieces: PieceData[];
}

function PortalPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [pieces, setPieces] = useState<PieceData[]>([]);
  const [decision, setDecision] = useState<GeneralDecision | "">("");
  const [generalComment, setGeneralComment] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/approval/${encodeURIComponent(token)}`);
        if (res.status === 404) { if (!cancelled) { setError("invalid"); setLoading(false); } return; }
        const j = (await res.json()) as Payload;
        if (cancelled) return;
        if (j.state !== "ok") { setError(j.state); setLoading(false); return; }
        setData(j);
        setPieces(j.pieces);
        if (j.alreadyResponded && !j.allowMultipleResponses) {
          setSubmitted(true);
        }
        setLoading(false);
      } catch {
        if (!cancelled) { setError("invalid"); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const updatePiece = (idx: number, patch: Partial<PieceData>) =>
    setPieces((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const summary = useMemo(() => {
    const approved = pieces.filter((p) => p.decision === "approved").length;
    const adjust = pieces.filter((p) => p.decision === "changes_requested").length;
    const rejected = pieces.filter((p) => p.decision === "rejected").length;
    return { approved, adjust, rejected, total: pieces.length };
  }, [pieces]);

  const canSubmit = useMemo(() => {
    if (!decision) return false;
    if (clientName.trim().length < 2) return false;
    if ((decision === "changes_requested" || decision === "rejected") && !generalComment.trim()) return false;
    if (data?.allowPieceApproval) {
      const invalid = pieces.find(
        (p) => (p.decision === "changes_requested" || p.decision === "rejected") && !p.comment.trim(),
      );
      if (invalid) return false;
    }
    return true;
  }, [decision, clientName, generalComment, pieces, data]);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/approval/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName,
          clientEmail: clientEmail || undefined,
          clientCompany: clientCompany || undefined,
          decision,
          generalComment,
          pieces: pieces.map((p) => ({ outputId: p.outputId, decision: p.decision, comment: p.comment })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.error === "comment_required" ? "Adicione um motivo." : "Não foi possível enviar. Tente novamente.");
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <CenterMsg>Carregando…</CenterMsg>;
  if (error === "invalid") return <CenterMsg icon={<AlertTriangle className="h-8 w-8 text-muted-foreground" />}>Não foi possível localizar esta aprovação.</CenterMsg>;
  if (error === "expired") return <CenterMsg icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}>Este link de aprovação expirou.</CenterMsg>;
  if (error === "revoked") return <CenterMsg icon={<AlertTriangle className="h-8 w-8 text-destructive" />}>Este link não está mais disponível.</CenterMsg>;
  if (!data) return null;

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-xl font-semibold">Resposta registrada com sucesso</h1>
              <p className="text-sm text-muted-foreground">
                {data.approval.title} · {decisionLabel(data.approval.decision as GeneralDecision | null) ?? "Resposta enviada"}
              </p>
              <p className="text-xs text-muted-foreground">Você já pode fechar esta janela.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          {data.brand?.logoUrl ? (
            <img src={data.brand.logoUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-md bg-primary/10" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{data.brand?.name ?? "Apresentação"}</p>
            <h1 className="truncate text-lg font-semibold">{data.approval.title}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {data.approval.introductionMessage && (
          <Card><CardContent className="p-5 text-sm leading-relaxed">{data.approval.introductionMessage}</CardContent></Card>
        )}

        {pieces.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
            Este conteúdo ainda não possui peças disponíveis para aprovação.
          </CardContent></Card>
        )}

        {pieces.map((p, idx) => (
          <Card key={p.outputId} className="overflow-hidden">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Peça {idx + 1} de {pieces.length}</p>
                  <h2 className="font-semibold">{p.title}</h2>
                </div>
                {data.allowPieceApproval && (
                  <Badge variant={p.decision === "approved" ? "default" : p.decision === "pending" ? "outline" : "secondary"}>
                    {pieceDecisionLabel(p.decision)}
                  </Badge>
                )}
              </div>

              {p.assets.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {p.assets.map((a) => (
                    <div key={a.id} className="overflow-hidden rounded-md border bg-muted/40">
                      {a.url ? (
                        <img src={a.url} alt="" className="h-auto w-full" loading="lazy" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center text-muted-foreground">
                          <ImageOff className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                  Nenhuma arte anexada a esta peça.
                </p>
              )}

              {data.includeCaption && p.caption && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Legenda</Label>
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/30 p-3 text-sm leading-relaxed">{p.caption}</pre>
                </div>
              )}
              {data.includeHashtags && p.hashtags && p.hashtags.length > 0 && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Hashtags</Label>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{p.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
                </div>
              )}

              {data.allowPieceApproval && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label className="text-xs uppercase text-muted-foreground">Sua avaliação desta peça</Label>
                  <RadioGroup value={p.decision} onValueChange={(v) => updatePiece(idx, { decision: v as PieceDecision })} className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="approved" />Aprovar</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="changes_requested" />Solicitar ajuste</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="rejected" />Não utilizar</label>
                    <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="pending" />Sem avaliar</label>
                  </RadioGroup>
                  {(p.decision === "changes_requested" || p.decision === "rejected") && (
                    <Textarea
                      placeholder="O que precisa ser ajustado?"
                      value={p.comment}
                      onChange={(e) => updatePiece(idx, { comment: e.target.value })}
                      rows={2}
                      maxLength={1000}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {pieces.length > 0 && (
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="font-semibold"><MessageSquare className="mr-1 inline h-4 w-4" />Sua decisão final</h2>
              <RadioGroup value={decision} onValueChange={(v) => setDecision(v as GeneralDecision)} className="grid gap-2">
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="approved" className="mt-1" />
                  <div><p className="font-medium text-sm">Aprovar todo o conteúdo</p><p className="text-xs text-muted-foreground">Todas as peças seguirão para publicação.</p></div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="approved_with_changes" className="mt-1" />
                  <div><p className="font-medium text-sm">Aprovar com ajustes</p><p className="text-xs text-muted-foreground">Use os comentários para indicar pequenos ajustes.</p></div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="changes_requested" className="mt-1" />
                  <div><p className="font-medium text-sm">Solicitar nova versão</p><p className="text-xs text-muted-foreground">Requer uma observação geral.</p></div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="rejected" className="mt-1" />
                  <div><p className="font-medium text-sm">Não aprovar</p><p className="text-xs text-muted-foreground">Requer motivo.</p></div>
                </label>
              </RadioGroup>

              <div>
                <Label htmlFor="gen-comment">Observação geral</Label>
                <Textarea id="gen-comment" rows={3} value={generalComment} onChange={(e) => setGeneralComment(e.target.value)} maxLength={2000} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cl-name">Seu nome *</Label>
                  <Input id="cl-name" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="cl-email">E-mail (opcional)</Label>
                  <Input id="cl-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} maxLength={200} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cl-company">Empresa (opcional)</Label>
                  <Input id="cl-company" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} maxLength={200} />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Ao enviar, declaro que revisei o material apresentado e estou registrando minha decisão.
              </p>

              {data.allowPieceApproval && (
                <p className="text-xs text-muted-foreground">
                  Resumo: {summary.approved} aprovadas · {summary.adjust} com ajustes · {summary.rejected} recusadas · {summary.total - summary.approved - summary.adjust - summary.rejected} sem avaliar.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {pieces.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
            <Button onClick={submit} disabled={!canSubmit || submitting}>
              <Send className="mr-2 h-4 w-4" />{submitting ? "Enviando…" : "Confirmar e enviar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function pieceDecisionLabel(d: PieceDecision) {
  return { pending: "Sem avaliar", approved: "Aprovada", changes_requested: "Ajuste solicitado", rejected: "Não utilizar" }[d];
}
function decisionLabel(d: GeneralDecision | null) {
  if (!d) return null;
  return { approved: "Aprovado", approved_with_changes: "Aprovado com ajustes", changes_requested: "Ajustes solicitados", rejected: "Recusado" }[d];
}

function CenterMsg({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-3 p-8 text-center">
          {icon && <div className="flex justify-center">{icon}</div>}
          <p className="text-sm text-muted-foreground">{children}</p>
        </CardContent>
      </Card>
    </div>
  );
}
