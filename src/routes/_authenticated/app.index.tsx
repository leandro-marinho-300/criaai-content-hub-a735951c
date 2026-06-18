import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Briefcase,
  FileText,
  CheckCircle2,
  Send,
  Heart,
  Image as ImageIcon,
  Layers,
  Smartphone,
  Film,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Início — Cria Aí" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [brandsRes, draftsRes, approvedRes, publishedRes, favRes, recentRes] = await Promise.all([
        supabase.from("brands").select("id", { count: "exact", head: true }),
        supabase.from("content_projects").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("content_projects").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("content_projects").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("content_projects").select("id", { count: "exact", head: true }).eq("is_favorite", true),
        supabase.from("content_projects").select("id, internal_title, status, updated_at, brand_id, brands(name)").order("updated_at", { ascending: false }).limit(6),
      ]);
      return {
        brands: brandsRes.count ?? 0,
        drafts: draftsRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        published: publishedRes.count ?? 0,
        favorites: favRes.count ?? 0,
        recent: (recentRes.data ?? []) as Array<{
          id: string;
          internal_title: string | null;
          status: string;
          updated_at: string;
          brand_id: string | null;
          brands: { name: string } | null;
        }>,
      };
    },
  });

  const tiles = [
    { label: "Marcas", value: stats?.brands ?? 0, icon: Briefcase },
    { label: "Rascunhos", value: stats?.drafts ?? 0, icon: FileText },
    { label: "Aprovados", value: stats?.approved ?? 0, icon: CheckCircle2 },
    { label: "Publicados", value: stats?.published ?? 0, icon: Send },
    { label: "Favoritos", value: stats?.favorites ?? 0, icon: Heart },
  ];

  const shortcuts = [
    { label: "Post", icon: ImageIcon, format: "post" },
    { label: "Carrossel", icon: Layers, format: "carrossel" },
    { label: "Stories", icon: Smartphone, format: "story" },
    { label: "Reel", icon: Film, format: "reel" },
    { label: "WhatsApp", icon: MessageCircle, format: "whatsapp" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 sm:p-8">
        <div className="gradient-brand absolute inset-0 opacity-10" />
        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-3">
            <Badge variant="secondary" className="rounded-full">Estúdio</Badge>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Está sem criatividade hoje?
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Escolha uma marca, preencha o briefing e deixe o Cria Aí organizar suas ideias em um pacote completo de prompts.
            </p>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link to="/app/content/new">
              <Plus className="h-4 w-4" />
              Criar novo conteúdo
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
                <t.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none">{t.value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{t.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atalhos rápidos</h2>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {shortcuts.map((s) => (
            <Link
              key={s.label}
              to="/app/content/new"
              className="group rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-lg"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">Iniciar briefing</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Conteúdos recentes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/library">Ver biblioteca</Link>
          </Button>
        </div>
        {stats?.recent?.length ? (
          <div className="grid gap-3">
            {stats.recent.map((p) => (
              <Link
                key={p.id}
                to="/app/content/$projectId/result"
                params={{ projectId: p.id }}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.internal_title || "Sem título"}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.brands?.name ?? "Sem marca"}</p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">{statusLabel(p.status)}</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="grid place-items-center gap-2 p-10 text-center">
              <p className="text-sm text-muted-foreground">Você ainda não criou conteúdos.</p>
              <Button asChild size="sm">
                <Link to="/app/content/new">Criar o primeiro</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function statusLabel(s: string) {
  return (
    {
      draft: "Rascunho",
      review: "Em revisão",
      approved: "Aprovado",
      published: "Publicado",
      archived: "Arquivado",
    }[s] ?? s
  );
}
