// Gerador do "PDF para o cliente" — modelos COMPACTO (3 páginas) e DETALHADO (1 arte/página).
// Renderiza páginas HTML em DOM oculto, captura via html2canvas-pro, monta o PDF com jsPDF.
// Essa estratégia preserva emojis, acentos, parágrafos, hashtags e quebras conforme o navegador renderiza.
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { blobFromSignedUrl, blobToDataUrl, type PieceAsset } from "./pieceAssets";
import { fileSlug, normalizeForPdf } from "./pdfTextIntegrity";

export type PdfModel = "compact" | "detailed";
export type ScheduleMode = "client_defines" | "suggested" | "confirmed";

export interface ClientPdfPiece {
  outputId: string;
  label: string;
  shortLabel?: string;          // ex: "1 — Capa"
  assets: PieceAsset[];
  hidden?: boolean;
}

export interface PdfScheduleData {
  mode: ScheduleMode;
  channel?: string;
  suggestedDate?: string;
  suggestedTime?: string;
  confirmedDate?: string;
  confirmedTime?: string;
  responsible?: string;
  status?: string;
  notes?: string;
}

export interface PdfFontStack {
  body: string;
  heading: string;
}

export interface ClientPdfInput {
  model: PdfModel;
  brandName: string;
  brandLogoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  title: string;
  subtitle?: string;
  formatLabel?: string;
  versionLabel?: string;
  statusLabel?: string;           // "Para aprovação" | "Aprovado" | ...
  caption?: string;
  hashtags?: string[];
  pieces: ClientPdfPiece[];
  schedule?: PdfScheduleData;
  options: {
    theme: "light" | "dark";
    showLogo: boolean;
    showPieceNumber: boolean;
    includeCover: boolean;
    includeFinalPage: boolean;
    fontStack?: PdfFontStack;
  };
}

// A4 dimensions em milímetros
const A4_PORTRAIT = { w: 210, h: 297 };
const A4_LANDSCAPE = { w: 297, h: 210 };
// Conversão para renderização em px (~96dpi): mm * 3.7795
const PX_PER_MM = 3.7795275591;
const RENDER_SCALE = 2; // html2canvas scale: 2x para nitidez

// -----------------------------------------------------------------------------
// Helpers de imagem
// -----------------------------------------------------------------------------
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

