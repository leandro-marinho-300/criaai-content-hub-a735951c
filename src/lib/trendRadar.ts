import type { Tables } from "@/integrations/supabase/types";

export type TrendPeriod = "7d" | "30d" | "90d" | "12m";
export type TrendStrength = "observacao" | "em_crescimento" | "forte";

export interface TrendSourceLink {
  id: string;
  label: string;
  description: string;
  url: string;
  queryToCopy?: string;
  instructions?: string;
}

export interface TrendFinding {
  id: string;
  brandId: string;
  term: string;
  title: string;
  source: string;
  sourceUrl: string;
  strength: TrendStrength;
  notes: string;
  observedAt: string;
}

const periodMap: Record<TrendPeriod, string> = {
  "7d": "now 7-d",
  "30d": "today 1-m",
  "90d": "today 3-m",
  "12m": "today 12-m",
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const value = item.replace(/\s+/g, " ").trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function splitTopics(value: unknown): string[] {
  const text = clean(value);
  if (!text) return [];
  return text
    .split(/\r?\n|;|\||\s[•·]\s|,(?=\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((item) => item.replace(/^[-*•·\d.)\s]+/, "").trim())
    .filter((item) => item.length >= 3 && item.length <= 90);
}

export function buildBrandTrendTerms(brand: Tables<"brands"> | null): string[] {
  if (!brand) return [];
  const terms = unique([
    clean(brand.segment),
    ...brand.priority_services,
    ...splitTopics(brand.products_services),
    ...brand.allowed_topics,
    ...splitTopics(brand.audience_needs),
    ...splitTopics(brand.audience_difficulties),
  ]);
  return terms.slice(0, 12);
}

function googleSearch(query: string, extra = ""): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}${extra}`;
}

export function buildTrendSourceLinks(
  term: string,
  period: TrendPeriod,
  region = "BR",
): TrendSourceLink[] {
  const query = term.trim();
  if (!query) return [];
  const date = periodMap[period];
  const recentSuffix = period === "7d" ? "&tbs=qdr:w" : period === "30d" ? "&tbs=qdr:m" : "";

  return [
    {
      id: "google-trends",
      label: "Google Trends",
      description: "Compare interesse de busca, evolução no período e assuntos relacionados.",
      url: `https://trends.google.com/trends/explore?date=${encodeURIComponent(date)}&geo=${encodeURIComponent(region)}&q=${encodeURIComponent(query)}`,
      queryToCopy: query,
    },
    {
      id: "google-news",
      label: "Notícias recentes",
      description: "Veja notícias e acontecimentos recentes relacionados ao tema.",
      url: googleSearch(query, `&tbm=nws${recentSuffix}`),
      queryToCopy: query,
    },
    {
      id: "youtube",
      label: "YouTube",
      description: "Observe títulos, perguntas, formatos e vídeos recentes do nicho.",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      queryToCopy: query,
      instructions:
        "No YouTube Studio, consulte também Analytics > Pesquisa/Tendências quando disponível.",
    },
    {
      id: "tiktok",
      label: "TikTok Creative Center",
      description: "Pesquise hashtags, vídeos, criadores e músicas em alta na região.",
      url: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/",
      queryToCopy: query,
      instructions: "Abra o Trend Discovery, escolha Brasil e pesquise o termo copiado.",
    },
    {
      id: "instagram",
      label: "Instagram e Reels",
      description:
        "Encontre Reels recentes do tema e observe ganchos, dúvidas e áudios recorrentes.",
      url: googleSearch(`site:instagram.com/reel ${query}`, recentSuffix),
      queryToCopy: query,
      instructions:
        "No aplicativo, confira também o Painel profissional e os áudios marcados como em alta.",
    },
    {
      id: "google-questions",
      label: "Perguntas do público",
      description: "Busque dúvidas reais para transformar em conteúdo educativo.",
      url: googleSearch(`${query} dúvidas OR como OR vale a pena OR o que saber`, recentSuffix),
      queryToCopy: `${query} dúvidas como vale a pena o que saber`,
    },
  ];
}

const storageKey = (brandId: string) => `cria-ai-trend-findings:${brandId}`;

export function loadTrendFindings(brandId: string): TrendFinding[] {
  if (typeof window === "undefined" || !brandId) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(brandId)) ?? "[]");
    return Array.isArray(value) ? (value as TrendFinding[]) : [];
  } catch {
    return [];
  }
}

export function saveTrendFindings(brandId: string, findings: TrendFinding[]): void {
  if (typeof window === "undefined" || !brandId) return;
  window.localStorage.setItem(storageKey(brandId), JSON.stringify(findings.slice(0, 100)));
}
