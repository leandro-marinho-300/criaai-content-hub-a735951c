// Modal "Enviar para aprovação": cria um link público seguro vinculado ao projeto.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Copy, ExternalLink, Send, ShieldAlert, Lock, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  generateApprovalToken,
  hashApprovalToken,
  hashApprovalPassword,
  approvalUrl,
} from "@/lib/approvalToken";
import {
  buildClientApprovalV2Linkage,
  deriveClientApprovalReadiness,
  type ClientApprovalReadiness,
} from "@/lib/creation/client-approval";
import {
  toProductionAssetVersion,
  toProductionState,
} from "@/lib/creation/production";
import { toProductionQaReview } from "@/lib/creation/qa";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  brandId: string | null;
  defaultTitle: string;
}

const DEFAULT_MESSAGE =
  "Olá! Preparamos esta proposta de conteúdo para sua aprovação. Revise as peças, legenda e registre sua decisão.";

const EXPIRATION_OPTIONS = [
  { value: "never", label: "Sem expiração" },
  { value: "1", label: "1 dia" },
  { value: "3", label: "3 dias" },
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
];

export function SendForApprovalDialog({ open, onOpenChange, projectId, brandId, defaultTitle }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [includeCaption, setIncludeCaption] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [allowPieceApproval, setAllowPieceApproval] = useState(true);
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("7");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [warnAcknowledged, setWarnAcknowledged] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["approvals", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_approvals")
        .select("id, status, submitted_at, view_count, created_at, revoked_at, expires_at, password_hash")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: open,
  });

  const {
    data: v2Gate,
    isLoading: v2GateLoading,
    isError: v2GateError,
  } = useQuery({
    queryKey: ["v2-client-approval-readiness", projectId],
    queryFn: async (): Promise<{
      readiness: ClientApprovalReadiness;
      warnFindings: string[];
    }> => {
      const { data: core, error: coreError } = await supabase
        .from("creation_core")
        .select("project_id")
        .eq("project_id", projectId)
        .maybeSingle();
      if (coreError) throw coreError;

      if (!core) {
        return {
          readiness: deriveClientApprovalReadiness({
            isV2: false,
            productionState: null,
            asset: null,
            qaReview: null,
          }),
          warnFindings: [],
        };
      }

      const { data: stateRow, error: stateError } = await supabase
        .from("creation_production_state")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (stateError) throw stateError;

      if (
        !stateRow ||
        !stateRow.current_asset_version_id ||
        !stateRow.latest_qa_review_id
      ) {
        return {
          readiness: deriveClientApprovalReadiness({
            isV2: true,
            productionState: stateRow ? toProductionState(stateRow) : null,
            asset: null,
            qaReview: null,
          }),
          warnFindings: [],
        };
      }

      const [assetResult, qaResult] = await Promise.all([
        supabase
          .from("creation_production_asset_versions")
          .select("*")
          .eq("project_id", projectId)
          .eq("id", stateRow.current_asset_version_id)
          .maybeSingle(),
        supabase
          .from("creation_production_qa_reviews")
          .select("*")
          .eq("project_id", projectId)
          .eq("id", stateRow.latest_qa_review_id)
          .maybeSingle(),
      ]);
      if (assetResult.error) throw assetResult.error;
      if (qaResult.error) throw qaResult.error;

      const asset = assetResult.data
        ? toProductionAssetVersion(assetResult.data)
        : null;
      const qaReview = qaResult.data
        ? toProductionQaReview(qaResult.data)
        : null;

      return {
        readiness: deriveClientApprovalReadiness({
          isV2: true,
          productionState: toProductionState(stateRow),
          asset,
          qaReview,
        }),
        warnFindings:
          qaReview?.findings
            .filter((finding) => finding.status === "WARN")
            .map((finding) => finding.message) ?? [],
      };
    },
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      if (!v2Gate) {
        throw new Error("Não foi possível validar a elegibilidade para aprovação.");
      }
      if (!v2Gate.readiness.canSend) {
        throw new Error(v2Gate.readiness.message);
      }
      if (
        v2Gate.readiness.requiresWarnAcknowledgement &&
        !warnAcknowledged
      ) {
        throw new Error("Confirme os avisos de QA antes de gerar o link.");
      }
      if (requirePassword && password.trim().length < 4) {
        throw new Error("Senha deve ter ao menos 4 caracteres.");
      }
      const token = generateApprovalToken();
      const tokenHash = await hashApprovalToken(token);
      const passwordHash =
        requirePassword && password.trim() ? await hashApprovalPassword(password.trim()) : null;
      const expiresAt =
        expiresInDays !== "never"
          ? new Date(Date.now() + Number(expiresInDays) * 86_400_000).toISOString()
          : null;
      const v2Linkage = buildClientApprovalV2Linkage(
        v2Gate.readiness,
        v2Gate.readiness.kind === "warn" && warnAcknowledged
          ? new Date().toISOString()
          : null,
      );

      const { error } = await supabase.from("client_approvals").insert({
        user_id: user.id,
        project_id: projectId,
        brand_id: brandId,
        token_hash: tokenHash,
        title: title.trim() || defaultTitle || "Aprovação de conteúdo",
        introduction_message: message.trim() || null,
        include_caption: includeCaption,
        include_hashtags: includeHashtags,
        allow_piece_approval: allowPieceApproval,
        allow_piece_comments: allowPieceApproval,
        password_hash: passwordHash,
        expires_at: expiresAt,
        status: "enviado_para_aprovacao",
        ...v2Linkage,
      });
      if (error) throw error;
      return { url: approvalUrl(token), password: requirePassword ? password.trim() : null };
    },
    onSuccess: ({ url, password }) => {
      setCreatedUrl(url);
      setCreatedPassword(password);
      qc.invalidateQueries({ queryKey: ["approvals", projectId] });
      qc.invalidateQueries({ queryKey: ["approvals-panel", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard-approvals"] });
      toast.success("Link de aprovação criado.");
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao criar link."),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_approvals")
        .update({ status: "link_revogado", revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link revogado.");
      qc.invalidateQueries({ queryKey: ["approvals", projectId] });
      qc.invalidateQueries({ queryKey: ["approvals-panel", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard-approvals"] });
    },
  });

  const copy = async (text: string, label = "Link") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const closeAll = () => {
    setCreatedUrl(null);
    setCreatedPassword(null);
    setPassword("");
    setRequirePassword(false);
    setWarnAcknowledged(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) closeAll(); else onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar para aprovação</DialogTitle>
          <DialogDescription>
            Gere um link público para o cliente revisar e aprovar este conteúdo, sem precisar criar conta.
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3">
              <Label className="text-xs uppercase text-muted-foreground">Link gerado</Label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={createdUrl} className="font-mono text-xs" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(createdUrl)}>
                    <Copy className="mr-1 h-4 w-4" />Copiar
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={createdUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" />Abrir
                    </a>
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <ShieldAlert className="mr-1 inline h-3 w-3" />
                Este link só será exibido agora. Copie e envie ao cliente.
              </p>
            </div>
            {createdPassword && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                <Label className="text-xs uppercase text-amber-700 dark:text-amber-400">
                  <Lock className="mr-1 inline h-3 w-3" />Senha definida
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input readOnly value={createdPassword} className="font-mono text-sm" />
                  <Button size="sm" variant="outline" onClick={() => copy(createdPassword, "Senha")}>
                    <Copy className="mr-1 h-4 w-4" />Copiar
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Envie a senha por um canal separado do link. Não conseguiremos exibi-la novamente.
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={closeAll}>Concluir</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ap-title">Título para o cliente</Label>
              <Input id="ap-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="ap-msg">Mensagem de apresentação</Label>
              <Textarea id="ap-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            </div>

            {v2GateLoading ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                Validando Asset e QA da Creation V2...
              </div>
            ) : v2GateError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <ShieldAlert className="mr-1.5 inline h-4 w-4 text-destructive" />
                Não foi possível validar o QA da Creation V2. O envio foi bloqueado por segurança.
              </div>
            ) : v2Gate?.readiness.kind !== "legacy" ? (
              <div
                className={`rounded-md border p-3 ${
                  v2Gate?.readiness.kind === "ready"
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : v2Gate?.readiness.kind === "warn"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-destructive/40 bg-destructive/5"
                }`}
              >
                <p className="text-sm font-medium">
                  {v2Gate?.readiness.kind === "ready" ? (
                    <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-emerald-600" />
                  ) : (
                    <ShieldAlert
                      className={`mr-1.5 inline h-4 w-4 ${
                        v2Gate?.readiness.kind === "warn"
                          ? "text-amber-600"
                          : "text-destructive"
                      }`}
                    />
                  )}
                  {v2Gate?.readiness.kind === "ready"
                    ? "QA PASS — Asset V2 pronto"
                    : v2Gate?.readiness.kind === "warn"
                      ? "QA WARN — confirmação necessária"
                      : "Envio V2 bloqueado"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {v2Gate?.readiness.message}
                </p>
                {v2Gate?.readiness.kind === "warn" && (
                  <div className="mt-3 space-y-2">
                    {v2Gate.warnFindings.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {v2Gate.warnFindings.slice(0, 3).map((finding, index) => (
                          <li key={`${index}-${finding}`}>{finding}</li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center justify-between gap-3 rounded border bg-background/60 p-2">
                      <Label htmlFor="ap-qa-warn" className="text-xs font-normal">
                        Revisei os avisos e quero enviar esta versão ao cliente.
                      </Label>
                      <Switch
                        id="ap-qa-warn"
                        checked={warnAcknowledged}
                        onCheckedChange={setWarnAcknowledged}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="ap-cap">Incluir legenda</Label>
                  <p className="text-xs text-muted-foreground">Mostra o texto sugerido para a publicação.</p>
                </div>
                <Switch id="ap-cap" checked={includeCaption} onCheckedChange={setIncludeCaption} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="ap-tags">Incluir hashtags</Label>
                  <p className="text-xs text-muted-foreground">Mostra as hashtags sugeridas.</p>
                </div>
                <Switch id="ap-tags" checked={includeHashtags} onCheckedChange={setIncludeHashtags} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="ap-piece">Aprovação por peça</Label>
                  <p className="text-xs text-muted-foreground">Cliente pode aprovar ou comentar cada peça individualmente.</p>
                </div>
                <Switch id="ap-piece" checked={allowPieceApproval} onCheckedChange={setAllowPieceApproval} />
              </div>
            </div>

            <div className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="ap-pw"><Lock className="mr-1 inline h-3 w-3" />Proteger com senha</Label>
                  <p className="text-xs text-muted-foreground">
                    Cliente deverá digitar a senha para abrir o link.
                  </p>
                </div>
                <Switch id="ap-pw" checked={requirePassword} onCheckedChange={setRequirePassword} />
              </div>
              {requirePassword && (
                <Input
                  type="text"
                  placeholder="Defina uma senha (mín. 4 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={64}
                  className="font-mono"
                />
              )}
              <div>
                <Label htmlFor="ap-exp"><Clock className="mr-1 inline h-3 w-3" />Expira em</Label>
                <select
                  id="ap-exp"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {EXPIRATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Após esse período o link deixa de funcionar automaticamente.
                </p>
              </div>
            </div>

            {existing && existing.length > 0 && (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Links existentes</p>
                <ul className="space-y-1.5 text-sm">
                  {existing.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <Badge variant={a.revoked_at ? "outline" : "secondary"} className="text-xs">
                        {a.status}
                      </Badge>
                      {a.password_hash && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Protegido por senha" />}
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("pt-BR")} · {a.view_count} visualização(ões)
                        {a.expires_at && ` · expira ${new Date(a.expires_at).toLocaleDateString("pt-BR")}`}
                      </span>
                      {!a.revoked_at && a.status !== "link_revogado" && (
                        <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs"
                          onClick={() => revoke.mutate(a.id)}>
                          Revogar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={() => create.mutate()}
                disabled={
                  create.isPending ||
                  v2GateLoading ||
                  v2GateError ||
                  !v2Gate?.readiness.canSend ||
                  ((v2Gate?.readiness.requiresWarnAcknowledgement ?? false) &&
                    !warnAcknowledged)
                }
              >
                <Send className="mr-2 h-4 w-4" />
                {create.isPending ? "Gerando..." : "Gerar link de aprovação"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