async function assetToDataUrl(asset: PieceAsset): Promise<string | null> {
  try {
    const blob = await blobFromSignedUrl(asset.storage_path);
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// DOM offscreen para renderização
// -----------------------------------------------------------------------------
function createPageContainer(orientation: "portrait" | "landscape"): HTMLDivElement {
  const dim = orientation === "portrait" ? A4_PORTRAIT : A4_LANDSCAPE;
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "-99999px";
  el.style.top = "0";
  el.style.width = `${Math.round(dim.w * PX_PER_MM)}px`;
  el.style.height = `${Math.round(dim.h * PX_PER_MM)}px`;
  el.style.background = "#fff";
  el.style.overflow = "hidden";
  el.style.pointerEvents = "none";
  el.setAttribute("data-pdf-page", "true");
  document.body.appendChild(el);
  return el;
}

async function snapshotToImage(node: HTMLElement): Promise<string> {
  const canvas = await html2canvas(node, {
    backgroundColor: null,
    scale: RENDER_SCALE,
    useCORS: true,
    allowTaint: false,
    logging: false,
  });
  return canvas.toDataURL("image/jpeg", 0.94);
}

// -----------------------------------------------------------------------------
// Tema / cores
// -----------------------------------------------------------------------------
interface ThemeTokens {
  bg: string;
  fg: string;
  muted: string;
  border: string;
  card: string;
  accent: string;
  fontBody: string;
  fontHeading: string;
}

function buildTheme(input: ClientPdfInput): ThemeTokens {
  const dark = input.options.theme === "dark";
  const accent = input.accentColor || input.primaryColor || (dark ? "#f97316" : "#ea580c");
  const fontBody = input.options.fontStack?.body
    ?? "'Inter', 'Montserrat', 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  const fontHeading = input.options.fontStack?.heading ?? fontBody;
  return {
    bg: dark ? "#101014" : "#ffffff",
    fg: dark ? "#f4f4f5" : "#18181b",
    muted: dark ? "#a1a1aa" : "#6b7280",
    border: dark ? "#27272a" : "#e5e7eb",
    card: dark ? "#1c1c20" : "#f9fafb",
    accent,
    fontBody,
    fontHeading,
  };
}

function pageBaseStyles(t: ThemeTokens): Partial<CSSStyleDeclaration> {
  return {
    background: t.bg,
    color: t.fg,
    fontFamily: t.fontBody,
    fontSize: "13px",
    lineHeight: "1.55",
    letterSpacing: "normal",
    wordBreak: "normal",
    overflowWrap: "break-word",
    textAlign: "left",
    padding: "0",
    boxSizing: "border-box",
  };
}

function applyStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Quebra parágrafos preservando linhas em branco
function captionToHtml(caption: string): string {
  const safe = escapeHtml(normalizeForPdf(caption));
  return safe
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12px 0;white-space:pre-wrap;">${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

// -----------------------------------------------------------------------------
// Página 1 — Conteúdo (compacto)
// -----------------------------------------------------------------------------
function buildContentPage(input: ClientPdfInput, t: ThemeTokens, logoDataUrl: string | null): HTMLElement {
  const page = createPageContainer("portrait");
  applyStyles(page, pageBaseStyles(t));

  const html = `
    <div style="padding:48px 56px 56px;height:100%;display:flex;flex-direction:column;">
      <header style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${t.border};padding-bottom:16px;">
        <div style="display:flex;align-items:center;gap:14px;">
          ${input.options.showLogo && logoDataUrl ? `<img src="${logoDataUrl}" alt="" style="height:42px;object-fit:contain;"/>` : ""}
          <div style="font-family:${t.fontHeading};font-weight:600;font-size:14px;letter-spacing:0.01em;">${escapeHtml(input.brandName || "")}</div>
        </div>
        ${input.statusLabel ? `<div style="display:inline-block;padding:6px 14px;border-radius:999px;background:${t.accent};color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(input.statusLabel)}</div>` : ""}
      </header>

      <div style="margin-top:42px;">
        <div style="width:48px;height:4px;background:${t.accent};border-radius:2px;margin-bottom:18px;"></div>
        <h1 style="font-family:${t.fontHeading};font-weight:700;font-size:30px;line-height:1.2;margin:0 0 12px 0;color:${t.fg};">${escapeHtml(input.title)}</h1>
        ${input.subtitle ? `<p style="margin:0;color:${t.muted};font-size:14px;">${escapeHtml(input.subtitle)}</p>` : ""}
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;color:${t.muted};font-size:12px;">
          ${input.formatLabel ? `<span>${escapeHtml(input.formatLabel)}</span>` : ""}
          ${input.versionLabel ? `<span>· ${escapeHtml(input.versionLabel)}</span>` : ""}
        </div>
      </div>

      <section style="margin-top:36px;flex:1;">
        <h2 style="font-family:${t.fontHeading};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${t.muted};margin:0 0 10px 0;">Legenda</h2>
        <div style="font-size:13.5px;line-height:1.65;color:${t.fg};">
          ${input.caption ? captionToHtml(input.caption) : `<p style="color:${t.muted};font-style:italic;">Sem legenda definida.</p>`}
        </div>
      </section>

      ${input.hashtags && input.hashtags.length ? `
      <section style="margin-top:24px;padding:16px 18px;background:${t.card};border:1px solid ${t.border};border-radius:10px;">
        <h2 style="font-family:${t.fontHeading};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${t.muted};margin:0 0 8px 0;">Hashtags</h2>
        <div style="font-size:13px;color:${t.accent};word-spacing:6px;line-height:1.7;">
          ${input.hashtags.map((h) => escapeHtml(h.startsWith("#") ? h : `#${h}`)).join(" ")}
        </div>
      </section>` : ""}
    </div>
  `;
  page.innerHTML = html;
  return page;
}

// -----------------------------------------------------------------------------
// Página 2 — Grid de prévia de artes
// -----------------------------------------------------------------------------
function gridLayout(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) return { cols: 3, rows: 1 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  return { cols: 4, rows: 2 };
}

interface GridThumb { dataUrl: string; number: number; label: string }

// Dimensões fixas (mm) para A4 landscape
// pageW=297, pageH=210. Reservamos áreas determinísticas para que tudo caiba.
const GRID_LAYOUT_MM = {
  marginX: 10,
  marginTop: 10,
  marginBottom: 10,
  headerH: 20,      // cabeçalho compacto (máx)
  headerGap: 5,     // espaço entre cabeçalho e grade
  gap: 6,           // gap entre células
  labelH: 7,        // altura reservada para o rótulo
  labelGap: 2,      // espaço entre imagem e rótulo
};

function buildGridPage(thumbs: GridThumb[], input: ClientPdfInput, t: ThemeTokens, pageInfo?: string): HTMLElement {
  const page = createPageContainer("landscape");
  applyStyles(page, pageBaseStyles(t));
  const { cols, rows } = gridLayout(thumbs.length);
  const L = GRID_LAYOUT_MM;

  // Área útil em mm
  const availW = A4_LANDSCAPE.w - L.marginX * 2;
  const availH = A4_LANDSCAPE.h - L.marginTop - L.marginBottom - L.headerH - L.headerGap;
  const cellW = (availW - L.gap * (cols - 1)) / cols;
  const cellH = (availH - L.gap * (rows - 1)) / rows;
  const imageAreaH = cellH - L.labelH - L.labelGap;

  // Converte mm → px para o DOM offscreen (px-per-mm já usado pelo container)
  const mm = (v: number) => `${v * PX_PER_MM}px`;

  const tiles = thumbs.map((th) => `
    <div style="width:${mm(cellW)};height:${mm(cellH)};display:flex;flex-direction:column;align-items:center;box-sizing:border-box;">
      <div style="width:100%;height:${mm(imageAreaH)};display:flex;align-items:center;justify-content:center;background:${t.card};border:1px solid ${t.border};border-radius:8px;overflow:hidden;box-sizing:border-box;">
        <img src="${th.dataUrl}" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;"/>
      </div>
      <div style="height:${mm(L.labelH)};margin-top:${mm(L.labelGap)};font-size:10.5px;color:${t.fg};font-weight:600;text-align:center;line-height:1.2;overflow:hidden;display:flex;align-items:center;justify-content:center;">
        <span><span style="color:${t.accent};">${th.number}</span> — ${escapeHtml(th.label)}</span>
      </div>
    </div>
  `).join("");


  page.innerHTML = `
    <div style="padding:32px 40px;height:100%;display:flex;flex-direction:column;">
      <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <div style="width:36px;height:3px;background:${t.accent};border-radius:2px;margin-bottom:8px;"></div>
          <h1 style="font-family:${t.fontHeading};font-size:22px;font-weight:700;margin:0;color:${t.fg};">Prévia das peças${pageInfo ? ` <span style='font-size:13px;font-weight:400;color:${t.muted};'>(${pageInfo})</span>` : ""}</h1>
        </div>
        <div style="color:${t.muted};font-size:11px;text-align:right;">
          <div style="font-weight:600;color:${t.fg};">${escapeHtml(input.brandName)}</div>
          ${input.title ? `<div>${escapeHtml(input.title)}</div>` : ""}
        </div>
      </header>
      <div style="flex:1;display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr);gap:18px;min-height:0;">
        ${tiles}
      </div>
    </div>
  `;
  return page;
}

// -----------------------------------------------------------------------------
// Página 3 — Planejamento da publicação
// -----------------------------------------------------------------------------
function fieldLine(label: string, value: string | undefined, t: ThemeTokens, placeholder = ""): string {
  return `
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:${t.muted};margin-bottom:3px;">${escapeHtml(label)}</div>
      <div style="font-size:13px;color:${t.fg};min-height:18px;border-bottom:1px dashed ${t.border};padding-bottom:6px;">
        ${value ? escapeHtml(value) : `<span style="color:${t.muted};font-style:italic;">${escapeHtml(placeholder)}</span>`}
      </div>
    </div>`;
}

function checkbox(label: string, t: ThemeTokens, checked = false): string {
  return `
    <div style="display:flex;align-items:center;gap:8px;margin:0 16px 8px 0;">
      <span style="width:14px;height:14px;border:1.5px solid ${t.fg};border-radius:3px;display:inline-block;${checked ? `background:${t.accent};border-color:${t.accent};` : ""}"></span>
      <span style="font-size:12px;color:${t.fg};">${escapeHtml(label)}</span>
    </div>`;
}

function buildSchedulePage(input: ClientPdfInput, t: ThemeTokens): HTMLElement {
  const s = input.schedule || { mode: "client_defines" };
  const page = createPageContainer("portrait");
  applyStyles(page, pageBaseStyles(t));

  const modeTitle = s.mode === "confirmed" ? "Calendário confirmado"
    : s.mode === "suggested" ? "Calendário sugerido"
    : "Cliente define a data";

  const dateRow = s.mode === "confirmed"
    ? `
      ${fieldLine("Data confirmada", s.confirmedDate, t, "__/__/____")}
      ${fieldLine("Horário", s.confirmedTime, t, "__:__")}`
    : s.mode === "suggested"
    ? `
      ${fieldLine("Data sugerida", s.suggestedDate, t, "__/__/____")}
      ${fieldLine("Horário sugerido", s.suggestedTime, t, "__:__")}`
    : `
      ${fieldLine("Data desejada", "", t, "__/__/____")}
      ${fieldLine("Horário desejado", "", t, "__:__")}`;

  const approval = s.mode === "confirmed"
    ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${t.accent};color:#fff;border-radius:8px;font-weight:600;font-size:13px;width:fit-content;">✓ Publicação agendada</div>`
    : `
      <div style="display:flex;flex-wrap:wrap;">
        ${checkbox("Conteúdo aprovado", t)}
        ${checkbox("Aprovado com alterações", t)}
        ${checkbox("Solicitar nova versão", t)}
        ${checkbox("Não aprovado", t)}
      </div>`;

  page.innerHTML = `
    <div style="padding:48px 56px;height:100%;display:flex;flex-direction:column;">
      <header style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${t.border};padding-bottom:14px;margin-bottom:24px;">
        <div style="font-family:${t.fontHeading};font-weight:600;font-size:13px;color:${t.fg};">${escapeHtml(input.brandName)}</div>
        <div style="font-size:11px;color:${t.muted};">${escapeHtml(modeTitle)}</div>
      </header>

      <div style="width:48px;height:4px;background:${t.accent};border-radius:2px;margin-bottom:14px;"></div>
      <h1 style="font-family:${t.fontHeading};font-size:24px;font-weight:700;margin:0 0 4px 0;color:${t.fg};">Planejamento da publicação</h1>
      <p style="margin:0 0 28px 0;color:${t.muted};font-size:13px;">${escapeHtml(input.title)}</p>

      <section style="padding:18px 20px;background:${t.card};border:1px solid ${t.border};border-radius:10px;margin-bottom:22px;">
        <h2 style="font-family:${t.fontHeading};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${t.muted};margin:0 0 12px 0;">Detalhes da publicação</h2>
        ${fieldLine("Conteúdo", input.title, t)}
        ${fieldLine("Canal", s.channel, t, "Ex.: Instagram Feed")}
        ${dateRow}
        ${s.responsible ? fieldLine("Responsável", s.responsible, t) : ""}
      </section>

      <section style="padding:18px 20px;background:${t.card};border:1px solid ${t.border};border-radius:10px;margin-bottom:22px;">
        <h2 style="font-family:${t.fontHeading};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${t.muted};margin:0 0 12px 0;">Aprovação</h2>
        ${approval}
      </section>

      <section style="flex:1;padding:18px 20px;background:${t.card};border:1px solid ${t.border};border-radius:10px;">
        <h2 style="font-family:${t.fontHeading};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${t.muted};margin:0 0 10px 0;">Observações</h2>
        <div style="font-size:13px;color:${t.fg};white-space:pre-wrap;min-height:120px;">${s.notes ? escapeHtml(s.notes) : ""}</div>
      </section>

      <footer style="margin-top:22px;display:flex;justify-content:space-between;font-size:11px;color:${t.muted};">
        <div>Responsável pela aprovação: ____________________________</div>
        <div>Data: ____/____/______</div>
      </footer>
    </div>
  `;
  return page;
}

// -----------------------------------------------------------------------------
// Página detalhada (1 arte por página) - usada no modo detalhado
// -----------------------------------------------------------------------------
function buildDetailedPiecePage(
  input: ClientPdfInput, t: ThemeTokens, opts: { imgDataUrl: string; label: string; idx: number; total: number },
): HTMLElement {
  const page = createPageContainer("portrait");
  applyStyles(page, pageBaseStyles(t));
  page.innerHTML = `
    <div style="padding:36px 44px;height:100%;display:flex;flex-direction:column;">
      <header style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:${t.muted};margin-bottom:14px;">
        <div>${escapeHtml(input.brandName)}</div>
        ${input.options.showPieceNumber ? `<div>${opts.idx} / ${opts.total}</div>` : ""}
      </header>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;background:${t.card};border:1px solid ${t.border};border-radius:10px;overflow:hidden;">
        <img src="${opts.imgDataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;"/>
      </div>
      <footer style="margin-top:14px;text-align:center;font-size:12px;color:${t.fg};font-weight:600;">${escapeHtml(opts.label)}</footer>
    </div>
  `;
  return page;
}

// -----------------------------------------------------------------------------
// Conversão snapshot → jsPDF page
// -----------------------------------------------------------------------------
async function addNodeAsPage(doc: jsPDF, node: HTMLElement, orientation: "portrait" | "landscape", first: boolean): Promise<void> {
  const dim = orientation === "portrait" ? A4_PORTRAIT : A4_LANDSCAPE;
  const imgData = await snapshotToImage(node);
  if (!first) doc.addPage([dim.w, dim.h], orientation);
  else doc.deletePage(1), doc.addPage([dim.w, dim.h], orientation);
  doc.addImage(imgData, "JPEG", 0, 0, dim.w, dim.h, undefined, "FAST");
  node.remove();
}

// -----------------------------------------------------------------------------
// API principal
// -----------------------------------------------------------------------------
export async function generateClientPdf(input: ClientPdfInput): Promise<Blob> {
  const t = buildTheme(input);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });

  // Pré-carrega logo
  const logoDataUrl = input.options.showLogo && input.brandLogoUrl ? await urlToDataUrl(input.brandLogoUrl) : null;

  // Coleta artes em sequência preservando ordem
  const visiblePieces = input.pieces.filter((p) => !p.hidden);
  type LoadedAsset = { piece: ClientPdfPiece; asset: PieceAsset; dataUrl: string };
  const loaded: LoadedAsset[] = [];
  for (const piece of visiblePieces) {
    const sorted = piece.assets.slice().sort((a, b) => a.display_order - b.display_order);
    for (const a of sorted) {
      if ((a as PieceAsset & { include_in_client_pdf?: boolean }).include_in_client_pdf === false) continue;
      const dataUrl = await assetToDataUrl(a);
      if (dataUrl) loaded.push({ piece, asset: a, dataUrl });
    }
  }

  let firstPage = true;

  if (input.model === "compact") {
    // PÁGINA 1 — conteúdo (sempre)
    const p1 = buildContentPage(input, t, logoDataUrl);
    await addNodeAsPage(doc, p1, "portrait", firstPage); firstPage = false;

    // PÁGINA 2+ — grade de prévia (pode quebrar em várias se >8)
    const thumbs: GridThumb[] = loaded.map((l, i) => {
      const labelBase = l.piece.shortLabel || l.piece.label || `Peça ${i + 1}`;
      const shortLabel = labelBase.replace(/^Página\s+\d+\s+de\s+\d+\s+—\s+/i, "");
      return { dataUrl: l.dataUrl, number: i + 1, label: shortLabel };
    });
    if (thumbs.length === 0) {
      // página de aviso minimalista
      const wrap = createPageContainer("landscape");
      applyStyles(wrap, pageBaseStyles(t));
      wrap.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:${t.muted};">Nenhuma arte anexada.</div>`;
      await addNodeAsPage(doc, wrap, "landscape", firstPage); firstPage = false;
    } else {
      const MAX_PER_PAGE = 8;
      const totalPages = Math.ceil(thumbs.length / MAX_PER_PAGE);
      for (let i = 0; i < totalPages; i++) {
        const slice = thumbs.slice(i * MAX_PER_PAGE, (i + 1) * MAX_PER_PAGE);
        const info = totalPages > 1 ? `parte ${i + 1} de ${totalPages}` : undefined;
        const node = buildGridPage(slice, input, t, info);
        await addNodeAsPage(doc, node, "landscape", firstPage); firstPage = false;
      }
    }

    // PÁGINA 3 — planejamento
    const p3 = buildSchedulePage(input, t);
    await addNodeAsPage(doc, p3, "portrait", firstPage); firstPage = false;
  } else {
    // Modo detalhado
    if (input.options.includeCover) {
      const p1 = buildContentPage(input, t, logoDataUrl);
      await addNodeAsPage(doc, p1, "portrait", firstPage); firstPage = false;
    }
    const total = loaded.length;
    for (let i = 0; i < loaded.length; i++) {
      const l = loaded[i];
      const node = buildDetailedPiecePage(input, t, {
        imgDataUrl: l.dataUrl,
        label: l.piece.label,
        idx: i + 1,
        total,
      });
      await addNodeAsPage(doc, node, "portrait", firstPage); firstPage = false;
    }
    if (input.options.includeFinalPage) {
      const last = buildSchedulePage(input, t);
      await addNodeAsPage(doc, last, "portrait", firstPage); firstPage = false;
    }
  }

  return doc.output("blob");
}

// -----------------------------------------------------------------------------
// Nomes de arquivo
// -----------------------------------------------------------------------------
export function buildPdfFileName(brand: string, title: string, model: PdfModel): string {
  const b = fileSlug(brand) || "marca";
  const t = fileSlug(title) || "apresentacao";
  const suffix = model === "compact" ? "aprovacao" : "apresentacao-detalhada";
  return `${b}-${t}-${suffix}.pdf`;
}

// Mantido por compatibilidade com chamadas antigas
export function slugifyFileName(brand: string, title: string): string {
  return buildPdfFileName(brand, title, "detailed").replace("-apresentacao-detalhada", "-apresentacao");
}
