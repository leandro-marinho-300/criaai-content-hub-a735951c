// Dialog para criar/editar publicação (avulsa ou a partir de projeto).
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APPROVAL_LABELS, APPROVAL_STATUSES, CHANNEL_LABELS, CHANNELS, SCHEDULE_STATUSES, STATUS_LABELS, type ScheduleStatus, type ApprovalStatus, type ChannelKind } from "@/lib/calendar";
import { upsertScheduleItem } from "@/lib/scheduleQueries";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { derivePublicationUnits } from "@/lib/publicationUnits";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate?: string | null;
  initialProjectId?: string | null;
}

export function ScheduleFormDialog({ open, onOpenChange, initialDate, initialProjectId }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"projeto" | "avulsa">(initialProjectId ? "projeto" : "projeto");
  const [brandId, setBrandId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>(initialProjectId ?? "");
  const [unitKey, setUnitKey] = useState<string>("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<string>("");
  const [channel, setChannel] = useState<ChannelKind | "">("");
  const [date, setDate] = useState<string>(initialDate ?? "");
  const [time, setTime] = useState<string>("");
  const [status, setStatus] = useState<ScheduleStatus>("agendado");
  const [approval, setApproval] = useState<ApprovalStatus | "">("");
  const [notes, setNotes] = useState("");

  useEffect(() => { if (initialDate) setDate(initialDate); }, [initialDate]);
  useEffect(() => { if (initialProjectId) { setProjectId(initialProjectId); setTab("projeto"); } }, [initialProjectId]);

  const { data: brands } = useQuery({
    queryKey: ["brands-light-cal"],
    queryFn: async () => (await supabase.from("brands").select("id, name").order("name")).data ?? [],
  });
  const { data: projects } = useQuery({
    queryKey: ["projects-light-cal", brandId],
    queryFn: async () => {
      let q = supabase.from("content_projects").select("id, internal_title, display_title, theme, main_message, brand_id, selected_formats").order("updated_at", { ascending: false }).limit(60);
      if (brandId) q = q.eq("brand_id", brandId);
      return (await q).data ?? [];
    },
    enabled: tab === "projeto",
  });
  const { data: projectDetail } = useQuery({
    queryKey: ["project-detail-cal", projectId],
    queryFn: async () => {
      const { data: p } = await supabase.from("content_projects").select("*").eq("id", projectId).single();
      const { data: outs } = await supabase.from("content_outputs").select("*").eq("project_id", projectId).order("display_order");
      return { project: p, outputs: outs ?? [] };
    },
    enabled: !!projectId,
  });

  const units = projectDetail?.project ? derivePublicationUnits(projectDetail.project, projectDetail.outputs ?? []) : [];

  useEffect(() => {
    if (units.length && !unitKey) {
      const u = units[0];
      setUnitKey(u.unitKey);
      setFormat(u.format);
      setChannel(u.channelSuggestion);
      setTitle(u.title);
      if (projectDetail?.project?.brand_id) setBrandId(projectDetail.project.brand_id);
    }
  }, [units, unitKey, projectDetail]);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Faça login.");
      if (tab === "projeto" && !projectId) throw new Error("Selecione um projeto.");
      const unit = units.find((x) => x.unitKey === unitKey);
      const finalProjectId = projectId;
      if (!finalProjectId) throw new Error("Selecione um projeto. Para publicações avulsas, crie o conteúdo antes.");
      const finalTitle = title || unit?.title || "Publicação";
      const defaultTitle = unit?.title ?? "";
      const overrideFlag = !!title && title !== defaultTitle;
      return upsertScheduleItem({
        user_id: u.user.id,
        project_id: finalProjectId,
        brand_id: brandId || null,
        publication_unit: unit?.unitKey ?? `${finalProjectId}:manual:${Date.now()}`,
        format: format || unit?.format || null,
        channel: (channel || unit?.channelSuggestion || null) as ChannelKind | null,
        title: finalTitle,
        title_override: overrideFlag,
        confirmed_date: date || null,
        confirmed_time: time || null,
        schedule_status: status,
        approval_status: approval || null,
        internal_notes: notes || null,
        outputs: unit?.outputIds ?? [],
      });
    },
    onSuccess: () => {
      toast.success("Publicação criada.");
      qc.invalidateQueries({ queryKey: ["schedule-items"] });
      qc.invalidateQueries({ queryKey: ["undated-projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard-schedule"] });
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error("Falha ao criar", { description: e.message }),
  });

  function reset() {
    setProjectId(""); setUnitKey(""); setTitle(""); setFormat(""); setChannel("");
    setDate(""); setTime(""); setStatus("agendado"); setApproval(""); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova publicação</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projeto">A partir de projeto</TabsTrigger>
            <TabsTrigger value="avulsa">Avulsa</TabsTrigger>
          </TabsList>
          <TabsContent value="projeto" className="space-y-3 pt-3">
            <Field label="Marca (filtro opcional)">
              <Select value={brandId || "all"} onValueChange={(v) => setBrandId(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todas marcas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(brands ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Projeto">
              <Select value={projectId} onValueChange={(v) => { setProjectId(v); setUnitKey(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.internal_title ?? "Sem título"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {units.length > 1 && (
              <Field label="Unidade de publicação">
                <Select value={unitKey} onValueChange={(v) => {
                  setUnitKey(v);
                  const u = units.find((x) => x.unitKey === v);
                  if (u) { setFormat(u.format); setChannel(u.channelSuggestion); setTitle(u.title); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => <SelectItem key={u.unitKey} value={u.unitKey}>{u.formatLabel} ({u.outputIds.length} peça(s))</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </TabsContent>
          <TabsContent value="avulsa" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Publicações avulsas exigem vincular a um projeto existente. Crie o conteúdo na seção "Novo Conteúdo" antes de agendar.
            </p>
            <Field label="Projeto">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.internal_title ?? "Sem título"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </TabsContent>
        </Tabs>

        <div className="space-y-3 pt-2">
          <Field label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Formato">
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Canal">
              <Select value={channel} onValueChange={(v) => setChannel(v as ChannelKind)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Horário"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as ScheduleStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHEDULE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Aprovação">
              <Select value={approval} onValueChange={(v) => setApproval(v as ApprovalStatus)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{APPROVAL_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Observações"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Criar publicação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
