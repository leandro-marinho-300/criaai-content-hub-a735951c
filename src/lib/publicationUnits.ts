// Deriva "unidades de publicação" a partir de um projeto e suas peças.
// Regra: cada carrossel, sequência de Stories ou conjunto de Status WhatsApp
// vira UMA unidade de publicação (não uma por slide).
import type { Tables } from "@/integrations/supabase/types";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import type { ChannelKind } from "./calendar";

type Project = Tables<"content_projects">;
type Output = Tables<"content_outputs">;

export interface PublicationUnit {
  unitKey: string;            // identificador estável dentro do projeto
  format: string;             // chave em FORMAT_LABELS
  formatLabel: string;
  channelSuggestion: ChannelKind;
  title: string;
  outputIds: string[];        // peças/páginas que compõem esta publicação
}

const DEFAULT_CHANNEL: Record<string, ChannelKind> = {
  post: "instagram_feed",
  carrossel: "instagram_feed",
  story: "instagram_stories",
  sequencia_stories: "instagram_stories",
  reel: "instagram_reel",
  capa_reel: "instagram_reel",
  status_whatsapp: "whatsapp_status",
  texto_grupo: "whatsapp_grupo",
  comunicado: "outro",
  banner: "outro",
  impresso: "impresso",
  outro: "outro",
};

export function suggestChannel(format: string): ChannelKind {
  return DEFAULT_CHANNEL[format] ?? "outro";
}

/** Agrupa outputs por format/output_type para virar unidades de publicação. */
export function derivePublicationUnits(project: Project, outputs: Output[]): PublicationUnit[] {
  const formats: string[] = (project.selected_formats as string[] | null) ?? [];
  const baseTitle = project.internal_title?.trim() || "Publicação";

  // Se temos a lista de formatos selecionados, criamos uma unidade por formato
  // — agrupando todos os outputs que pertencem àquele formato.
  if (formats.length) {
    return formats.map((format) => {
      const related = outputs.filter((o) => o.output_type === format || o.output_type === `${format}_pagina` || o.output_type.startsWith(`${format}_`));
      return {
        unitKey: `${project.id}:${format}`,
        format,
        formatLabel: FORMAT_LABELS[format] ?? format,
        channelSuggestion: suggestChannel(format),
        title: formats.length === 1 ? baseTitle : `${baseTitle} — ${FORMAT_LABELS[format] ?? format}`,
        outputIds: related.map((o) => o.id),
      };
    });
  }

  // Fallback: cria uma única unidade com todos os outputs.
  return [{
    unitKey: `${project.id}:default`,
    format: "outro",
    formatLabel: "Publicação",
    channelSuggestion: "outro",
    title: baseTitle,
    outputIds: outputs.map((o) => o.id),
  }];
}
