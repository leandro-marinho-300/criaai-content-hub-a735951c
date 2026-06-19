// Gerador dedicado do "PDF para o cliente" usando jsPDF.
// Não depende do CSS da página de resultado. Layout próprio, A4 retrato.
import { jsPDF } from "jspdf";
import { blobFromSignedUrl, blobToDataUrl, type PieceAsset } from "./pieceAssets";

export interface ClientPdfPiece {
  outputId: string;
  label: string;             // ex: "Página 1 de 6 — Capa"
  assets: PieceAsset[];      // 1 ou mais (carrossel)
  hidden?: boolean;
}

export interface ClientPdfInput {
  brandName: string;
  brandLogoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  title: string;
  subtitle?: string;
  formatLabel?: string;
  versionLabel?: string;
  caption?: string;
  hashtags?: string[];
  pieces: ClientPdfPiece[];
  options: {
    theme: "light" | "dark";
    showLogo: boolean;
    showPieceNumber: boolean;
    includeCover: boolean;
    includeFinalPage: boolean;
    accentColor?: string;
  };
}

// A4 = 210 x 297 mm (em pt: 595.28 x 841.89)
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;

function hexToRgb(hex?: string | null): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

async function urlToDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

async function assetToDataUrl(asset: PieceAsset): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const blob = await blobFromSignedUrl(asset.storage_path);
    const dataUrl = await blobToDataUrl(blob);
    return {
      dataUrl,
      width: asset.image_width || 0,
      height: asset.image_height || 0,
    };
  } catch {
    return null;
  }
}

function detectFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

