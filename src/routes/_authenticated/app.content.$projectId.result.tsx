import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Heart,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/app/content/$projectId/result")({
  head: () => ({ meta: [{ title: "Resultado — Cria Aí" }] }),
  component: ResultPage,
});

function ResultPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["project-result", projectId],
    queryFn: async () => {
      const { data: project, error } = await supabase
        .from("content_projects").select("*, brands(name, logo_url)").eq("id", projectId).single();
      if (error) throw error;
      const { data: outputs, error: e2 } = await supabase
        .from("content_outputs").select("*").eq("project_id", projectId).order("display_order");
      if (e2) throw e2;
      return { project: project as Tables<"content_projects"> & { brands: { name: string; logo_url: string | null } | null }, outputs: outputs as Tables<"content_outputs">[] };
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("content_projects").update({ status }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-result", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success("Status atualizado.");
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const { error } = await supabase.from("content_projects").update({ is_favorite: !data.project.is_favorite }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-result", projectId] }),
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      if (!data) return null;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { id, created_at, updated_at, brands, ...rest } = data.project as Tables<"content_projects"> & { brands: unknown };
      void id; void created_at; void updated_at; void brands;
      const { data: np, error } = await supabase.from("content_projects").insert({ ...rest, internal_title: `${rest.internal_title ?? "Projeto"} (cópia)`, status: "draft", is_favorite: false, user_id: u.user.id }).select("id").single();
      if (error) throw error;
      const rows = data.outputs.map((o) => ({
        project_id: np.id, user_id: u.user!.id, output_type: o.output_type, title: o.title,
        original_content: o.original_content, edited_content: null, display_order: o.display_order,
      }));
      if (rows.length) await supabase.from("content_outputs").insert(rows);
      return np.id as string;
    },
    onSuccess: (id) => {
      if (id) {
        toast.success("Projeto duplicado.");
        window.location.href = `/app/content/${id}/result`;
      }
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!data) return <p>Projeto não encontrado.</p>;

  const masterPrompt = data.outputs
    .map((o) => `## ${o.title}\n${o.edited_content ?? o.original_content}`)
    .join("\n\n---\n\n");

  const exportTxt = () => {
    const blob = new Blob([masterPrompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.project.internal_title || "cria-ai").replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/library"><ArrowLeft className="mr-2 h-4 w-4" />Biblioteca</Link>
        </Button>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <Badge variant="outline" className="mb-2">{data.project.brands?.name ?? "Sem marca"}</Badge>
            <h1 className="truncate text-2xl font-bold">{data.project.internal_title || "Pacote de prompts"}</h1>
            <p className="text-sm text-muted-foreground">Pronto para copiar e usar no ChatGPT ou outra ferramenta.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => toggleFavorite.mutate()} aria-label="Favoritar">
            <Heart className={`h-5 w-5 ${data.project.is_favorite ? "fill-primary text-primary" : ""}`} />
          </Button>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="grid items-center gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg gradient-brand">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">Prompt mestre completo</p>
                <p className="truncate text-xs text-muted-foreground">{data.outputs.length} blocos · cole no seu gerador</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={masterPrompt} label="Copiar prompt completo" variant="default" />
              <Button variant="outline" size="sm" onClick={exportTxt}><Download className="mr-2 h-4 w-4" />TXT</Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => duplicate.mutate()}><Copy className="mr-2 h-4 w-4" />Duplicar</Button>
          <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("approved")}><CheckCircle2 className="mr-2 h-4 w-4" />Marcar como aprovado</Button>
          <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("published")}><Send className="mr-2 h-4 w-4" />Marcar como publicado</Button>
          <Badge variant="secondary" className="ml-auto">Status: {statusLabel(data.project.status)}</Badge>
        </div>
      </header>

      <section className="space-y-4">
        {data.outputs.map((o) => <BlockCard key={o.id} block={o} />)}
      </section>
    </div>
  );
}

function statusLabel(s: string) {
  return ({ draft: "Rascunho", review: "Em revisão", approved: "Aprovado", published: "Publicado", archived: "Arquivado" } as Record<string, string>)[s] ?? s;
}

function BlockCard({ block }: { block: Tables<"content_outputs"> }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.edited_content ?? block.original_content);
  const display = block.edited_content ?? block.original_content;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_outputs").update({ edited_content: draft }).eq("id", block.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bloco salvo.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["project-result", block.project_id] });
    },
  });

  const restore = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_outputs").update({ edited_content: null }).eq("id", block.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Restaurado ao texto original.");
      setDraft(block.original_content);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["project-result", block.project_id] });
    },
  });

  const fav = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_outputs").update({ is_favorite: !block.is_favorite }).eq("id", block.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-result", block.project_id] }),
  });

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h3 className="truncate font-display text-lg font-semibold">{block.title}</h3>
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="icon" onClick={() => fav.mutate()} aria-label="Favoritar bloco">
              <Star className={`h-4 w-4 ${block.is_favorite ? "fill-primary text-primary" : ""}`} />
            </Button>
            <CopyButton text={display} variant="ghost" size="icon" label="" />
            {!editing ? (
              <Button variant="ghost" size="icon" onClick={() => { setDraft(display); setEditing(true); }} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="icon" onClick={() => save.mutate()} aria-label="Salvar">
                  <Save className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => restore.mutate()} aria-label="Restaurar">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-3">
          {editing ? (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.min(20, Math.max(6, draft.split("\n").length + 1))} className="font-mono text-sm" />
          ) : (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-4 text-sm leading-relaxed">{display}</pre>
          )}
          {block.edited_content && !editing && <p className="mt-2 text-xs text-muted-foreground">Texto editado por você.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
