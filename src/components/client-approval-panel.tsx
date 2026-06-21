// Painel interno "Aprovação do cliente" — exibido na página de resultado do projeto.
// Fase 2: mostra estado, decisão geral, decisões por peça, comentários, histórico de eventos,
// permite copiar/revogar links existentes e disparar a integração com o calendário quando aprovado.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck, Copy, ExternalLink, History, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type ApprovalRow = {
  id: string;
  status: string;
  decision: string | null;
  general_comment: string | null;
  client_name: string | null;
  client_company: string | null;
  client_email: string | null;
  created_at: string;
  submitted_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  revoked_at: string | null;
  view_count: number;
  schedule_decision: string | null;
  requested_date: string | null;
  requested_time: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_para_aprovacao: "Aguardando cliente",
  visualizado: "Visualizado",
  aprovado: "Aprovado",
  aprovado_com_ajustes: "Aprovado com ajustes",
  ajustes_solicitados: "Ajustes solicitados",
  nao_aprovado: "Não aprovado",
  link_revogado: "Link revogado",
  expirado: "Expirado",
};

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  aprovado: "default",
  aprovado_com_ajustes: "default",
  ajustes_solicitados: "secondary",
  nao_aprovado: "destructive",
  link_revogado: "outline",
  expirado: "outline",
};

const EVENT_LABEL: Record<string, string> = {
  link_criado: "Link de aprovação criado",
  visualizado: "Cliente abriu o link",
  decisao_registrada: "Decisão registrada pelo cliente",
  link_revogado: "Link revogado",
};

interface Props {
  projectId: string;
  onOpenSendDialog: () => void;
  onOpenAddToCalendar: () => void;
}

export function ClientApprovalPanel({ projectId, onOpenSendDialog, onOpenAddToCalendar }: Props) {
  const qc = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["approvals-panel", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_approvals")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApprovalRow[];
    },
  });

  const latest = approvals?.[0];

  const { data: items } = useQuery({
    queryKey: ["approval-items", latest?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_approval_items")
        .select("id, output_id, decision, comment, display_order")
        .eq("approval_id", latest!.id)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!latest?.id,
  });

  const { data: events } = useQuery({
    queryKey: ["approval-events", latest?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_approval_events")
        .select("id, event_type, metadata, created_at")
        .eq("approval_id", latest!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!latest?.id && historyOpen,
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
      qc.invalidateQueries({ queryKey: ["approvals-panel", projectId] });
      qc.invalidateQueries({ queryKey: ["approvals", projectId] });
    },
  });

  const pieceSummary = useMemo(() => {
    if (!items?.length) return null;
    const counts = items.reduce<Record<string, number>>((acc, it) => {
      acc[it.decision] = (acc[it.decision] ?? 0) + 1;
      return acc;
    }, {});
    return counts;
  }, [items]);

  if (isLoading) return null;

  if (!approvals || approvals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Aprovação do cliente
            </p>
            <p className="text-sm text-muted-foreground">
              Nenhum link de aprovação foi gerado para este projeto ainda.
            </p>
          </div>
          <Button size="sm" onClick={onOpenSendDialog}>
            Enviar para aprovação
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusBadge = (status: string) => (
    <Badge variant={STATUS_TONE[status] ?? "secondary"} className="text-xs">
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );

  const decisionMsg = latest?.decision
    ? STATUS_LABEL[latest.decision] ?? latest.decision
    : "Aguardando resposta do cliente";

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Aprovação do cliente
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {latest && statusBadge(latest.status)}
              <span className="text-xs text-muted-foreground">
                {latest?.view_count ?? 0} visualização(ões)
                {latest?.last_viewed_at && ` · última em ${formatDateTime(latest.last_viewed_at)}`}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {latest && (latest.status === "aprovado" || latest.status === "aprovado_com_ajustes") && (
              <Button size="sm" variant="default" onClick={onOpenAddToCalendar}>
                <CalendarCheck className="mr-1.5 h-4 w-4" />Agendar peças aprovadas
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onOpenSendDialog}>
              {approvals.length > 0 ? "Gerenciar links" : "Enviar para aprovação"}
            </Button>
          </div>
        </div>

        {latest && (
          <>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Decisão geral" value={decisionMsg} />
              <Info
                label="Cliente"
                value={
                  latest.client_name || latest.client_company || latest.client_email
                    ? [latest.client_name, latest.client_company, latest.client_email].filter(Boolean).join(" · ")
                    : "Não identificado"
                }
              />
              <Info label="Enviado em" value={latest.created_at ? formatDateTime(latest.created_at) : "—"} />
              <Info
                label="Resposta em"
                value={latest.submitted_at ? formatDateTime(latest.submitted_at) : "—"}
              />
              {latest.requested_date && (
                <Info
                  label="Data sugerida pelo cliente"
                  value={`${latest.requested_date}${latest.requested_time ? ` ${latest.requested_time}` : ""}`}
                />
              )}
              {latest.schedule_decision && (
                <Info label="Decisão sobre data" value={STATUS_LABEL[latest.schedule_decision] ?? latest.schedule_decision} />
              )}
            </div>

            {latest.general_comment && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Comentário geral</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{latest.general_comment}</p>
              </div>
            )}

            {pieceSummary && (
              <div className="rounded-md border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Decisões por peça</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(pieceSummary).map(([k, v]) => (
                    <Badge key={k} variant="outline" className="text-xs">
                      {STATUS_LABEL[k] ?? k}: {v}
                    </Badge>
                  ))}
                </div>
                <ul className="space-y-1.5 text-sm">
                  {items!
                    .filter((it) => it.comment || it.decision !== "pendente")
                    .map((it, idx) => (
                      <li key={it.id} className="rounded border-l-2 border-border pl-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Peça {idx + 1}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {STATUS_LABEL[it.decision] ?? it.decision}
                          </Badge>
                        </div>
                        {it.comment && <p className="mt-0.5 whitespace-pre-wrap text-xs">{it.comment}</p>}
                      </li>
                    ))}
                  {items!.every((it) => !it.comment && it.decision === "pendente") && (
                    <li className="text-xs text-muted-foreground">Nenhuma decisão individual registrada.</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setHistoryOpen((v) => !v)}>
                <History className="mr-1.5 h-4 w-4" />
                {historyOpen ? "Ocultar histórico" : "Ver histórico"}
              </Button>
              {!latest.revoked_at && latest.status !== "link_revogado" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => revoke.mutate(latest.id)}
                  disabled={revoke.isPending}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />Revogar link atual
                </Button>
              )}
            </div>

            {historyOpen && (
              <div className="rounded-md border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Histórico</p>
                {!events?.length ? (
                  <p className="text-xs text-muted-foreground">Sem eventos.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {events.map((ev) => (
                      <li key={ev.id} className="flex items-start gap-2">
                        <span className="text-muted-foreground">{formatDateTime(ev.created_at)}</span>
                        <span>{EVENT_LABEL[ev.event_type] ?? ev.event_type}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {approvals.length > 1 && (
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
                  Links anteriores ({approvals.length - 1})
                </summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {approvals.slice(1).map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      {statusBadge(a.status)}
                      <span className="text-muted-foreground">
                        {formatDateTime(a.created_at)} · {a.view_count} visualização(ões)
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
