// Drawer de detalhes/ações de uma publicação do calendário.
// Carregado pelo ID real do agendamento; mantém o calendário visível em caso de erro.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  APPROVAL_LABELS, APPROVAL_STATUSES, CHANNEL_LABELS, CHANNELS,
  SCHEDULE_STATUSES, STATUS_LABELS, computeIsOverdue,
  type ScheduleStatus, type ApprovalStatus, type ChannelKind,
} from "@/lib/calendar";
import {
  changeStatus, deleteScheduleItem, getScheduleItem, getScheduleItemTitle,
  markPublished, undoPublished, upsertScheduleItem,
  type ScheduleItemWithRels,
} from "@/lib/scheduleQueries";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { ExternalLink, Trash2, Send, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  scheduleItemId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ScheduleDrawer({ scheduleItemId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<ScheduleItemWithRels>>({});
  const [publishUrl, setPublishUrl] = useState("");
  const [publishNotes, setPublishNotes] = useState("");

  const { data: item, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["schedule-item", scheduleItemId],
    queryFn: () => getScheduleItem(scheduleItemId as string),
    enabled: !!scheduleItemId && open,
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["schedule-items"] });
    qc.invalidateQueries({ queryKey: ["schedule-item", scheduleItemId] });
    qc.invalidateQueries({ queryKey: ["undated-projects"] });
    qc.invalidateQueries({ queryKey: ["dashboard-schedule"] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error("Item não carregado.");
      const current = { ...item, ...draft };
      return upsertScheduleItem({
        id: current.id,
        user_id: current.user_id,
        project_id: current.project_id,
        brand_id: current.brand_id,
        publication_unit: current.publication_unit,
        channel: current.channel as ChannelKind | null,
        format: current.format,
        title: current.title,
        title_override: current.title_override ?? (draft.title !== undefined ? true : item.title_override),
        description: current.description,
        suggested_date: current.suggested_date,
        suggested_time: current.suggested_time,
        confirmed_date: current.confirmed_date,
        confirmed_time: current.confirmed_time,
        timezone: current.timezone,
        schedule_status: (current.schedule_status ?? "sem_data") as ScheduleStatus,
        approval_status: current.approval_status as ApprovalStatus | null,
        client_notes: current.client_notes,
        internal_notes: current.internal_notes,
      });
    },
    onSuccess: () => {
      toast.success("Publicação atualizada.");
      invalidate();
      setEditing(false);
      setDraft({});
    },
    onError: (e: Error) => toast.error("Falha ao salvar", { description: e.message }),
  });

  const statusMut = useMutation({
    mutationFn: (s: ScheduleStatus) => changeStatus(item as ScheduleItemWithRels, s),
    onSuccess: () => { toast.success("Status atualizado."); invalidate(); },
  });

  const publishMut = useMutation({
    mutationFn: () => markPublished(item as ScheduleItemWithRels, {
      publishedAt: new Date().toISOString(),
      url: publishUrl || null,
      notes: publishNotes || null,
    }),
    onSuccess: () => { toast.success("Marcado como publicado."); invalidate(); setPublishUrl(""); setPublishNotes(""); },
  });

  const undoMut = useMutation({
    mutationFn: () => undoPublished(item as ScheduleItemWithRels),
    onSuccess: () => { toast.success("Publicação revertida."); invalidate(); },
  });

  const delMut = useMutation({
    mutationFn: () => deleteScheduleItem((item as ScheduleItemWithRels).id),
    onSuccess: () => { toast.success("Excluído do calendário."); invalidate(); onOpenChange(false); },
  });

  const title = item ? getScheduleItemTitle(item) : "";
  const current = item ? { ...item, ...draft } : null;
  const status = (current?.schedule_status ?? "sem_data") as ScheduleStatus;
  const overdue = current ? computeIsOverdue(current as ScheduleItemWithRels) : false;
  const hasProject = !!(current?.project_id && current.content_projects);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="break-words">{title || "Detalhes da publicação"}</SheetTitle>
          <SheetDescription className="break-words">{item?.brands?.name ?? "—"}</SheetDescription>
        </SheetHeader>

        {/* LOADING */}
        {isLoading && (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {/* ERROR LOCAL */}
        {!isLoading && (error || (!item && scheduleItemId)) && (
          <div className="mt-6 space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Não foi possível carregar esta publicação.
            </p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "O registro pode ter sido removido. Atualize o calendário."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className="mr-1 h-3 w-3" />Tentar novamente
              </Button>
              <Button size="sm" variant="outline" onClick={() => { qc.invalidateQueries({ queryKey: ["schedule-items"] }); onOpenChange(false); }}>
                Atualizar calendário
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          </div>
        )}

        {/* CONTENT */}
        {!isLoading && item && current && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
              {current.format && <Badge variant="outline">{FORMAT_LABELS[current.format] ?? current.format}</Badge>}
              {current.channel && <Badge variant="outline">{CHANNEL_LABELS[current.channel as ChannelKind] ?? current.channel}</Badge>}
              {overdue && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Atrasado</Badge>}
              {current.title_override && <Badge variant="outline" className="text-[10px]">Título personalizado</Badge>}
            </div>

            {editing ? (
              <div className="space-y-3">
                <Field label="Título">
                  <Input
                    value={current.title ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value, title_override: true }))}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data sugerida">
                    <Input type="date" value={current.suggested_date ?? ""} onChange={(e) => setDraft((p) => ({ ...p, suggested_date: e.target.value || null }))} />
                  </Field>
                  <Field label="Horário sugerido">
                    <Input type="time" value={current.suggested_time ?? ""} onChange={(e) => setDraft((p) => ({ ...p, suggested_time: e.target.value || null }))} />
                  </Field>
                  <Field label="Data confirmada">
                    <Input type="date" value={current.confirmed_date ?? ""} onChange={(e) => setDraft((p) => ({ ...p, confirmed_date: e.target.value || null }))} />
                  </Field>
                  <Field label="Horário confirmado">
                    <Input type="time" value={current.confirmed_time ?? ""} onChange={(e) => setDraft((p) => ({ ...p, confirmed_time: e.target.value || null }))} />
                  </Field>
                </div>
                <Field label="Canal">
                  <Select value={current.channel ?? ""} onValueChange={(v) => setDraft((p) => ({ ...p, channel: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={status} onValueChange={(v) => setDraft((p) => ({ ...p, schedule_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Aprovação">
                  <Select value={current.approval_status ?? ""} onValueChange={(v) => setDraft((p) => ({ ...p, approval_status: v }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{APPROVAL_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Observações internas">
                  <Textarea rows={3} value={current.internal_notes ?? ""} onChange={(e) => setDraft((p) => ({ ...p, internal_notes: e.target.value }))} />
                </Field>
                <Field label="Observações do cliente">
                  <Textarea rows={2} value={current.client_notes ?? ""} onChange={(e) => setDraft((p) => ({ ...p, client_notes: e.target.value }))} />
                </Field>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft({}); }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Row label="Data sugerida" value={current.suggested_date ?? "—"} />
                <Row label="Horário sugerido" value={current.suggested_time ?? "—"} />
                <Row label="Data confirmada" value={current.confirmed_date ?? "—"} />
                <Row label="Horário confirmado" value={current.confirmed_time ?? "—"} />
                <Row label="Aprovação" value={current.approval_status ? APPROVAL_LABELS[current.approval_status as ApprovalStatus] ?? current.approval_status : "—"} />
                <Row label="Fuso horário" value={current.timezone ?? "America/Sao_Paulo"} />
                {current.internal_notes && <Row label="Notas internas" value={current.internal_notes} full />}
                {current.client_notes && <Row label="Notas do cliente" value={current.client_notes} full />}
                {current.publication_url && (
                  <Row label="URL publicada" full value={
                    <a href={current.publication_url} target="_blank" rel="noreferrer" className="text-primary underline break-all">{current.publication_url}</a>
                  } />
                )}
              </dl>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Peças vinculadas</p>
              {current.publication_schedule_outputs?.length ? (
                <ul className="space-y-1 text-sm">
                  {current.publication_schedule_outputs.map((o) => (
                    <li key={o.id} className="truncate">• {o.content_outputs?.title ?? "Peça"}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma peça vinculada.</p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Ações</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>{editing ? "Cancelar edição" : "Editar"}</Button>
                {hasProject ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/content/$projectId/result" params={{ projectId: current.project_id as string }} onClick={() => onOpenChange(false)}>
                      <ExternalLink className="mr-1 h-3 w-3" />Abrir projeto
                    </Link>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => statusMut.mutate("aprovado")} disabled={status === "aprovado"}>Aprovar</Button>
                <Button variant="outline" size="sm" onClick={() => statusMut.mutate("agendado")} disabled={status === "agendado"}>Marcar agendado</Button>
                <Button variant="outline" size="sm" onClick={() => statusMut.mutate("cancelado")} disabled={status === "cancelado"}>Cancelar publicação</Button>
                <Button variant="destructive" size="sm" onClick={() => { if (confirm("Excluir esta publicação do calendário?")) delMut.mutate(); }}>
                  <Trash2 className="mr-1 h-3 w-3" />Excluir
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Publicação real</p>
              {status === "publicado" ? (
                <div className="space-y-2">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">Marcado como publicado em {current.published_at ? new Date(current.published_at).toLocaleString("pt-BR") : "—"}.</p>
                  <Button variant="outline" size="sm" onClick={() => { if (confirm("Desfazer publicação?")) undoMut.mutate(); }}>
                    <RotateCcw className="mr-1 h-3 w-3" />Desfazer publicação
                  </Button>
                </div>
              ) : (
                <>
                  <Field label="Link da publicação (opcional)">
                    <Input value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)} placeholder="https://..." />
                  </Field>
                  <Field label="Observações">
                    <Textarea rows={2} value={publishNotes} onChange={(e) => setPublishNotes(e.target.value)} />
                  </Field>
                  <Button size="sm" className="gap-1" onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
                    <Send className="h-3 w-3" />Marcar como publicado
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Row({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}
