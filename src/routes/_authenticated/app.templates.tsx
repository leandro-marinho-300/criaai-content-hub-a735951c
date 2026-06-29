import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/tag-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/templates")({
  head: () => ({ meta: [{ title: "Modelos — Cria Aí" }] }),
  component: TemplatesPage,
});

type Template = Tables<"prompt_templates">;

function TemplatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["prompt_templates"],
    queryFn: async () => {
      // System templates: listed via catalog view (template_content not exposed).
      // Own templates: fetched directly so editing can show template_content.
      const [sysRes, ownRes] = await Promise.all([
        supabase
          .from("prompt_templates_catalog")
          .select("*")
          .eq("is_system_template", true)
          .order("name"),
        supabase
          .from("prompt_templates")
          .select("*")
          .eq("is_system_template", false)
          .order("name"),
      ]);
      if (sysRes.error) throw sysRes.error;
      if (ownRes.error) throw ownRes.error;
      return [...(sysRes.data ?? []), ...(ownRes.data ?? [])] as Template[];
    },
  });



  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prompt_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modelo excluído.");
      qc.invalidateQueries({ queryKey: ["prompt_templates"] });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Modelos de conteúdo</h1>
          <p className="text-sm text-muted-foreground">Reutilize estruturas prontas para acelerar briefings.</p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="mr-2 h-4 w-4" />Novo modelo</Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((t) => (
            <Card key={t.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{t.name}</p>
                    {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  </div>
                  {t.is_system_template ? (
                    <Badge variant="outline">Sistema</Badge>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
                {t.recommended_formats?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.recommended_formats.map((f) => <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateDialog
        open={openNew || !!editing}
        initial={editing}
        onClose={() => { setOpenNew(false); setEditing(null); }}
      />
    </div>
  );
}

function TemplateDialog({ open, initial, onClose }: { open: boolean; initial: Template | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [objective, setObjective] = useState(initial?.objective ?? "");
  const [recommended_formats, setRF] = useState<string[]>(initial?.recommended_formats ?? []);
  const [suggested_fields, setSF] = useState<string[]>(initial?.suggested_fields ?? []);
  const [template_content, setTC] = useState(initial?.template_content ?? "");

  useState(() => {});
  // sync when initial changes
  if (open) {
    // noop
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const payload = { name, description, objective, recommended_formats, suggested_fields, template_content };
      if (initial && !initial.is_system_template) {
        const { error } = await supabase.from("prompt_templates").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prompt_templates").insert({ ...payload, user_id: u.user.id, is_system_template: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Modelo salvo.");
      qc.invalidateQueries({ queryKey: ["prompt_templates"] });
      onClose();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{initial ? "Editar modelo" : "Novo modelo"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea rows={2} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-2"><Label>Objetivo (chave)</Label><Input value={objective ?? ""} onChange={(e) => setObjective(e.target.value)} placeholder="ex.: divulgar_servico" /></div>
          <div className="space-y-2"><Label>Formatos recomendados</Label><TagInput value={recommended_formats} onChange={setRF} /></div>
          <div className="space-y-2"><Label>Campos sugeridos</Label><TagInput value={suggested_fields} onChange={setSF} /></div>
          <div className="space-y-2"><Label>Estrutura do prompt</Label><Textarea rows={6} value={template_content} onChange={(e) => setTC(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><X className="mr-2 h-4 w-4" />Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!name.trim() || !template_content.trim()}><Save className="mr-2 h-4 w-4" />Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
