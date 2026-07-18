// Portal público de aprovação do cliente.
// Rota pública: não exige login. Consome /api/public/approval/$token.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Send,
  ImageOff,
  Lock,
  Clock,
  FileText,
  ExternalLink,
  FileVideo,
} from "lucide-react";
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
  assets: Array<{
    id: string;
    url: string | null;
    width: number | null;
    height: number | null;
    fileName: string;
    fileType: string;
    isScriptVisual: boolean;
    isFinalVideo?: boolean;
  }>;
  decision: PieceDecision;
  comment: string;
}

interface Reel2ApprovalSummary {
  centralIdea: string;
  objective: string;
  reelType: string;
  promise: string;
  selectedHook: string;
  selectedHookText: string;
  coverMode: string;
  coverTitle: string;
  coverSubtitle: string;
  coverInstruction: string;
  publicationCaption: string;
  cta: string;
  hashtags: string[];
  videoCaption: string;
  mainScenes: Array<{ index: number; time: string; function: string; speech: string; onScreenText: string; visualDirection: string }>;
  shortScenes: Array<{ index: number; time: string; function: string; speech: string; onScreenText: string; visualDirection: string }>;
}

interface Payload {
  state: "ok" | "expired" | "revoked" | "password_required" | "password_invalid" | "locked";
  alreadyResponded: boolean;
  allowMultipleResponses: boolean;
  allowPieceApproval: boolean;
  allowPieceComments: boolean;
  includeCaption: boolean;
  includeHashtags: boolean;
  expiresAt?: string | null;
  approval: {
    id: string;
    title: string;
    introductionMessage: string | null;
    decision: string | null;
    clientName: string | null;
    generalComment: string | null;
  };
  brand: { name: string; logoUrl: string | null } | null;
  project: { title: string };
  reel2?: Reel2ApprovalSummary | null;
  pieces: PieceData[];
  attemptsLeft?: number;
  lockedUntil?: string | null;
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

