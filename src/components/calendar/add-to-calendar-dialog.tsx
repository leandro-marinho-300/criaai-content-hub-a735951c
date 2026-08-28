// Dialog para adicionar peças de um projeto ao calendário.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHANNEL_LABELS, CHANNELS, type ChannelKind } from "@/lib/calendar";
import { derivePublicationUnits, type PublicationUnit } from "@/lib/publicationUnits";
import { upsertScheduleItem } from "@/lib/scheduleQueries";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveCalendarV2Readiness } from "@/lib/creation/operational-integration";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
}

interface UnitDraft extends PublicationUnit {
  selected: boolean;
  date: string;
  time: string;
  channel: ChannelKind;
}

export function AddToCalendarDialog({ open, onOpenChange, projectId }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<UnitDraft[]>([]);

  const { data: v2Readiness, isLoading: readinessLoading } = useQuery({
    queryKey: ["calendar-v2-readiness", projectId],
    queryFn: () => resolveCalendarV2Readiness(projectId),
    enabled: open && !!projectId,
  });

  const { data: detail } = useQuery({
    queryKey: ["add-cal-project", projectId],
    queryFn: async () => {
      const { data: p } = await supabase.from("content_projects").select("*").eq("id", projectId).single();
      const { data: outs } = await supabase.from("content_outputs").select("*").eq("project_id", projectId).order("display_order");
      return { project: p, outputs: outs ?? [] };
    },
    enabled: open && !!projectId,
  });

  useEffect(() => {
    if (!detail?.project) return;
    const units = derivePublicationUnits(detail.project, detail.outputs ?? []);
    setDrafts(units.map((u) => ({ ...u, selected: true, date: "", time: "", channel: u.channelSuggestion })));
  }, [detail]);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Faça login.");
      const project = detail?.project;
      if (!project) throw new Error("Projeto não encontrado.");
      const selected = drafts.filter((d) => d.selected);
      if (!selected.length) throw new Error("Selecione ao menos uma unidade.");
      for (const d of selected) {
        await upsertScheduleItem({
          user_id: u.user.id,
          project_id: project.id,
          brand_id: project.brand_id,
          publication_unit: d.unitKey,
          format: d.format,
          channel: d.channel,
          title: d.title,
          confirmed_date: d.date || null,
          confirmed_time: d.time || null,
          suggested_date: d.date || null,
          suggested_time: d.time || null,
          schedule_status: d.date ? "agendado" : "sem_data",
          approval_status: "nao_enviado",
          outputs: d.outputIds,
          bindApprovedV2Asset: true,
        });
      }
    },
    onSuccess: () => {
      toast.success("Adicionado ao calendário.");
      qc.invalidateQueries({ queryKey: ["schedule-items"] });
      qc.invalidateQueries({ queryKey: ["undated-projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard-schedule"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Falha", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar ao calendário</DialogTitle>
          <DialogDescription>
            Cada formato vira uma unidade de publicação. Carrossel/sequência viram um único item.
          </DialogDescription>
        </DialogHeader>
        {v2Readiness?.isV2 && (
          <div
            className={`rounded-md border p-3 text-sm ${
              v2Readiness.canBindApprovedAsset
                ? "border-border/60 bg-muted/30 text-muted-foreground"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {v2Readiness.message}
          </div>
        )}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {drafts.map((d, i) => (
            <div key={d.unitKey} className="rounded-lg border border-border/60 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={d.selected}
                  onCheckedChange={(c) => setDrafts((prev) => prev.map((x, j) => j === i ? { ...x, selected: !!c } : x))}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{FORMAT_LABELS[d.format] ?? d.format} · {d.outputIds.length} peça(s)</p>
                </div>
              </div>
              {d.selected && (
                <div className="grid grid-cols-3 gap-2 pl-6">
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={d.date} onChange={(e) => setDrafts((prev) => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label className="text-xs">Horário</Label>
                    <Input type="time" value={d.time} onChange={(e) => setDrafts((prev) => prev.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label className="text-xs">Canal</Label>
                    <Select value={d.channel} onValueChange={(v) => setDrafts((prev) => prev.map((x, j) => j === i ? { ...x, channel: v as ChannelKind } : x))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!drafts.length && <p className="text-sm text-muted-foreground">Nenhuma unidade de publicação detectada.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={
              mut.isPending ||
              readinessLoading ||
              !drafts.some((d) => d.selected) ||
              (!!v2Readiness?.isV2 && !v2Readiness.canBindApprovedAsset)
            }
          >
            Adicionar selecionados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
