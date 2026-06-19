import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, Star, Trash2, ArrowRight,
  Layers, Info, Lightbulb, Shuffle, AlertTriangle, CheckCircle2, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";
import {
  generateIdeasWithMeta,
  IDEA_OBJECTIVE_LABELS, IDEA_FORMAT_LABELS, IDEA_FOCUS_LABELS, IDEA_TONE_LABELS, IDEA_APPROACH_LABELS,
  type Idea, type IdeaObjective, type IdeaFormat, type IdeaFocus, type IdeaTone, type IdeaApproach,
} from "@/lib/ideaGenerator";
import {
  evaluateCompatibility, COMPATIBILITY_LABELS, type CompatibilityLevel,
} from "@/lib/ideaCompatibility";
import { FIELD_TOOLTIPS } from "@/lib/ideaTaxonomy";

export const Route = createFileRoute("/_authenticated/app/ideas")({
  head: () => ({ meta: [{ title: "Laboratório de Ideias — Cria Aí" }] }),
  component: IdeasLab,
});

function IdeasLab() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [brandId, setBrandId] = useState<string>("");
  const [objective, setObjective] = useState<IdeaObjective>("qualquer");
  const [focus, setFocus] = useState<IdeaFocus>("qualquer");
  const [approach, setApproach] = useState<IdeaApproach>("auto");
  const [format, setFormat] = useState<IdeaFormat>("auto");
  const [tone, setTone] = useState<IdeaTone>("marca");
  const [quantity, setQuantity] = useState<3 | 5 | 10>(5);
  const [seedBump, setSeedBump] = useState(0);
  const [sessionTitles, setSessionTitles] = useState<string[]>([]);
  const [surprise, setSurprise] = useState(false);
  const [allowFallback, setAllowFallback] = useState(true);

  const { data: brands } = useQuery({
    queryKey: ["brands-lab"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const brand = useMemo(() => brands?.find((b) => b.id === brandId) ?? null, [brands, brandId]);

  // Limpar estado ao trocar de marca
  useEffect(() => {
    setSessionTitles([]);
    setSeedBump(0);
    setSurprise(false);
  }, [brandId]);

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

  const result = useMemo(() => {
    if (!brand) return null;
    try {
      return generateIdeasWithMeta({
        brand,
        objective: surprise ? "qualquer" : objective,
        focus: surprise ? "qualquer" : focus,
        approach: surprise ? "auto" : approach,
        format: surprise ? "auto" : format,
        tone: surprise ? "marca" : tone,
        quantity,
        history: history ?? [],
        excludeTitles: sessionTitles,
        allowFallback,
        seed: hash(brand.id + objective + focus + approach + format + tone + quantity + seedBump + (surprise ? "s" : "")),
      });
    } catch (err) {
      console.error("[IdeasLab] falha ao gerar ideias para a marca", brand?.id, err);
      return null;
    }
  }, [brand, objective, focus, approach, format, tone, quantity, history, sessionTitles, seedBump, surprise, allowFallback]);

  const ideas: Idea[] = result?.ideas ?? [];

  const compat = useMemo(() => {
    if (!brand || surprise) return null;
    return evaluateCompatibility({ objective, focus, approach, format });
  }, [brand, surprise, objective, focus, approach, format]);

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
        approach: idea.approach,
        compatibility_level: idea.compatibility_level,
        compatibility_reason: idea.compatibility_reason,
        applied_fallback_level: idea.applied_fallback_level,
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
      notes: `Origem: Laboratório de Ideias. Pilar: ${idea.content_pillar}. Abordagem: ${idea.approach}. Gancho: ${idea.hook}`,
    };
    try {
      localStorage.setItem("cria-wizard-prefill", JSON.stringify(prefill));
      sessionStorage.setItem("cria-wizard-from-idea", "1");
    } catch {}
    navigate({ to: "/app/content/new" });
  };

  const summary = useMemo(() => buildCombinationSummary({ objective, focus, approach, format, tone }), [objective, focus, approach, format, tone]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-6xl space-y-6 min-w-0">
        <header className="space-y-2 min-w-0">
          <Badge variant="secondary" className="rounded-full"><Lightbulb className="mr-1 h-3 w-3" />Laboratório</Badge>
          <h1 className="text-2xl font-bold sm:text-3xl break-words">Sem ideia hoje? A gente começa por você.</h1>
          <p className="text-sm text-muted-foreground">
            Escolha uma marca e combine Objetivo, Foco, Abordagem, Formato e Tom para receber sugestões coerentes com o que já está cadastrado.
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
                {/* Linha 1 */}
                <Field label="Marca" tip="Selecione a marca para a qual gerar ideias.">
                  <Select value={brandId} onValueChange={(v) => { setBrandId(v); setSurprise(false); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma marca" /></SelectTrigger>
                    <SelectContent>
                      {(brands ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Objetivo" tip={FIELD_TOOLTIPS.objective}>
                  <Select value={objective} onValueChange={(v) => { setObjective(v as IdeaObjective); setSurprise(false); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(IDEA_OBJECTIVE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Formato" tip={FIELD_TOOLTIPS.format}>
                  <Select value={format} onValueChange={(v) => { setFormat(v as IdeaFormat); setSurprise(false); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(IDEA_FORMAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Linha 2 */}
                <Field label="Foco principal" tip={FIELD_TOOLTIPS.focus}>
                  <Select value={focus} onValueChange={(v) => { setFocus(v as IdeaFocus); setSurprise(false); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(IDEA_FOCUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Abordagem" tip={FIELD_TOOLTIPS.approach}>
                  <Select value={approach} onValueChange={(v) => { setApproach(v as IdeaApproach); setSurprise(false); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {orderedApproaches(objective, focus, format).map(({ approach: a, level }) => (
                        <SelectItem key={a} value={a}>
                          <span className="flex items-center gap-2">
                            <span>{IDEA_APPROACH_LABELS[a]}</span>
                            {a !== "auto" && <CompatDot level={level} />}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tom" tip={FIELD_TOOLTIPS.tone}>
                  <Select value={tone} onValueChange={(v) => { setTone(v as IdeaTone); setSurprise(false); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(IDEA_TONE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Linha 3 */}
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
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm sm:col-span-2">
                  <div>
                    <p className="font-medium">Permitir fallback automático</p>
                    <p className="text-xs text-muted-foreground">Inclui variações compatíveis quando não há ideias suficientes.</p>
                  </div>
                  <Switch checked={allowFallback} onCheckedChange={setAllowFallback} />
                </div>
              </CardContent>
            </Card>

            {/* Resumo dinâmico */}
            {brand && !surprise && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-medium">Como essa ideia será construída</p>
                  <p className="text-muted-foreground">{summary}</p>
                  {compat && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <CompatBadge level={compat.level} />
                      <span className="text-xs text-muted-foreground">{compat.reason}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={regenerate} disabled={!brand} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />Gerar outras ideias
              </Button>
              <Button onClick={surpriseMe} disabled={!brand} variant="outline" className="gap-2">
                <Shuffle className="h-4 w-4" />Surpreenda-me
              </Button>
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
              <>
                {/* Avisos de fallback / parcial */}
                {result && result.notes.length > 0 && (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="space-y-2 p-4 text-sm">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                        <div className="space-y-1">
                          {result.notes.map((n, i) => <p key={i}>{n}</p>)}
                        </div>
                      </div>
                      {result.partial && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button size="sm" variant="outline" onClick={() => setAllowFallback(true)}>Relaxar filtros</Button>
                          <Button size="sm" variant="outline" onClick={() => { setFocus("qualquer"); setApproach("auto"); }}>Usar foco automático</Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/app/brands/$brandId/edit" params={{ brandId: brand.id }}>Completar ficha da marca</Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Diagnóstico de fontes quando ideias = 0 */}
                {result && result.ideas.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="space-y-3 p-6 text-sm">
                      <p className="font-medium">Não conseguimos gerar ideias com essa combinação.</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Disponíveis na marca</p>
                          <ul className="mt-1 space-y-1">
                            {result.sources.availableSources.length === 0
                              ? <li className="text-muted-foreground">Nenhuma fonte preenchida.</li>
                              : result.sources.availableSources.map((s) => (
                                <li key={s} className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-emerald-600" />{s}</li>
                              ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">O que ainda falta</p>
                          <ul className="mt-1 space-y-1">
                            {result.sources.missingSources.slice(0, 6).map((s) => (
                              <li key={s} className="flex items-center gap-2 text-muted-foreground"><ChevronRight className="h-3 w-3" />{s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/brands/$brandId/edit" params={{ brandId: brand.id }}>Ver o que falta na marca</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}

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
                </div>
              </>
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
                  <Card key={s.id} className="border-border/60 min-w-0">
                    <CardContent className="space-y-2 p-5 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <Badge variant="secondary" className="truncate max-w-[60%]">{(s as { brands?: { name?: string } }).brands?.name ?? "Marca"}</Badge>
                        <Badge variant="outline">{s.status}</Badge>
                      </div>
                      <p className="font-semibold break-words">{s.title}</p>
                      {s.hook && <p className="text-sm text-muted-foreground italic break-words">“{s.hook}”</p>}
                      <div className="flex flex-wrap gap-1 pt-1 text-xs text-muted-foreground">
                        {s.recommended_format && <Badge variant="outline" className="font-normal">{s.recommended_format}</Badge>}
                        {s.content_pillar && <Badge variant="outline" className="font-normal">{s.content_pillar}</Badge>}
                        {s.objective && <Badge variant="outline" className="font-normal">{s.objective}</Badge>}
                        {(s as { approach?: string | null }).approach && (
                          <Badge variant="outline" className="font-normal">{(s as { approach?: string }).approach}</Badge>
                        )}
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
    </TooltipProvider>
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
    <Card className="border-border/60 min-w-0">
      <CardContent className="space-y-3 p-5 min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="space-y-1 min-w-0">
            <Badge variant="outline" className="font-normal">{idea.content_pillar}</Badge>
            <p className="font-semibold leading-tight break-words">{idea.title}</p>
          </div>
          <Badge variant="outline" className={`shrink-0 ${badgeColor}`}>{idea.novelty_badge}</Badge>
        </div>

        <div className="flex flex-wrap gap-1 text-xs">
          <Badge variant="outline" className="font-normal"><Layers className="mr-1 h-3 w-3" />{idea.recommended_format}</Badge>
          <Badge variant="outline" className="font-normal">{idea.objective}</Badge>
          <Badge variant="outline" className="font-normal">{idea.approach}</Badge>
          <CompatBadge level={idea.compatibility_level} />
          {idea.applied_fallback_level > 0 && (
            <Badge variant="outline" className="font-normal text-amber-700 dark:text-amber-300 border-amber-500/30">
              Fallback nível {idea.applied_fallback_level}
            </Badge>
          )}
        </div>

        {idea.hook && <p className="text-sm text-muted-foreground italic break-words">Gancho: “{idea.hook}”</p>}
        {idea.central_message && <p className="text-sm break-words"><span className="text-muted-foreground">Mensagem central: </span>{idea.central_message}</p>}
        {idea.suggested_cta && <p className="text-sm break-words"><span className="text-muted-foreground">CTA: </span>{idea.suggested_cta}</p>}
        {idea.reason_to_publish && <p className="text-sm break-words"><span className="text-muted-foreground">Motivo: </span>{idea.reason_to_publish}</p>}

        {idea.required_information.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
            <p className="font-medium text-amber-700 dark:text-amber-300">Informações a confirmar antes da publicação:</p>
            <ul className="ml-4 mt-1 list-disc text-muted-foreground">
              {idea.required_information.map((r, i) => <li key={i} className="break-words">{r}</li>)}
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

function Field({ label, tip, children }: { label: string; tip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        {tip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Sobre ${label}`}>
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">{tip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

function CompatDot({ level }: { level: CompatibilityLevel }) {
  const color =
    level === "recommended" ? "bg-emerald-500" :
    level === "possible" ? "bg-sky-500" :
    level === "weak" ? "bg-amber-500" :
    "bg-rose-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-label={COMPATIBILITY_LABELS[level]} />;
}

function CompatBadge({ level }: { level: CompatibilityLevel }) {
  const cls =
    level === "recommended" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10" :
    level === "possible" ? "border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-500/10" :
    level === "weak" ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10" :
    "border-rose-500/40 text-rose-700 dark:text-rose-300 bg-rose-500/10";
  return <Badge variant="outline" className={`font-normal ${cls}`}>{COMPATIBILITY_LABELS[level]}</Badge>;
}

function orderedApproaches(
  objective: IdeaObjective, focus: IdeaFocus, format: IdeaFormat,
): Array<{ approach: IdeaApproach; level: CompatibilityLevel }> {
  const all = Object.keys(IDEA_APPROACH_LABELS) as IdeaApproach[];
  return all
    .map((a) => ({
      approach: a,
      level: a === "auto"
        ? ("recommended" as CompatibilityLevel)
        : evaluateCompatibility({ objective, focus, approach: a, format }).level,
    }))
    .sort((a, b) => {
      if (a.approach === "auto") return -1;
      if (b.approach === "auto") return 1;
      const order = { recommended: 3, possible: 2, weak: 1, incompatible: 0 } as const;
      return order[b.level] - order[a.level];
    });
}

function buildCombinationSummary(args: {
  objective: IdeaObjective; focus: IdeaFocus; approach: IdeaApproach; format: IdeaFormat; tone: IdeaTone;
}): string {
  const obj = IDEA_OBJECTIVE_LABELS[args.objective].toLowerCase();
  const foc = args.focus === "qualquer" ? "qualquer foco" : IDEA_FOCUS_LABELS[args.focus].toLowerCase();
  const app = args.approach === "auto" ? "abordagem sugerida automaticamente" : IDEA_APPROACH_LABELS[args.approach].toLowerCase();
  const fmt = args.format === "auto" ? "no melhor formato para a ideia" : `para ${IDEA_FORMAT_LABELS[args.format]}`;
  const tn = args.tone === "marca" ? "seguindo o tom da marca" : `com tom ${IDEA_TONE_LABELS[args.tone].toLowerCase()}`;
  return `O Cria Aí buscará ideias com o objetivo de ${obj}, focando em ${foc}, usando ${app}, ${fmt}, ${tn}.`;
}

function formatLabelToKey(label: string): string | null {
  const map: Record<string, string> = {
    "Post Feed": "post",
    "Carrossel": "carrossel",
    "Story": "story",
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
    approach: String((s as { approach?: string | null }).approach ?? "Sugerir automaticamente"),
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
    template_key: String(s.template_key ?? "duvida"),
    compatibility_level: (((s as { compatibility_level?: string }).compatibility_level) as CompatibilityLevel) ?? "possible",
    compatibility_reason: String((s as { compatibility_reason?: string }).compatibility_reason ?? ""),
    applied_fallback_level: Number((s as { applied_fallback_level?: number }).applied_fallback_level ?? 0),
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