  // Senha
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const fetchData = useCallback(
    async (pw?: string) => {
      try {
        const res = await fetch(`/api/public/approval/${encodeURIComponent(token)}`, {
          headers: pw ? { "x-approval-password": pw } : undefined,
        });
        if (res.status === 404) {
          setError("invalid");
          setLoading(false);
          return;
        }
        const j = (await res.json()) as Payload;
        if (j.state === "password_required") {
          setNeedsPassword(true);
          setPasswordError(null);
          setLoading(false);
          return;
        }
        if (j.state === "password_invalid") {
          setNeedsPassword(true);
          setAttemptsLeft(j.attemptsLeft ?? null);
          setPasswordError("Senha incorreta. Tente novamente.");
          setLoading(false);
          return;
        }
        if (j.state === "locked") {
          setNeedsPassword(false);
          setLockedUntil(j.lockedUntil ?? null);
          setError("locked");
          setLoading(false);
          return;
        }
        if (j.state !== "ok") {
          setError(j.state);
          setLoading(false);
          return;
        }
        setNeedsPassword(false);
        setData(j);
        setPieces(j.pieces);
        if (j.alreadyResponded && !j.allowMultipleResponses) setSubmitted(true);
        setLoading(false);
      } catch {
        setError("invalid");
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await fetchData();
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const submitPassword = async () => {
    if (password.trim().length < 1) return;
    setSubmittingPassword(true);
    setLoading(true);
    try {
      await fetchData(password.trim());
    } finally {
      setSubmittingPassword(false);
    }
  };

  const updatePiece = (idx: number, patch: Partial<PieceData>) => {
    setPieces((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    if (patch.decision && patch.decision !== "approved" && decision === "approved") {
      setDecision("");
    }
  };

  const updateGeneralDecision = (value: GeneralDecision) => {
    setDecision(value);
    if (value === "approved") {
      setPieces((prev) => prev.map((piece) => ({ ...piece, decision: "approved", comment: "" })));
    }
  };

  const summary = useMemo(() => {
    const approved = pieces.filter((p) => p.decision === "approved").length;
    const adjust = pieces.filter((p) => p.decision === "changes_requested").length;
    const rejected = pieces.filter((p) => p.decision === "rejected").length;
    return { approved, adjust, rejected, total: pieces.length };
  }, [pieces]);

  const canSubmit = useMemo(() => {
    if (!decision) return false;
    if (clientName.trim().length < 2) return false;
    if ((decision === "changes_requested" || decision === "rejected") && !generalComment.trim())
      return false;
    if (data?.allowPieceApproval) {
      const invalid = pieces.find(
        (p) =>
          (p.decision === "changes_requested" || p.decision === "rejected") && !p.comment.trim(),
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
        headers: {
          "content-type": "application/json",
          ...(password ? { "x-approval-password": password } : {}),
        },
        body: JSON.stringify({
          clientName,
          clientEmail: clientEmail || undefined,
          clientCompany: clientCompany || undefined,
          decision,
          generalComment,
          pieces: pieces.map((p) => ({
            outputId: p.outputId,
            decision: p.decision,
            comment: p.comment,
          })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(
          j.error === "comment_required"
            ? "Adicione um motivo."
            : "Não foi possível enviar. Tente novamente.",
        );
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !needsPassword) return <CenterMsg>Carregando…</CenterMsg>;

  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="text-center">
              <Lock className="mx-auto h-8 w-8 text-primary" />
              <h1 className="mt-2 text-lg font-semibold">Conteúdo protegido</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Digite a senha que recebeu junto com o link para acessar este material.
              </p>
            </div>
            <div>
              <Label htmlFor="pw">Senha</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitPassword();
                }}
                autoFocus
              />
              {passwordError && (
                <p className="mt-1 text-xs text-destructive">
                  {passwordError}
                  {attemptsLeft !== null && ` (${attemptsLeft} tentativa(s) restante(s))`}
                </p>
              )}
            </div>
            <Button
              onClick={submitPassword}
              disabled={submittingPassword || !password.trim()}
              className="w-full"
            >
              {submittingPassword ? "Verificando…" : "Acessar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error === "invalid")
    return (
      <CenterMsg icon={<AlertTriangle className="h-8 w-8 text-muted-foreground" />}>
        Não foi possível localizar esta aprovação.
      </CenterMsg>
    );
  if (error === "expired")
    return (
      <CenterMsg icon={<Clock className="h-8 w-8 text-amber-500" />}>
        Este link de aprovação expirou.
      </CenterMsg>
    );
  if (error === "revoked")
    return (
      <CenterMsg icon={<AlertTriangle className="h-8 w-8 text-destructive" />}>
        Este link não está mais disponível.
      </CenterMsg>
    );
  if (error === "locked") {
    const until = lockedUntil ? new Date(lockedUntil).toLocaleString("pt-BR") : null;
    return (
      <CenterMsg icon={<Lock className="h-8 w-8 text-destructive" />}>
        Muitas tentativas de senha. Tente novamente {until ? `após ${until}` : "mais tarde"}.
      </CenterMsg>
    );
  }
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
                {data.approval.title} ·{" "}
                {decisionLabel(data.approval.decision as GeneralDecision | null) ??
                  "Resposta enviada"}
              </p>
              <p className="text-xs text-muted-foreground">Você já pode fechar esta janela.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-32 sm:pb-24">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:py-5">
          {data.brand?.logoUrl ? (
            <img src={data.brand.logoUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-md bg-primary/10" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {data.brand?.name ?? "Apresentação"}
            </p>
            <h1 className="truncate text-base font-semibold sm:text-lg">{data.approval.title}</h1>
          </div>
          {data.expiresAt && (
            <Badge variant="outline" className="hidden shrink-0 gap-1 text-xs sm:inline-flex">
              <Clock className="h-3 w-3" />
              expira {new Date(data.expiresAt).toLocaleDateString("pt-BR")}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6">
        {data.approval.introductionMessage && (
          <Card>
            <CardContent className="p-4 text-sm leading-relaxed sm:p-5">
              {data.approval.introductionMessage}
            </CardContent>
          </Card>
        )}

        {data.reel2 && <Reel2ApprovalCard reel={data.reel2} />}

        {pieces.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Este conteúdo ainda não possui peças disponíveis para aprovação.
            </CardContent>
          </Card>
        )}

        {pieces.map((p, idx) => (
          <Card key={p.outputId} className="overflow-hidden">
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Peça {idx + 1} de {pieces.length}
                  </p>
                  <h2 className="truncate font-semibold">{p.title}</h2>
                </div>
                {data.allowPieceApproval && (
                  <Badge
                    variant={
                      p.decision === "approved"
                        ? "default"
                        : p.decision === "pending"
                          ? "outline"
                          : "secondary"
                    }
                    className="shrink-0"
                  >
                    {pieceDecisionLabel(p.decision)}
                  </Badge>
                )}
              </div>

              {p.assets.length > 0 ? (
                <div className="space-y-3">
                  {p.assets.map((a) => (
                    <div key={a.id} className="overflow-hidden rounded-md border bg-muted/40">
                      {(a.isScriptVisual || a.isFinalVideo) && (
                        <div className={a.isFinalVideo ? "flex flex-wrap items-center justify-between gap-2 border-b bg-orange-500/5 px-3 py-2" : "flex flex-wrap items-center justify-between gap-2 border-b bg-violet-500/5 px-3 py-2"}>
                          <div className="flex min-w-0 items-center gap-2">
                            {a.isFinalVideo ? (
                              <FileVideo className="h-4 w-4 shrink-0 text-orange-600" />
                            ) : (
                              <FileText className="h-4 w-4 shrink-0 text-violet-600" />
                            )}
                            <div className="min-w-0">
                              <p className={a.isFinalVideo ? "text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300" : "text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300"}>
                                {a.isFinalVideo ? "Vídeo final" : "Visual do roteiro"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{a.fileName}</p>
                            </div>
                          </div>
                          {a.url && (
                            <Button asChild size="sm" variant="outline" className="h-8">
                              <a href={a.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                      {a.url ? (
                        a.fileType === "application/pdf" ? (
                          <iframe
                            src={a.url}
                            title={a.isScriptVisual ? "Visual do roteiro" : a.fileName}
                            className="h-[70vh] min-h-[480px] w-full bg-white"
                          />
                        ) : a.fileType.startsWith("video/") ? (
                          <video
                            src={a.url}
                            controls
                            className="max-h-[80vh] w-full bg-black"
                          />
                        ) : (
                          <img
                            src={a.url}
                            alt={a.fileName}
                            className="h-auto max-h-[80vh] w-full object-contain"
                            loading="lazy"
                          />
                        )
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
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/30 p-3 text-sm leading-relaxed">
                    {p.caption}
                  </pre>
                </div>
              )}
              {data.includeHashtags && p.hashtags && p.hashtags.length > 0 && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Hashtags</Label>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {p.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                  </p>
                </div>
              )}

              {data.allowPieceApproval && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Sua avaliação desta peça
                  </Label>
                  <RadioGroup
                    value={p.decision}
                    onValueChange={(v) => updatePiece(idx, { decision: v as PieceDecision })}
                    className="flex flex-wrap gap-3"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="approved" />
                      Aprovar
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="changes_requested" />
                      Solicitar ajuste
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="rejected" />
                      Não utilizar
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="pending" />
                      Sem avaliar
                    </label>
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
            <CardContent className="space-y-4 p-4 sm:p-5">
              <h2 className="font-semibold">
                <MessageSquare className="mr-1 inline h-4 w-4" />
                Sua decisão final
              </h2>
              <RadioGroup
                value={decision}
                onValueChange={(v) => updateGeneralDecision(v as GeneralDecision)}
                className="grid gap-2"
              >
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="approved" className="mt-1" />
                  <div>
                    <p className="font-medium text-sm">Aprovar todo o conteúdo</p>
                    <p className="text-xs text-muted-foreground">
                      Todas as peças serão marcadas como aprovadas e seguirão para publicação.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="approved_with_changes" className="mt-1" />
                  <div>
                    <p className="font-medium text-sm">Aprovar com ajustes</p>
                    <p className="text-xs text-muted-foreground">
                      Use os comentários para indicar pequenos ajustes.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="changes_requested" className="mt-1" />
                  <div>
                    <p className="font-medium text-sm">Solicitar nova versão</p>
                    <p className="text-xs text-muted-foreground">Requer uma observação geral.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                  <RadioGroupItem value="rejected" className="mt-1" />
                  <div>
                    <p className="font-medium text-sm">Não aprovar</p>
                    <p className="text-xs text-muted-foreground">Requer motivo.</p>
                  </div>
                </label>
              </RadioGroup>

              <div>
                <Label htmlFor="gen-comment">Observação geral</Label>
                <Textarea
                  id="gen-comment"
                  rows={3}
                  value={generalComment}
                  onChange={(e) => setGeneralComment(e.target.value)}
                  maxLength={2000}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cl-name">Seu nome *</Label>
                  <Input
                    id="cl-name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label htmlFor="cl-email">E-mail (opcional)</Label>
                  <Input
                    id="cl-email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cl-company">Empresa (opcional)</Label>
                  <Input
                    id="cl-company"
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Ao enviar, declaro que revisei o material apresentado e estou registrando minha
                decisão.
              </p>

              {data.allowPieceApproval && (
                <p className="text-xs text-muted-foreground">
                  Resumo: {summary.approved} aprovadas · {summary.adjust} com ajustes ·{" "}
                  {summary.rejected} recusadas ·{" "}
                  {summary.total - summary.approved - summary.adjust - summary.rejected} sem
                  avaliar.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {pieces.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-3 py-3 backdrop-blur sm:px-4">
          <div className="mx-auto flex max-w-3xl items-center justify-end">
            <Button
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="w-full sm:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitting ? "Enviando…" : "Confirmar e enviar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function pieceDecisionLabel(d: PieceDecision) {
  return {
    pending: "Sem avaliar",
    approved: "Aprovada",
    changes_requested: "Ajuste solicitado",
    rejected: "Não utilizar",
  }[d];
}
function decisionLabel(d: GeneralDecision | null) {
  if (!d) return null;
  return {
    approved: "Aprovado",
    approved_with_changes: "Aprovado com ajustes",
    changes_requested: "Ajustes solicitados",
    rejected: "Recusado",
  }[d];
}


function Reel2ApprovalCard({ reel }: { reel: Reel2ApprovalSummary }) {
  return (
    <Card className="border-orange-500/25 bg-orange-500/5">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
              Resumo do Reel
            </p>
            <h2 className="text-lg font-semibold">{reel.centralIdea}</h2>
          </div>
          <Badge className="bg-orange-500 text-white hover:bg-orange-500">Reel 2.0</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBlock label="Objetivo" value={reel.objective} />
          <InfoBlock label="Tipo" value={reel.reelType} />
          <InfoBlock label="Promessa" value={reel.promise} />
          <InfoBlock label="Gancho" value={reel.selectedHook} />
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Roteiro principal</Label>
          <div className="mt-2 space-y-2">
            {reel.mainScenes.map((scene) => (
              <div key={`${scene.index}-${scene.time}`} className="rounded-md border bg-card/80 p-3 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">
                  Cena {scene.index} · {scene.time} · {scene.function}
                </p>
                <p className="mt-1">{scene.speech}</p>
                {scene.onScreenText && <p className="mt-1 text-xs text-muted-foreground">Tela: {scene.onScreenText}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Legenda completa para inserir no vídeo</Label>
            <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/30 p-3 text-sm leading-relaxed">
              {reel.videoCaption}
            </pre>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Capa / frame</Label>
            <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/30 p-3 text-xs leading-relaxed">
              {reel.coverMode}\n{reel.coverInstruction}
            </pre>
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase text-muted-foreground">Legenda da publicação</Label>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted/30 p-3 text-sm leading-relaxed">
            {reel.publicationCaption}
          </pre>
          <p className="mt-2 text-sm"><b>CTA:</b> {reel.cta}</p>
          {reel.hashtags.length > 0 && (
            <p className="mt-1 break-words text-sm text-muted-foreground">{reel.hashtags.join(" ")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card/80 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{value || "—"}</p>
    </div>
  );
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
