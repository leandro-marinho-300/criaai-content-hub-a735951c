import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Heart,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Star,
  PenSquare,
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

// Map output keys → "Instrução para …" display titles
const BLOCK_TITLE_OVERRIDES: Record<string, string> = {
  estrategia: "Instrução para criar a estratégia",
  conceito: "Instrução para criar o conceito",
  textos_artes: "Instrução para gerar os textos das artes",
  layouts: "Instrução para desenvolver os layouts",
  carrossel: "Instrução para desenvolver o carrossel",
  stories: "Instrução para desenvolver os Stories",
  roteiro_reel: "Instrução para o roteiro do Reel",
  legenda_curta: "Instrução para gerar as legendas",
  legenda_media: "Instrução para gerar as legendas",
  legenda_completa: "Instrução para gerar as legendas",
  whatsapp: "Instrução para gerar a versão de WhatsApp",
  hashtags: "Instrução para selecionar hashtags",
  engajamento: "Instrução para criar recursos de engajamento",
  prompt_visual: "Instrução para produzir o prompt visual",
  texto_alternativo: "Instrução para gerar texto alternativo",
  checklist: "Instrução de revisão final",
};

const displayBlockTitle = (key: string, fallback: string) =>
  BLOCK_TITLE_OVERRIDES[key] ?? fallback;

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
    .map((o) => `## ${displayBlockTitle(o.output_type, o.title)}\n${o.edited_content ?? o.original_content}`)
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

  const copyAndOpenChatGPT = async () => {
    try {
      await navigator.clipboard.writeText(masterPrompt);
      toast.success("Prompt copiado. Agora cole no ChatGPT e envie.");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Use o botão Copiar.");
    }
    window.open("https://chat.openai.com/", "_blank", "noopener,noreferrer");
  };

  const flowSteps = [
    { n: 1, label: "Copiar prompt" },
    { n: 2, label: "Abrir ferramenta de IA" },
    { n: 3, label: "Colar e enviar" },
    { n: 4, label: "Receber o conteúdo final" },
  ];

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
            <p className="text-sm text-muted-foreground">Pronto para copiar e usar no ChatGPT ou outra ferramenta de IA.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => toggleFavorite.mutate()} aria-label="Favoritar">
            <Heart className={`h-5 w-5 ${data.project.is_favorite ? "fill-primary text-primary" : ""}`} />
          </Button>
        </div>

        {/* "Seu prompt está pronto" — destaque pedagógico */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg gradient-brand">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">Seu prompt está pronto</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  O conteúdo final ainda não foi criado. Copie o prompt abaixo e cole no ChatGPT ou em outra
                  ferramenta de IA. A ferramenta escolhida produzirá os textos, layouts, legendas, hashtags e
                  demais materiais solicitados.
                </p>
              </div>
            </div>

            <ol className="grid gap-2 sm:grid-cols-4">
              {flowSteps.map((s) => (
                <li key={s.n} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 p-2 text-xs">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{s.n}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton text={masterPrompt} label="Copiar prompt completo" variant="default" />
              <Button onClick={copyAndOpenChatGPT} variant="secondary" size="sm" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                Copiar e abrir ChatGPT
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/app/content/new"><PenSquare className="mr-2 h-4 w-4" />Voltar e melhorar briefing</Link>
              </Button>
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
  const title = displayBlockTitle(block.output_type, block.title);

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
          <div className="min-w-0 space-y-1">
            <Badge variant="outline" className="text-[10px]">Parte do prompt</Badge>
            <h3 className="truncate font-display text-lg font-semibold">{title}</h3>
          </div>
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
