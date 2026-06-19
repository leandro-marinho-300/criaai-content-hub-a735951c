import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, Wand2, Star, Trash2, ArrowRight,
  Layers, Info, Lightbulb, Shuffle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";
import {
  generateIdeas, IDEA_OBJECTIVE_LABELS, IDEA_FORMAT_LABELS, IDEA_FOCUS_LABELS, IDEA_TONE_LABELS,
  type Idea, type IdeaObjective, type IdeaFormat, type IdeaFocus, type IdeaTone,
} from "@/lib/ideaGenerator";

export const Route = createFileRoute("/_authenticated/app/ideas")({
  head: () => ({ meta: [{ title: "Laboratório de Ideias — Cria Aí" }] }),
  component: IdeasLab,
});

function IdeasLab() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [brandId, setBrandId] = useState<string>("");
  const [objective, setObjective] = useState<IdeaObjective>("qualquer");
  const [format, setFormat] = useState<IdeaFormat>("auto");
  const [focus, setFocus] = useState<IdeaFocus>("qualquer");
  const [tone, setTone] = useState<IdeaTone>("marca");
  const [quantity, setQuantity] = useState<3 | 5 | 10>(5);
  const [seedBump, setSeedBump] = useState(0);
  const [sessionTitles, setSessionTitles] = useState<string[]>([]);
  const [surprise, setSurprise] = useState(false);

  const { data: brands } = useQuery({
    queryKey: ["brands-lab"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const brand = useMemo(() => brands?.find((b) => b.id === brandId) ?? null, [brands, brandId]);

  const { data: history } = useQuery({
    queryKey: ["history-for-ideas", brandId],
    enabled: !!brandId,
    queryFn: async () => {
      const { data } = await supabase
        .from("content_projects")
        .select("theme, objective, selected_formats, call_to_action")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []).map((p) => ({
        theme: p.theme,
        objective: p.objective,
        formats: p.selected_formats,
        cta: p.call_to_action,
      }));
    },
  });

  const ideas: Idea[] = useMemo(() => {
    if (!brand) return [];
    return generateIdeas({
      brand,
      objective: surprise ? "qualquer" : objective,
      format: surprise ? "auto" : format,
      focus: surprise ? "qualquer" : focus,
      tone: surprise ? "marca" : tone,
      quantity,
      history: history ?? [],
      excludeTitles: sessionTitles,
      seed: hash(brand.id + objective + format + focus + tone + quantity + seedBump + (surprise ? "s" : "")),
    });
  }, [brand, objective, format, focus, tone, quantity, history, sessionTitles, seedBump, surprise]);

  const regenerate = () => {
    setSessionTitles((prev) => [...prev, ...ideas.map((i) => i.title)]);
    setSeedBump((n) => n + 1);
  };

  const surpriseMe = () => {
    setSurprise(true);
    setSeedBump((n) => n + 1);
  };

  const { data: saved } = useQuery({
    queryKey: ["saved-ideas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_ideas")
        .select("*, brands(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const favorite = useMutation({
    mutationFn: async (idea: Idea) => {
      if (!brand) throw new Error("Selecione uma marca.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { error } = await supabase.from("content_ideas").insert({
        user_id: u.user.id,
        brand_id: brand.id,
        title: idea.title,
        theme: idea.theme,
        content_pillar: idea.content_pillar,
        objective: idea.objective,
        recommended_format: idea.recommended_format,
        angle: idea.angle,
        target_audience: idea.target_audience,
        audience_problem: idea.audience_problem,
        central_message: idea.central_message,
        hook: idea.hook,
        suggested_cta: idea.suggested_cta,
        required_information: idea.required_information,
        visual_direction: idea.visual_direction,
        reason_to_publish: idea.reason_to_publish,
        source_elements: idea.source_elements,
        novelty_score: idea.novelty_score,
        novelty_badge: idea.novelty_badge,
        template_key: idea.template_key,
        status: "favorita",
        source_type: "lab",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ideia favoritada");
      qc.invalidateQueries({ queryKey: ["saved-ideas"] });
    },
    onError: (e: Error) => toast.error("Não foi possível favoritar", { description: e.message }),
  });

  const removeSaved = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ideia removida");
      qc.invalidateQueries({ queryKey: ["saved-ideas"] });
    },
  });

  const useIdea = (idea: Idea, brandIdForUse: string) => {
    const formatKey = formatLabelToKey(idea.recommended_format);
    const prefill = {
      brand_id: brandIdForUse,
      objective: idea.objective,
      selected_formats: formatKey ? [formatKey] : [],
      internal_title: idea.title,
      theme: idea.theme,
      specific_audience: idea.target_audience,
      audience_problem: idea.audience_problem,
      main_message: idea.central_message,
      call_to_action: idea.suggested_cta,
      mandatory_information: idea.required_information.join("\n"),
      desired_style: idea.visual_direction,
      notes: `Origem: Laboratório de Ideias. Pilar: ${idea.content_pillar}. Gancho: ${idea.hook}`,
    };
    try {
      localStorage.setItem("cria-wizard-prefill", JSON.stringify(prefill));
      sessionStorage.setItem("cria-wizard-from-idea", "1");
    } catch {}
    navigate({ to: "/app/content/new" });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary" className="rounded-full"><Lightbulb className="mr-1 h-3 w-3" />Laboratório</Badge>
        <h1 className="text-2xl font-bold sm:text-3xl">Sem ideia hoje? A gente começa por você.</h1>
        <p className="text-sm text-muted-foreground">
          Escolha uma marca e receba sugestões de conteúdos com temas, abordagens e formatos baseados no que já está cadastrado.
          As sugestões são geradas a partir do seu próprio briefing — nada é inventado.
        </p>
      </header>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate"><Sparkles className="mr-2 h-4 w-4" />Gerar ideias</TabsTrigger>
          <TabsTrigger value="bank"><Star className="mr-2 h-4 w-4" />Banco de Ideias</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Marca">
                <Select value={brandId} onValueChange={(v) => { setBrandId(v); setSurprise(false); setSessionTitles([]); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma marca" /></SelectTrigger>
                  <SelectContent>
                    {(brands ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Objetivo (opcional)">
                <Select value={objective} onValueChange={(v) => { setObjective(v as IdeaObjective); setSurprise(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(IDEA_OBJECTIVE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Formato (opcional)">
                <Select value={format} onValueChange={(v) => { setFormat(v as IdeaFormat); setSurprise(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(IDEA_FORMAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Foco (opcional)">
                <Select value={focus} onValueChange={(v) => { setFocus(v as IdeaFocus); setSurprise(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(IDEA_FOCUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tom (opcional)">
                <Select value={tone} onValueChange={(v) => { setTone(v as IdeaTone); setSurprise(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(IDEA_TONE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quantidade">
                <Select value={String(quantity)} onValueChange={(v) => setQuantity(Number(v) as 3 | 5 | 10)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 ideias</SelectItem>
                    <SelectItem value="5">5 ideias</SelectItem>
                    <SelectItem value="10">10 ideias</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={regenerate} disabled={!brand} variant="default" className="gap-2">
              <RefreshCw className="h-4 w-4" />Gerar outras ideias
            </Button>
            <Button onClick={surpriseMe} disabled={!brand} variant="outline" className="gap-2">
              <Shuffle className="h-4 w-4" />Surpreenda-me
            </Button>
            {surprise && (
              <Badge variant="outline" className="gap-1"><Wand2 className="h-3 w-3" />Modo surpresa</Badge>
            )}
          </div>

          {!brand ? (
            <Card className="border-dashed">
              <CardContent className="grid place-items-center gap-2 p-10 text-center">
                <Lightbulb className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Selecione uma marca para começar a receber sugestões.</p>
                <Button asChild variant="outline" size="sm"><Link to="/app/brands/new">Cadastrar nova marca</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onUse={() => useIdea(idea, brand.id)}
                  onFavorite={() => favorite.mutate(idea)}
                  onDiscard={() => setSessionTitles((p) => [...p, idea.title])}
                />
              ))}
              {ideas.length === 0 && (
                <Card className="border-dashed md:col-span-2">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    Não há dados suficientes nesta marca para gerar novas ideias com segurança.
                    Adicione produtos, dúvidas frequentes ou diferenciais e tente novamente.
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p>
                As ideias usam apenas o que está cadastrado na ficha da marca. Antes de publicar, confirme as informações
                marcadas como “necessárias” — o Cria Aí nunca inventa preço, dado de cliente ou depoimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="space-y-3">
          {(saved ?? []).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="grid place-items-center gap-2 p-10 text-center">
                <Star className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Você ainda não favoritou ideias.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(saved ?? []).map((s) => (
                <Card key={s.id} className="border-border/60">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{(s as { brands?: { name?: string } }).brands?.name ?? "Marca"}</Badge>
                      <Badge variant="outline">{s.status}</Badge>
                    </div>
                    <p className="font-semibold">{s.title}</p>
                    {s.hook && <p className="text-sm text-muted-foreground italic">“{s.hook}”</p>}
                    <div className="flex flex-wrap gap-1 pt-1 text-xs text-muted-foreground">
                      {s.recommended_format && <Badge variant="outline" className="font-normal">{s.recommended_format}</Badge>}
                      {s.content_pillar && <Badge variant="outline" className="font-normal">{s.content_pillar}</Badge>}
                      {s.objective && <Badge variant="outline" className="font-normal">{s.objective}</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => useIdea(savedToIdea(s), s.brand_id ?? "")}
                        disabled={!s.brand_id}
                        className="gap-1"
                      >
                        <ArrowRight className="h-3 w-3" />Usar esta ideia
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeSaved.mutate(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IdeaCard({
  idea, onUse, onFavorite, onDiscard,
}: { idea: Idea; onUse: () => void; onFavorite: () => void; onDiscard: () => void }) {
  const badgeColor =
    idea.novelty_badge === "Ideia nova" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" :
    idea.novelty_badge === "Variação de conteúdo" ? "bg-primary/10 text-primary border-primary/30" :
    idea.novelty_badge === "Reaproveitamento" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" :
    "bg-muted text-muted-foreground border-border";

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <Badge variant="outline" className="font-normal">{idea.content_pillar}</Badge>
            <p className="font-semibold leading-tight">{idea.title}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 ${badgeColor}`}>{idea.novelty_badge}</Badge>
        </div>

        <div className="flex flex-wrap gap-1 text-xs">
          <Badge variant="outline" className="font-normal"><Layers className="mr-1 h-3 w-3" />{idea.recommended_format}</Badge>
          <Badge variant="outline" className="font-normal">{idea.objective}</Badge>
        </div>

        {idea.hook && <p className="text-sm text-muted-foreground italic">Gancho: “{idea.hook}”</p>}
        {idea.central_message && <p className="text-sm"><span className="text-muted-foreground">Mensagem central: </span>{idea.central_message}</p>}
        {idea.suggested_cta && <p className="text-sm"><span className="text-muted-foreground">CTA: </span>{idea.suggested_cta}</p>}
        {idea.reason_to_publish && <p className="text-sm"><span className="text-muted-foreground">Motivo: </span>{idea.reason_to_publish}</p>}

        {idea.required_information.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-300">Informações a confirmar antes da publicação:</p>
            <ul className="ml-4 mt-1 list-disc text-muted-foreground">
              {idea.required_information.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={onUse} className="gap-1"><ArrowRight className="h-3 w-3" />Usar esta ideia</Button>
          <Button size="sm" variant="outline" onClick={onFavorite} className="gap-1"><Star className="h-3 w-3" />Favoritar</Button>
          <Button size="sm" variant="ghost" onClick={onDiscard} className="gap-1"><Trash2 className="h-3 w-3" />Descartar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function formatLabelToKey(label: string): string | null {
  const map: Record<string, string> = {
    "Post Feed": "post",
    "Carrossel": "carrossel",
    "Stories": "story",
    "Sequência de Stories": "sequencia_stories",
    "Status WhatsApp": "status_whatsapp",
    "Reel": "reel",
    "Comunicado": "comunicado",
  };
  return map[label] ?? null;
}

function savedToIdea(s: Record<string, unknown>): Idea {
  return {
    id: String(s.id),
    title: String(s.title ?? ""),
    theme: String(s.theme ?? ""),
    content_pillar: String(s.content_pillar ?? ""),
    objective: String(s.objective ?? ""),
    recommended_format: String(s.recommended_format ?? "Post Feed"),
    angle: String(s.angle ?? ""),
    target_audience: String(s.target_audience ?? ""),
    audience_problem: String(s.audience_problem ?? ""),
    central_message: String(s.central_message ?? ""),
    hook: String(s.hook ?? ""),
    suggested_cta: String(s.suggested_cta ?? ""),
    required_information: (s.required_information as string[]) ?? [],
    visual_direction: String(s.visual_direction ?? ""),
    reason_to_publish: String(s.reason_to_publish ?? ""),
    source_elements: (s.source_elements as string[]) ?? [],
    novelty_score: Number(s.novelty_score ?? 0),
    novelty_badge: (s.novelty_badge as Idea["novelty_badge"]) ?? "Ideia nova",
    template_key: (s.template_key as Idea["template_key"]) ?? "produto_servico",
    created_at: String(s.created_at ?? new Date().toISOString()),
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
