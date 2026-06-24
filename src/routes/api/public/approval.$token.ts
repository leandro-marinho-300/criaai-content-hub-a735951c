// Rota pública para o Portal de Aprovação do Cliente.
// GET: valida token / senha / expiração; carrega dados; registra visualização.
// POST: registra a resposta do cliente.
// Não exige autenticação. Usa service role apenas após validar o token.
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { parsePiece } from "@/lib/promptBuilder";
import { verifyApprovalPassword } from "@/lib/approvalToken";

const MAX_PASSWORD_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function loadApproval(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = hashToken(token);
  const { data: approval } = await supabaseAdmin
    .from("client_approvals")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  return { supabaseAdmin, approval };
}

function approvalState(approval: {
  revoked_at: string | null;
  expires_at: string | null;
}): "ok" | "revoked" | "expired" {
  if (approval.revoked_at) return "revoked";
  if (approval.expires_at && new Date(approval.expires_at).getTime() < Date.now()) return "expired";
  return "ok";
}

export const Route = createFileRoute("/api/public/approval/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = params.token;
        if (!token || token.length < 16) return json({ error: "invalid" }, 404);
        const { supabaseAdmin, approval } = await loadApproval(token);
        if (!approval) return json({ error: "invalid" }, 404);
        const state = approvalState(approval);
        if (state !== "ok") return json({ state }, 200);

        // Bloqueio temporário por tentativas
        if (approval.locked_until && new Date(approval.locked_until).getTime() > Date.now()) {
          return json({ state: "locked", lockedUntil: approval.locked_until }, 200);
        }

        // Verifica senha (se houver)
        if (approval.password_hash) {
          const provided = request.headers.get("x-approval-password") ?? "";
          if (!provided) {
            return json({ state: "password_required" }, 200);
          }
          const ok = await verifyApprovalPassword(provided, approval.password_hash);
          if (!ok) {
            const attempts = (approval.failed_attempts ?? 0) + 1;
            const shouldLock = attempts >= MAX_PASSWORD_ATTEMPTS;
            const lockedUntil = shouldLock
              ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
              : null;
            await supabaseAdmin
              .from("client_approvals")
              .update({
                failed_attempts: shouldLock ? 0 : attempts,
                locked_until: lockedUntil,
              })
              .eq("id", approval.id);
            return json(
              {
                state: shouldLock ? "locked" : "password_invalid",
                attemptsLeft: shouldLock ? 0 : MAX_PASSWORD_ATTEMPTS - attempts,
                lockedUntil,
              },
              200,
            );
          }
          if ((approval.failed_attempts ?? 0) > 0) {
            await supabaseAdmin
              .from("client_approvals")
              .update({ failed_attempts: 0, locked_until: null })
              .eq("id", approval.id);
          }
        }

        // Registra visualização
        const now = new Date().toISOString();
        await supabaseAdmin
          .from("client_approvals")
          .update({
            view_count: (approval.view_count ?? 0) + 1,
            first_viewed_at: approval.first_viewed_at ?? now,
            last_viewed_at: now,
            status:
              approval.status === "enviado_para_aprovacao" || approval.status === "rascunho"
                ? "visualizado_pelo_cliente"
                : approval.status,
          })
          .eq("id", approval.id);
        await supabaseAdmin
          .from("client_approval_events")
          .insert({ approval_id: approval.id, user_id: approval.user_id, event_type: "viewed" });

        // Carrega dados autorizados
        const { data: project } = await supabaseAdmin
          .from("content_projects")
          .select("id, display_title, internal_title, theme")
          .eq("id", approval.project_id)
          .single();
        const { data: brand } = approval.brand_id
          ? await supabaseAdmin
              .from("brands")
              .select("name, logo_url")
              .eq("id", approval.brand_id)
              .single()
          : { data: null };
        const { data: outputs } = await supabaseAdmin
          .from("content_outputs")
          .select("id, output_type, title, edited_content, original_content, display_order")
          .eq("project_id", approval.project_id)
          .eq("output_type", "piece")
          .order("display_order");
        const { data: assets } = await supabaseAdmin
          .from("content_piece_assets")
          .select(
            "id, output_id, storage_path, file_name, file_type, image_width, image_height, display_order, include_in_client_pdf, is_approved, created_at",
          )
          .eq("project_id", approval.project_id)
          .order("display_order");
        const { data: items } = await supabaseAdmin
          .from("client_approval_items")
          .select("output_id, decision, comment")
          .eq("approval_id", approval.id);

        // Gera URLs assinadas (1h) para as artes
        const piecesPayload = await Promise.all(
          (outputs ?? []).map(async (o) => {
            const piece = parsePiece(o.edited_content ?? o.original_content ?? "");
            const outputAssets = (assets ?? []).filter((a) => a.output_id === o.id);
            const regularClientAssets = outputAssets.filter(
              (a) => a.include_in_client_pdf && !a.storage_path.includes("/script-visual/"),
            );
            const latestScriptVisual = outputAssets
              .filter((a) => a.storage_path.includes("/script-visual/"))
              .sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              )[0];
            // Compatibilidade com uploads antigos: o visual do roteiro era salvo com
            // include_in_client_pdf=false. Ainda assim, a versão mais recente deve
            // aparecer no portal para o cliente conferir se o storyboard corresponde
            // ao pedido aprovado.
            const pieceAssets = latestScriptVisual
              ? [...regularClientAssets, latestScriptVisual]
              : regularClientAssets;
            const signed = await Promise.all(
              pieceAssets.map(async (a) => {
                const { data: sig } = await supabaseAdmin.storage
                  .from("piece-assets")
                  .createSignedUrl(a.storage_path, 60 * 60);
                return {
                  id: a.id,
                  url: sig?.signedUrl ?? null,
                  width: a.image_width,
                  height: a.image_height,
                  fileName: a.file_name,
                  fileType: a.file_type,
                  isScriptVisual: a.storage_path.includes("/script-visual/"),
                };
              }),
            );
            const existing = (items ?? []).find((i) => i.output_id === o.id);
            return {
              outputId: o.id,
              title: o.title ?? piece?.name ?? `Peça ${o.display_order + 1}`,
              caption: approval.include_caption ? (piece?.caption ?? piece?.mainText ?? "") : null,
              hashtags: approval.include_hashtags ? (piece?.hashtags ?? []) : null,
              order: o.display_order,
              assets: signed,
              decision: existing?.decision ?? "pending",
              comment: existing?.comment ?? "",
            };
          }),
        );

        return json({
          state: "ok",
          alreadyResponded: !!approval.submitted_at,
          allowMultipleResponses: approval.allow_multiple_responses,
          allowPieceApproval: approval.allow_piece_approval,
          allowPieceComments: approval.allow_piece_comments,
          includeCaption: approval.include_caption,
          includeHashtags: approval.include_hashtags,
          expiresAt: approval.expires_at,
          approval: {
            id: approval.id,
            title: approval.title,
            introductionMessage: approval.introduction_message,
            decision: approval.decision,
            generalComment: approval.general_comment,
            clientName: approval.client_name,
          },
          brand: brand ? { name: brand.name, logoUrl: brand.logo_url } : null,
          project: { title: project?.display_title || project?.internal_title || "Campanha" },
          pieces: piecesPayload,
        });
      },

      POST: async ({ params, request }) => {
        const token = params.token;
        if (!token || token.length < 16) return json({ error: "invalid" }, 404);
        const { supabaseAdmin, approval } = await loadApproval(token);
        if (!approval) return json({ error: "invalid" }, 404);
        const state = approvalState(approval);
        if (state !== "ok") return json({ error: state }, 410);
        if (approval.locked_until && new Date(approval.locked_until).getTime() > Date.now()) {
          return json({ error: "locked" }, 423);
        }
        if (approval.password_hash) {
          const provided = request.headers.get("x-approval-password") ?? "";
          const ok = provided && (await verifyApprovalPassword(provided, approval.password_hash));
          if (!ok) return json({ error: "password_required" }, 401);
        }
        if (approval.submitted_at && !approval.allow_multiple_responses) {
          return json({ error: "already_responded" }, 409);
        }

        let body: {
          clientName?: string;
          clientEmail?: string;
          clientRole?: string;
          clientCompany?: string;
          decision?: "approved" | "approved_with_changes" | "changes_requested" | "rejected";
          generalComment?: string;
          pieces?: Array<{ outputId: string; decision: string; comment?: string }>;
        };
        try {
          body = await request.json();
        } catch {
          return json({ error: "bad_request" }, 400);
        }

        if (!body.clientName || body.clientName.trim().length < 2) {
          return json({ error: "name_required" }, 400);
        }
        const validDecisions = [
          "approved",
          "approved_with_changes",
          "changes_requested",
          "rejected",
        ] as const;
        if (!body.decision || !validDecisions.includes(body.decision)) {
          return json({ error: "decision_required" }, 400);
        }
        if (
          (body.decision === "changes_requested" || body.decision === "rejected") &&
          !body.generalComment?.trim()
        ) {
          return json({ error: "comment_required" }, 400);
        }

        const now = new Date().toISOString();
        const statusMap: Record<string, string> = {
          approved: "aprovado",
          approved_with_changes: "aprovado_com_ajustes",
          changes_requested: "ajustes_solicitados",
          rejected: "recusado",
        };

        await supabaseAdmin
          .from("client_approvals")
          .update({
            status: statusMap[body.decision],
            decision: body.decision,
            general_comment: body.generalComment?.trim() || null,
            client_name: body.clientName.trim(),
            client_email: body.clientEmail?.trim() || null,
            client_role: body.clientRole?.trim() || null,
            client_company: body.clientCompany?.trim() || null,
            submitted_at: now,
          })
          .eq("id", approval.id);

        if (approval.allow_piece_approval && Array.isArray(body.pieces)) {
          await supabaseAdmin.from("client_approval_items").delete().eq("approval_id", approval.id);
          const rows = body.pieces
            .filter((p) => p.outputId)
            .map((p) => {
              const normalizedDecision =
                body.decision === "approved"
                  ? "approved"
                  : ["pending", "approved", "changes_requested", "rejected", "excluded"].includes(
                        p.decision,
                      )
                    ? p.decision
                    : "pending";
              return {
                approval_id: approval.id,
                user_id: approval.user_id,
                output_id: p.outputId,
                decision: normalizedDecision,
                comment: normalizedDecision === "approved" ? null : p.comment?.trim() || null,
                display_order: 0,
              };
            });
          if (rows.length > 0) {
            await supabaseAdmin.from("client_approval_items").insert(rows);
          }
        }

        await supabaseAdmin.from("client_approval_events").insert({
          approval_id: approval.id,
          user_id: approval.user_id,
          event_type: "submitted",
          metadata: { decision: body.decision, client_name: body.clientName },
        });

        const projectStatusMap: Record<string, string> = {
          approved: "approved",
          approved_with_changes: "approved",
          changes_requested: "review",
          rejected: "review",
        };
        await supabaseAdmin
          .from("content_projects")
          .update({ status: projectStatusMap[body.decision] })
          .eq("id", approval.project_id);

        return json({ ok: true });
      },
    },
  },
});
