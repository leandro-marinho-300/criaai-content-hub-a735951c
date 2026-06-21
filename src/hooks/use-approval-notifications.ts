// Hook: assina realtime em client_approvals do usuário e toast quando o cliente responde.
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const DECISION_LABEL: Record<string, string> = {
  aprovado: "Cliente aprovou o conteúdo",
  aprovado_com_ajustes: "Cliente aprovou com ajustes",
  ajustes_solicitados: "Cliente solicitou ajustes",
  recusado: "Cliente não aprovou",
  visualizado_pelo_cliente: "Cliente abriu o link de aprovação",
};

export function useApprovalNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`approvals-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "client_approvals",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { id: string; status: string; submitted_at: string | null };
          const key = `${row.id}:${row.status}`;
          if (seen.current.has(key)) return;
          seen.current.add(key);
          const label = DECISION_LABEL[row.status];
          if (label) {
            toast.info(label, { duration: 6000 });
            qc.invalidateQueries({ queryKey: ["dashboard-approvals"] });
            qc.invalidateQueries({ queryKey: ["approvals-panel"] });
            qc.invalidateQueries({ queryKey: ["library"] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);
}
