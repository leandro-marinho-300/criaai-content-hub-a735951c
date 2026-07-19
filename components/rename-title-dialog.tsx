// Modal de edição/renomeação do título de exibição do projeto.
// Atualiza somente display_title — não regenera briefing, peças, copy, prompts.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DISPLAY_TITLE_MAX, getProjectDisplayTitle, validateDisplayTitle, type DisplayTitleSource } from "@/lib/displayTitle";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  project: DisplayTitleSource | null | undefined;
  onSaved?: (newTitle: string) => void;
}

export function RenameTitleDialog({ open, onOpenChange, projectId, project, onSaved }: Props) {
  const qc = useQueryClient();
  const initial = getProjectDisplayTitle(project);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setValue(initial); setError(null); } }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      const v = validateDisplayTitle(value);
      if (!v.ok) throw new Error(v.error);
      const { error: e1 } = await supabase
        .from("content_projects")
        .update({
          display_title: v.trimmed,
          title_updated_at: new Date().toISOString(),
          title_source: "manual",
        })
        .eq("id", projectId);
      if (e1) throw e1;
      // Sincroniza agendamentos sem override.
      await supabase
        .from("publication_schedule_items")
        .update({ title: v.trimmed })
        .eq("project_id", projectId)
        .eq("title_override", false);
      return v.trimmed;
    },
    onSuccess: (newTitle) => {
      toast.success("Título atualizado.");
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["project-result", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["schedule-items"] });
      qc.invalidateQueries({ queryKey: ["dashboard-schedule"] });
      onSaved?.(newTitle);
      onOpenChange(false);
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error("Não foi possível salvar", { description: e.message });
    },
  });

  const v = validateDisplayTitle(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear conteúdo</DialogTitle>
          <DialogDescription>
            Apenas a identificação curta é alterada. Briefing, peças, copy e prompts permanecem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="display-title">Título</Label>
            <Input
              id="display-title"
              autoFocus
              value={value}
              maxLength={DISPLAY_TITLE_MAX + 20}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && v.ok) save.mutate(); }}
            />
            <div className="flex items-center justify-between text-xs">
              <span className={error ? "text-destructive" : "text-muted-foreground"}>
                {error ?? (v.ok ? "Pronto para salvar." : v.error ?? "")}
              </span>
              <span className="text-muted-foreground">{value.trim().length}/{DISPLAY_TITLE_MAX}</span>
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Prévia</p>
            <p className="mt-1 line-clamp-2 break-words text-sm font-medium">
              {v.trimmed || "—"}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!v.ok || save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar título"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
