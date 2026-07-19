// Helpers de "título de exibição" — texto curto usado em Início, Biblioteca,
// Calendário, PDF e seletores. Não substitui briefing/internal_title/theme.

export interface DisplayTitleSource {
  display_title?: string | null;
  internal_title?: string | null;
  theme?: string | null;
  main_message?: string | null;
}

const MAX_LEN = 80;

function cleanLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Corta no limite de palavra preferindo o trecho anterior a ; / quebra de linha. */
function shorten(raw: string, max = MAX_LEN): string {
  let s = (raw || "").replace(/\r/g, "");
  // Preferir primeiro trecho antes de quebra ou ponto-e-vírgula.
  const cutAt = Math.min(
    ...[s.indexOf("\n"), s.indexOf(";")].filter((i) => i > 0).concat([s.length]),
  );
  s = cleanLine(s.slice(0, cutAt));
  if (s.length <= max) return s;
  const sliced = s.slice(0, max);
  const lastSpace = sliced.lastIndexOf(" ");
  const base = lastSpace > 30 ? sliced.slice(0, lastSpace) : sliced;
  return `${base.trim()}…`;
}

/** Retorna um título curto a partir do projeto, usando display_title se válido. */
export function getProjectDisplayTitle(project: DisplayTitleSource | null | undefined): string {
  if (!project) return "Conteúdo sem título";
  const dt = (project.display_title ?? "").trim();
  if (dt) return dt.length > MAX_LEN ? shorten(dt) : dt;
  const it = (project.internal_title ?? "").trim();
  if (it) return it.length > MAX_LEN ? shorten(it) : it;
  const tm = (project.theme ?? "").trim();
  if (tm) return shorten(tm);
  const mm = (project.main_message ?? "").trim();
  if (mm) return shorten(mm);
  return "Conteúdo sem título";
}

/** Validação do título informado pelo usuário. */
export function validateDisplayTitle(value: string): { ok: boolean; error?: string; trimmed: string } {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { ok: false, error: "Informe um título.", trimmed };
  if (trimmed.length < 3) return { ok: false, error: "Mínimo de 3 caracteres.", trimmed };
  if (trimmed.length > 100) return { ok: false, error: "Máximo de 100 caracteres.", trimmed };
  return { ok: true, trimmed };
}

export const DISPLAY_TITLE_MAX = 100;