export async function generateClientPdf(input: ClientPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  const accent = hexToRgb(input.options.accentColor || input.primaryColor) ?? { r: 90, g: 60, b: 220 };
  const isDark = input.options.theme === "dark";
  const bg = isDark ? { r: 17, g: 17, b: 22 } : { r: 255, g: 255, b: 255 };
  const fg = isDark ? { r: 240, g: 240, b: 245 } : { r: 30, g: 30, b: 35 };
  const muted = isDark ? { r: 170, g: 170, b: 180 } : { r: 110, g: 110, b: 120 };

  const fillBg = () => {
    doc.setFillColor(bg.r, bg.g, bg.b);
    doc.rect(0, 0, A4.w, A4.h, "F");
  };

  const drawFooter = (pageLabel?: string) => {
    if (!pageLabel) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(muted.r, muted.g, muted.b);
    doc.text(pageLabel, A4.w / 2, A4.h - 24, { align: "center" });
  };

  const drawAccentBar = (y = MARGIN - 18) => {
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.rect(MARGIN, y, 40, 3, "F");
  };

  // Pré-carrega logo
  let logoData: { dataUrl: string; width: number; height: number } | null = null;
  if (input.options.showLogo && input.brandLogoUrl) {
    logoData = await urlToDataUrl(input.brandLogoUrl);
  }

  // ============ CAPA ============
  if (input.options.includeCover) {
    fillBg();
    drawAccentBar(MARGIN);

    if (logoData) {
      const maxH = 60;
      const ratio = logoData.width / Math.max(1, logoData.height);
      const h = maxH;
      const w = Math.min(180, h * ratio);
      try {
        doc.addImage(logoData.dataUrl, detectFormat(logoData.dataUrl), MARGIN, MARGIN + 12, w, h, undefined, "FAST");
      } catch {
        // ignore
      }
    }

    const titleY = A4.h * 0.42;
    doc.setTextColor(fg.r, fg.g, fg.b);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    const titleLines = doc.splitTextToSize(input.title || "Apresentação", A4.w - MARGIN * 2);
    doc.text(titleLines, MARGIN, titleY);

    if (input.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.setTextColor(muted.r, muted.g, muted.b);
      const subY = titleY + titleLines.length * 34 + 12;
      const subLines = doc.splitTextToSize(input.subtitle, A4.w - MARGIN * 2);
      doc.text(subLines, MARGIN, subY);
    }

    // Rodapé com marca / data
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(muted.r, muted.g, muted.b);
    const footerBits = [input.brandName, input.formatLabel, input.versionLabel].filter(Boolean).join(" · ");
    if (footerBits) doc.text(footerBits, MARGIN, A4.h - MARGIN);

    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(2);
    doc.line(MARGIN, A4.h - MARGIN - 12, MARGIN + 40, A4.h - MARGIN - 12);
  }

  // ============ PEÇAS ============
  let pieceCounter = 0;
  const totalPieces = input.pieces.filter((p) => !p.hidden).reduce((s, p) => s + p.assets.length, 0);

  for (const piece of input.pieces) {
    if (piece.hidden) continue;
    for (let i = 0; i < piece.assets.length; i++) {
      pieceCounter++;
      const asset = piece.assets[i];
      const img = await assetToDataUrl(asset);
      if (!img) continue;

      doc.addPage();
      fillBg();

      // Cabeçalho fino
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(muted.r, muted.g, muted.b);
      if (input.options.showLogo && input.brandName) {
        doc.text(input.brandName, MARGIN, MARGIN);
      }
      if (input.options.showPieceNumber) {
        doc.text(`${pieceCounter} / ${totalPieces}`, A4.w - MARGIN, MARGIN, { align: "right" });
      }

      // Área da imagem
      const topGutter = MARGIN + 14;
      const bottomGutter = MARGIN + 36;
      const areaW = A4.w - MARGIN * 2;
      const areaH = A4.h - topGutter - bottomGutter;
      const imgW = img.width || 1000;
      const imgH = img.height || 1000;
      const scale = Math.min(areaW / imgW, areaH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = (A4.w - drawW) / 2;
      const drawY = topGutter + (areaH - drawH) / 2;

      try {
        doc.addImage(img.dataUrl, detectFormat(img.dataUrl), drawX, drawY, drawW, drawH, undefined, "FAST");
      } catch {
        doc.setTextColor(180, 60, 60);
        doc.text("Falha ao incorporar imagem", MARGIN, topGutter + 40);
      }

      // Rótulo / rodapé
      const label = piece.assets.length > 1 ? `${piece.label} · Imagem ${i + 1}` : piece.label;
      drawFooter(label);
    }
  }

  // ============ LEGENDA + HASHTAGS ============
  if (input.options.includeFinalPage && ((input.caption && input.caption.trim()) || (input.hashtags && input.hashtags.length))) {
    doc.addPage();
    fillBg();
    drawAccentBar();

    let y = MARGIN + 8;

    if (input.caption && input.caption.trim()) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(fg.r, fg.g, fg.b);
      doc.text("Legenda", MARGIN, y);
      y += 22;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(fg.r, fg.g, fg.b);
      const lines = doc.splitTextToSize(input.caption.trim(), A4.w - MARGIN * 2);
      const lineHeight = 15;
      for (const line of lines) {
        if (y > A4.h - MARGIN - 40) {
          doc.addPage();
          fillBg();
          y = MARGIN;
        }
        doc.text(line, MARGIN, y);
        y += lineHeight;
      }
      y += 12;
    }

    if (input.hashtags && input.hashtags.length) {
      if (y > A4.h - MARGIN - 100) {
        doc.addPage();
        fillBg();
        drawAccentBar();
        y = MARGIN + 8;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(fg.r, fg.g, fg.b);
      doc.text("Hashtags", MARGIN, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(accent.r, accent.g, accent.b);
      const text = input.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
      const lines = doc.splitTextToSize(text, A4.w - MARGIN * 2);
      for (const line of lines) {
        if (y > A4.h - MARGIN - 20) {
          doc.addPage();
          fillBg();
          y = MARGIN;
        }
        doc.text(line, MARGIN, y);
        y += 15;
      }
    }
  }

  return doc.output("blob");
}

export function slugifyFileName(brand: string, title: string): string {
  const slug = (s: string) =>
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  const a = slug(brand) || "marca";
  const b = slug(title) || "apresentacao";
  return `${a}-${b}-apresentacao.pdf`;
}
