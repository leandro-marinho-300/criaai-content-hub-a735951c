export const MAX_HASHTAGS = 5;

function cleanHashtag(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutHash = trimmed.replace(/^#+/, "").replace(/\s+/g, "");
  if (!withoutHash) return "";
  return `#${withoutHash}`;
}

export function normalizeHashtags(value: unknown, max = MAX_HASHTAGS): string[] {
  const input = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\s+/) : [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of input) {
    const hashtag = cleanHashtag(item);
    if (!hashtag) continue;
    const key = hashtag.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(hashtag);
    if (result.length >= max) break;
  }
  return result;
}
