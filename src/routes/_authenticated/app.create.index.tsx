import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Lightbulb,
  PenSquare,
  RefreshCw,
  Layers,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Film,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OBJECTIVE_LABELS } from "@/lib/promptBuilder";
import {
  CREATIVE_PATHS,
  rankPathsByObjective,
  type CreativePath,
} from "@/lib/creativePaths";
import type { IdeaObjective } from "@/lib/ideaTaxonomy";

type Mode = "hub" | "tema" | "adaptar" | "campanha";

export const Route = createFileRoute("/_authenticated/app/create/")({
  head: () => ({ meta: [{ title: "Criar conteúdo — Cria Aí" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    mode: typeof s.mode === "string" ? (s.mode as Mode) : undefined,
  }),
  component: CreateHub,
});

function CreateHub() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const initialMode: Mode = search.mode ?? "hub";
  const [mode, setMode] = useState<Mode>(initialMode);

  if (mode === "tema") {
    return <ModeTema onBack={() => setMode("hub")} />;
  }
  if (mode === "adaptar") {
    return <ComingSoon
      title="Adaptar conteúdo"
      description="Selecionar projeto, ideia ou peça anterior e transformá-los em novos formatos — sem copiar literalmente."
      onBack={() => setMode("hub")}
      fallbackHref="/app/library"
      fallbackLabel="Abrir biblioteca"
    />;
  }
  if (mode === "campanha") {
    return <ComingSoon
      title="Campanha completa"
      description="Desenvolver uma ideia central e suas adaptações para vários canais com funções diferentes por peça."
      onBack={() => setMode("hub")}
      fallbackHref="/app/content/new"
      fallbackLabel="Abrir wizard atual"
    />;
  }

  return <Hub onPick={(m) => {
    if (m === "ideias") navigate({ to: "/app/ideas" });
    else if (m === "reel") navigate({ to: "/app/create/reel" });
    else if (m === "tema") navigate({ to: "/app/central" });
    else setMode(m);
  }} />;
}

function Hub({ onPick }: { onPick: (m: "ideias" | "tema" | "adaptar" | "campanha" | "reel") => void }) {
  const cards: Array<{
    id: "ideias" | "tema" | "adaptar" | "campanha" | "reel";
    icon: typeof Lightbulb;
    title: string;
    desc: string;
    badge?: string;
  }> = [
    {
      id: "ideias",
      icon: Lightbulb,
      title: "Estou sem ideias",
      desc: "Escolha uma marca e receba caminhos de conteúdo para começar.",
    },
    {
      id: "reel",
      icon: Film,
      title: "Criar Reel 2.0",
      desc: "Fluxo guiado para construir gancho, promessa e estrutura antes do roteiro.",
      badge: "Novo",
    },
    {
      id: "tema",
      icon: PenSquare,
      title: "Já tenho um tema",
      desc: "Informe o assunto e veja diferentes caminhos editoriais antes de desenvolver.",
    },
    {
      id: "adaptar",
      icon: RefreshCw,
      title: "Quero adaptar um conteúdo",
      desc: "Transforme um conteúdo anterior em novos formatos ou abordagens.",
      badge: "Em breve",
    },
    {
      id: "campanha",
      icon: Layers,
      title: "Quero criar uma campanha completa",
      desc: "Desenvolva uma ideia central e suas adaptações para vários canais.",
      badge: "Em breve",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary" className="rounded-full">Oficina Criativa</Badge>
        <h1 className="text-2xl font-bold sm:text-3xl">Como você quer começar?</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o ponto de partida que combina com o seu momento. Você pode começar do zero,
          a partir de um tema, adaptar algo que já existe ou planejar uma campanha completa.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              if (c.id === "reel") {
                onPick("reel");
                return;
              }
              onPick(c.id);
            }}
            className="group grid grid-cols-[auto_1fr_auto] items-start gap-4 rounded-2xl border border-border/60 bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-lg"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <c.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{c.title}</p>
                {c.badge && <Badge variant="outline" className="text-[10px]">{c.badge}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </button>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <span className="text-muted-foreground">
            Prefere ir direto ao briefing tradicional?
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/content/new">
              Abrir wizard <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ModeTema({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [brandId, setBrandId] = useState<string>("");
  const [theme, setTheme] = useState("");
  const [objective, setObjective] = useState<IdeaObjective | "">("");

  const { data: brands } = useQuery({
    queryKey: ["brands-light-create"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Tables<"brands">, "id" | "name">[];
    },
  });

  const ranked = useMemo(() => rankPathsByObjective(objective || undefined), [objective]);
  const themeTrim = theme.trim();
  const canPickPath = brandId && themeTrim.length >= 3;

  const goToWizard = (path: CreativePath) => {
    // Sinaliza o caminho criativo escolhido para o wizard via storage.
    try {
      const prefill: Record<string, unknown> = {
        brand_id: brandId,
        theme: themeTrim,
        objective: objective || "",
        desired_style: path.openingStyle,
        call_to_action: path.suggestedCta,
        internal_title: `${path.label} — ${themeTrim}`,
        selected_formats: path.suggestedFormats.slice(0, 1),
        notes: `Caminho criativo: ${path.label}`,
      };
      localStorage.setItem("cria-wizard-prefill", JSON.stringify(prefill));
    } catch {}
    navigate({ to: "/app/content/new" });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">
          ← Voltar aos caminhos
        </button>
        <h1 className="text-2xl font-bold sm:text-3xl">Já tenho um tema</h1>
        <p className="text-sm text-muted-foreground">
          Informe o assunto principal. O Cria Aí mostra diferentes caminhos editoriais
          para você escolher antes de desenvolver as peças.
        </p>
      </header>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Marca</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(brands ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tema principal</Label>
            <Input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex.: destinos nacionais para o segundo semestre"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Objetivo (opcional — usado para priorizar os caminhos)</Label>
            <Select value={objective} onValueChange={(v) => setObjective(v as IdeaObjective)}>
              <SelectTrigger><SelectValue placeholder="Sem preferência" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="qualquer">Sem preferência</SelectItem>
                {Object.entries(OBJECTIVE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Caminhos editoriais</h2>
          {!canPickPath && (
            <p className="text-xs text-muted-foreground">
              Selecione a marca e informe um tema para ativar.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {ranked.map((path) => {
            const recommended = objective && objective !== "qualquer"
              ? path.recommendedObjectives.includes(objective as IdeaObjective)
              : false;
            return (
              <Card
                key={path.id}
                className={recommended ? "border-primary/50" : "border-border/60"}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{path.label}</p>
                        {recommended && (
                          <Badge variant="default" className="text-[10px]">Recomendado</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{path.description}</p>
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Prévia de título
                    </p>
                    <p className="mt-1 font-medium">
                      {themeTrim
                        ? path.previewTitle(themeTrim)
                        : "Informe um tema para ver a prévia."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">Abertura típica</p>
                      <p>{path.openingStyle}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">CTA sugerido</p>
                      <p>{path.suggestedCta}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-wrap gap-1">
                      {path.suggestedFormats.slice(0, 3).map((f) => (
                        <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      disabled={!canPickPath}
                      onClick={() => goToWizard(path)}
                      className="gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Desenvolver
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ComingSoon({
  title,
  description,
  onBack,
  fallbackHref,
  fallbackLabel,
}: {
  title: string;
  description: string;
  onBack: () => void;
  fallbackHref: string;
  fallbackLabel: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">
        ← Voltar aos caminhos
      </button>
      <Card>
        <CardContent className="space-y-4 p-6">
          <Badge variant="outline">Em breve</Badge>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">
            Esta etapa será liberada nas próximas fases da Oficina Criativa. Enquanto isso,
            você pode usar o fluxo atual.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={fallbackHref}>{fallbackLabel}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/content/new">Abrir wizard de conteúdo</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
