import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildBrandTrendTerms,
  buildTrendSourceLinks,
  loadTrendFindings,
  saveTrendFindings,
  type TrendFinding,
  type TrendPeriod,
  type TrendStrength,
} from "@/lib/trendRadar";

export const Route = createFileRoute("/_authenticated/app/trends")({
  head: () => ({ meta: [{ title: "Radar de Tendências — Cria Aí" }] }),
  component: TrendsPage,
});

const strengthLabels: Record<TrendStrength, string> = {
  observacao: "Observação inicial",
  em_crescimento: "Em crescimento",
  forte: "Sinal forte",
};

function TrendsPage() {
  const navigate = useNavigate();
  const [brandId, setBrandId] = useState("");
  const [term, setTerm] = useState("");
  const [period, setPeriod] = useState<TrendPeriod>("90d");
  const [findings, setFindings] = useState<TrendFinding[]>([]);
  const [findingTitle, setFindingTitle] = useState("");
  const [findingSource, setFindingSource] = useState("Google Trends");
  const [findingUrl, setFindingUrl] = useState("");
  const [findingStrength, setFindingStrength] = useState<TrendStrength>("observacao");
  const [findingNotes, setFindingNotes] = useState("");

  const { data: brands } = useQuery({
    queryKey: ["brands-trends"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"brands">[];
    },
  });

  const brand = useMemo(
    () => brands?.find((item) => item.id === brandId) ?? null,
    [brands, brandId],
  );
  const suggestedTerms = useMemo(() => buildBrandTrendTerms(brand), [brand]);
  const sourceLinks = useMemo(() => buildTrendSourceLinks(term, period), [term, period]);

  useEffect(() => {
    if (!brandId) {
      setFindings([]);
      return;
    }
    setFindings(loadTrendFindings(brandId));
  }, [brandId]);

  useEffect(() => {
    if (!brand || term.trim()) return;
    setTerm(suggestedTerms[0] ?? brand.segment ?? "");
  }, [brand, suggestedTerms, term]);

  function persist(next: TrendFinding[]) {
    setFindings(next);
    saveTrendFindings(brandId, next);
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Pesquisa copiada.");
  }

  function addFinding() {
    if (!brandId) return toast.error("Selecione uma marca.");
    if (!findingTitle.trim()) return toast.error("Descreva o tema ou sinal encontrado.");
    const item: TrendFinding = {
      id: crypto.randomUUID(),
      brandId,
      term: term.trim(),
      title: findingTitle.trim(),
      source: findingSource.trim() || "Fonte externa",
      sourceUrl: findingUrl.trim(),
      strength: findingStrength,
      notes: findingNotes.trim(),
      observedAt: new Date().toISOString(),
    };
    persist([item, ...findings]);
    setFindingTitle("");
    setFindingUrl("");
    setFindingNotes("");
    setFindingStrength("observacao");
    toast.success("Sinal salvo no Radar.");
  }

  function handleUseAsTheme(item: TrendFinding) {
    const prefill = {
      brand_id: item.brandId,
      objective: "informar",
      selected_formats: ["post"],
      internal_title: item.title,
      theme: item.title,
      main_message: item.notes || `Desenvolver conteúdo sobre o sinal observado: ${item.title}.`,
      mandatory_information: `Fonte da pesquisa: ${item.source}${item.sourceUrl ? ` — ${item.sourceUrl}` : ""}\nValidar contexto e atualidade antes de publicar.`,
      call_to_action: "Salve para consultar depois.",
      notes: `Origem: Radar de Tendências. Termo pesquisado: ${item.term}. Sinal: ${strengthLabels[item.strength]}.`,
    };
    localStorage.setItem("cria-wizard-prefill", JSON.stringify(prefill));
    sessionStorage.setItem("cria-wizard-from-idea", "1");
    navigate({ to: "/app/content/new" });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <Badge variant="secondary" className="rounded-full">
          <TrendingUp className="mr-1 h-3 w-3" />
          Pesquisa externa, sem IA interna
        </Badge>
        <h1 className="text-2xl font-bold sm:text-3xl">Radar de Tendências</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          O Cria Aí prepara as pesquisas e organiza os sinais encontrados. A análise acontece nas
          plataformas externas; nenhum dado é coletado automaticamente e nenhuma IA é chamada pelo
          app.
        </p>
      </header>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Marca</Label>
            <Select
              value={brandId}
              onValueChange={(value) => {
                setBrandId(value);
                setTerm("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma marca" />
              </SelectTrigger>
              <SelectContent>
                {(brands ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label>Termo ou assunto</Label>
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Ex.: turismo nacional"
            />
          </div>
          <div className="space-y-2">
            <Label>Período de observação</Label>
            <Select value={period} onValueChange={(value) => setPeriod(value as TrendPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="12m">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {suggestedTerms.length > 0 && (
            <div className="space-y-2 md:col-span-3">
              <Label>Sugestões da ficha da marca</Label>
              <div className="flex flex-wrap gap-2">
                {suggestedTerms.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={term === item ? "default" : "outline"}
                    onClick={() => setTerm(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sourceLinks.map((source) => (
          <Card key={source.id}>
            <CardContent className="flex h-full flex-col gap-3 p-5">
              <div>
                <h2 className="font-semibold">{source.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{source.description}</p>
              </div>
              {source.instructions && (
                <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  {source.instructions}
                </p>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                <Button asChild size="sm" disabled={!term.trim()}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir pesquisa
                  </a>
                </Button>
                {source.queryToCopy && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(source.queryToCopy ?? "")}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar termo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {!term.trim() && (
        <Card className="border-dashed">
          <CardContent className="grid place-items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Search className="h-6 w-6" />
            Selecione uma marca e informe um termo para montar as pesquisas.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Registrar um sinal encontrado</h2>
            <p className="text-sm text-muted-foreground">
              Salve apenas sinais verificáveis. Uma tendência fica mais confiável quando aparece em
              duas ou mais fontes e possui data recente.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Tema, dúvida ou formato observado</Label>
              <Input
                value={findingTitle}
                onChange={(event) => setFindingTitle(event.target.value)}
                placeholder="Ex.: aumento das buscas por viagens de trem no Brasil"
              />
            </div>
            <div className="space-y-2">
              <Label>Fonte</Label>
              <Input
                value={findingSource}
                onChange={(event) => setFindingSource(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Link da evidência</Label>
              <Input
                value={findingUrl}
                onChange={(event) => setFindingUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Força do sinal</Label>
              <Select
                value={findingStrength}
                onValueChange={(value) => setFindingStrength(value as TrendStrength)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(strengthLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Por que isso pode virar conteúdo?</Label>
              <Textarea
                rows={3}
                value={findingNotes}
                onChange={(event) => setFindingNotes(event.target.value)}
                placeholder="Registre o que se repete, a dúvida do público, o formato que está funcionando e o que ainda precisa ser confirmado."
              />
            </div>
          </div>
          <Button onClick={addFinding} disabled={!brandId || !findingTitle.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            Salvar sinal
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Sinais salvos</h2>
          <Badge variant="outline">{findings.length}</Badge>
        </div>
        {findings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum sinal registrado para esta marca.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {findings.map((item) => (
              <Card key={item.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant="outline">{strengthLabels[item.strength]}</Badge>
                      <h3 className="mt-2 font-semibold">{item.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.source} · {new Date(item.observedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => persist(findings.filter((finding) => finding.id !== item.id))}
                      aria-label="Excluir sinal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                  <div className="flex flex-wrap gap-2">
                    {item.sourceUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir fonte
                        </a>
                      </Button>
                    )}
                    <Button size="sm" onClick={() => handleUseAsTheme(item)}>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Usar como tema
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
