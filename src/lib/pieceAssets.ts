// Helpers para upload / leitura / remoção de artes finais anexadas às peças.
// Bucket privado: piece-assets. Caminho: <user_id>/<project_id>/<output_id>/<timestamp>-<nome>
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PieceAsset = Tables<"content_piece_assets">;

export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/webp"] as const;
export const ALLOWED_SCRIPT_VISUAL_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;
export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
export const MAX_SCRIPT_VISUAL_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
export const ALLOWED_REEL_FINAL_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const MAX_REEL_FINAL_VIDEO_FILE_SIZE = 300 * 1024 * 1024; // 300 MB

export function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
    return "Formato inválido. Use PNG, JPG, JPEG ou WebP.";
  }
  if (file.size > MAX_FILE_SIZE) return "Arquivo acima de 15 MB.";
  if (file.size === 0) return "Arquivo vazio ou corrompido.";
  return null;
}

export function validateReelFinalVideoFile(file: File): string | null {
  if (!ALLOWED_REEL_FINAL_VIDEO_MIME.includes(file.type as (typeof ALLOWED_REEL_FINAL_VIDEO_MIME)[number])) {
    return "Formato inválido. Use MP4, MOV ou WebM.";
  }
  if (file.size > MAX_REEL_FINAL_VIDEO_FILE_SIZE) return "Arquivo acima de 300 MB.";
  if (file.size === 0) return "Arquivo vazio ou corrompido.";
  return null;
}

export function isReelFinalVideoAsset(asset: PieceAsset): boolean {
  return asset.storage_path.includes("/final-video/") || asset.file_type.startsWith("video/");
}

export function isReelScriptVisualAsset(asset: PieceAsset): boolean {
  return asset.storage_path.includes("/script-visual/");
}

export function validateScriptVisualFile(file: File): string | null {
  if (
    !ALLOWED_SCRIPT_VISUAL_MIME.includes(file.type as (typeof ALLOWED_SCRIPT_VISUAL_MIME)[number])
  ) {
    return "Formato inválido. Use PDF, PNG, JPG, JPEG ou WebP.";
  }
  if (file.size > MAX_SCRIPT_VISUAL_FILE_SIZE) return "Arquivo acima de 30 MB.";
  if (file.size === 0) return "Arquivo vazio ou corrompido.";
  return null;
}

export async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(r);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
}

export async function uploadPieceAsset(params: {
  userId: string;
  projectId: string;
  outputId: string;
  file: File;
  displayOrder?: number;
  includeInClientPdf?: boolean;
}): Promise<PieceAsset> {
  const { userId, projectId, outputId, file } = params;
  const err = validateFile(file);
  if (err) throw new Error(err);
  const dims = await readImageSize(file);
  const path = `${userId}/${projectId}/${outputId}/${Date.now()}-${sanitizeName(file.name)}`;
  const { error: upErr } = await supabase.storage.from("piece-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("content_piece_assets")
    .insert({
      user_id: userId,
      project_id: projectId,
      output_id: outputId,
      storage_path: path,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      image_width: dims.width || null,
      image_height: dims.height || null,
      display_order: params.displayOrder ?? 0,
      include_in_client_pdf: params.includeInClientPdf ?? true,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from("piece-assets").remove([path]);
    throw error;
  }
  return data as PieceAsset;
}

export async function deletePieceAsset(asset: PieceAsset): Promise<void> {
  await supabase.storage.from("piece-assets").remove([asset.storage_path]);
  const { error } = await supabase.from("content_piece_assets").delete().eq("id", asset.id);
  if (error) throw error;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from("piece-assets")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchAssetsForProject(projectId: string): Promise<PieceAsset[]> {
  const { data, error } = await supabase
    .from("content_piece_assets")
    .select("*")
    .eq("project_id", projectId)
    .order("display_order");
  if (error) throw error;
  return (data ?? []) as PieceAsset[];
}

export async function toggleApproval(id: string, approved: boolean): Promise<void> {
  const { error } = await supabase
    .from("content_piece_assets")
    .update({ is_approved: approved })
    .eq("id", id);
  if (error) throw error;
}

export async function toggleIncludeInPdf(id: string, include: boolean): Promise<void> {
  const { error } = await supabase
    .from("content_piece_assets")
    .update({ include_in_client_pdf: include })
    .eq("id", id);
  if (error) throw error;
}

export async function updateAssetOrder(
  id: string,
  displayOrder: number,
  outputId?: string,
): Promise<void> {
  const patch = outputId
    ? { display_order: displayOrder, output_id: outputId }
    : { display_order: displayOrder };
  const { error } = await supabase.from("content_piece_assets").update(patch).eq("id", id);
  if (error) throw error;
}

/** Tenta extrair numeração do nome do arquivo (pagina-02.png → 2). */
export function extractFileNumber(name: string): number | null {
  const m = name.match(/(\d{1,4})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export async function blobFromSignedUrl(path: string): Promise<Blob> {
  const url = await getSignedUrl(path, 600);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao baixar arte");
  return await res.blob();
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Faz upload do visual do roteiro (PDF ou imagem) usando o bucket privado já existente.
 * O arquivo é associado ao output do roteiro e fica disponível no portal de aprovação.
 * O backend público expõe somente a versão visual mais recente de cada roteiro.
 */
export async function uploadReelScriptVisualAsset(params: {
  userId: string;
  projectId: string;
  outputId: string;
  file: File;
  displayOrder?: number;
}): Promise<PieceAsset> {
  const { userId, projectId, outputId, file } = params;
  const err = validateScriptVisualFile(file);
  if (err) throw new Error(err);

  const dims = file.type.startsWith("image/") ? await readImageSize(file) : { width: 0, height: 0 };
  const path = `${userId}/${projectId}/${outputId}/script-visual/${Date.now()}-${sanitizeName(file.name)}`;
  const { error: upErr } = await supabase.storage.from("piece-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("content_piece_assets")
    .insert({
      user_id: userId,
      project_id: projectId,
      output_id: outputId,
      storage_path: path,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      image_width: dims.width || null,
      image_height: dims.height || null,
      display_order: params.displayOrder ?? 0,
      include_in_client_pdf: true,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from("piece-assets").remove([path]);
    throw error;
  }
  return data as PieceAsset;
}


/**
 * Faz upload do vídeo final do Reel 2.0.
 * O arquivo fica ligado ao output do roteiro para manter o pacote do Reel em uma única aba,
 * mas é marcado como arquivo publicável para aparecer no portal de aprovação.
 */
export async function uploadReelFinalVideoAsset(params: {
  userId: string;
  projectId: string;
  outputId: string;
  file: File;
  displayOrder?: number;
}): Promise<PieceAsset> {
  const { userId, projectId, outputId, file } = params;
  const err = validateReelFinalVideoFile(file);
  if (err) throw new Error(err);

  const path = `${userId}/${projectId}/${outputId}/final-video/${Date.now()}-${sanitizeName(file.name)}`;
  const { error: upErr } = await supabase.storage.from("piece-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("content_piece_assets")
    .insert({
      user_id: userId,
      project_id: projectId,
      output_id: outputId,
      storage_path: path,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      image_width: null,
      image_height: null,
      display_order: params.displayOrder ?? 0,
      include_in_client_pdf: true,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from("piece-assets").remove([path]);
    throw error;
  }
  return data as PieceAsset;
}
