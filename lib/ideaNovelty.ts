export interface IdeaHistoryItem {
  title?: string | null;
  theme?: string | null;
  main_message?: string | null;
  objective?: string | null;
  formats?: string[] | null;
  cta?: string | null;
  template_key?: string | null;
  status?: string | null;
  created_at?: string | null;
}

const STOP_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "entre",
  "essa",
  "esse",
  "esta",
  "este",
  "eu",
  "mais",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "pela",
  "pelas",
  "pelo",
  "pelos",
  "por",
  "que",
  "se",
  "sem",
  "seu",
  "sua",
  "um",
  "uma",
  "voce",
  "sobre",
  "quando",
  "onde",
  "porque",
  "qual",
  "quais",
  "pode",
  "podem",
  "precisa",
  "ser",
  "ter",
]);

export function normalizeIdeaText(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: unknown): Set<string> {
  return new Set(
    normalizeIdeaText(value)
      .split(" ")
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) if (b.has(token)) count += 1;
  return count;
}

export function ideaTextSimilarity(a: unknown, b: unknown): number {
  const normalizedA = normalizeIdeaText(a);
  const normalizedB = normalizeIdeaText(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;

  const aTokens = tokens(normalizedA);
  const bTokens = tokens(normalizedB);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  const intersection = intersectionSize(aTokens, bTokens);
  const union = new Set([...aTokens, ...bTokens]).size;
  const jaccard = union ? intersection / union : 0;
  const containment = intersection / Math.min(aTokens.size, bTokens.size);

  // Contenção ajuda a detectar um tema curto repetido dentro de um título maior.
  return Math.max(jaccard, containment * 0.9);
}

export function historyItemText(item: IdeaHistoryItem): string {
  return [item.title, item.theme, item.main_message].filter(Boolean).join(" ");
}

export function isIdeaTooSimilar(
  candidate: { title: string; theme: string; central_message?: string },
  history: IdeaHistoryItem[],
  threshold = 0.64,
): boolean {
  const candidateText = [candidate.title, candidate.theme, candidate.central_message]
    .filter(Boolean)
    .join(" ");
  return history.some((item) => {
    const titleSimilarity = ideaTextSimilarity(candidate.title, item.title);
    const themeSimilarity = ideaTextSimilarity(candidate.theme, item.theme);
    const combinedSimilarity = ideaTextSimilarity(candidateText, historyItemText(item));
    return (
      titleSimilarity >= threshold ||
      themeSimilarity >= threshold ||
      combinedSimilarity >= threshold + 0.04
    );
  });
}

export function noveltyScoreAgainstHistory(
  candidate: { title: string; theme: string; central_message?: string },
  history: IdeaHistoryItem[],
): number {
  if (history.length === 0) return 3;
  let highest = 0;
  const candidateText = [candidate.title, candidate.theme, candidate.central_message]
    .filter(Boolean)
    .join(" ");
  for (const item of history) {
    highest = Math.max(
      highest,
      ideaTextSimilarity(candidate.title, item.title),
      ideaTextSimilarity(candidate.theme, item.theme),
      ideaTextSimilarity(candidateText, historyItemText(item)),
    );
  }
  if (highest < 0.28) return 3;
  if (highest < 0.48) return 1;
  if (highest < 0.68) return -2;
  return -4;
}
