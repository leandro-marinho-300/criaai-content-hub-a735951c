// Modal "Enviar para aprovação": cria um link público seguro vinculado ao projeto.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Send, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { generateApprovalToken, hashApprovalToken, approvalUrl } from "@/lib/approvalToken";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  brandId: string | null;
  defaultTitle: string;
}

const DEFAULT_MESSAGE =
  "Olá! Preparamos esta proposta de conteúdo para sua aprovação. Revise as peças, legenda e registre sua decisão.";

export function SendForApprovalDialog({ open, onOpenChange, projectId, brandId, defaultTitle }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [includeCaption, setIncludeCaption] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [allowPieceApproval, setAllowPieceApproval] = useState(true);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const { data: existing } = useQuery({
    queryKey: ["approvals", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_approvals")
        .select("id, status, submitted_at, view_count, created_at, revoked_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada.");
      const token = generateApprovalToken();
      const tokenHash = await hashApprovalToken(token);
      const { error } = await supabase.from("client_approvals").insert({
        user_id: user.id,
        project_id: projectId,
        brand_id: brandId,
        token_hash: tokenHash,
        title: title.trim() || defaultTitle || "Aprovação de conteúdo",
        introduction_message: message.trim() || null,
        include_caption: includeCaption,
        include_hashtags: includeHashtags,
        allow_piece_approval: allowPieceApproval,
        allow_piece_comments: allowPieceApproval,
        status: "enviado_para_aprovacao",
      });
      if (error) throw error;
      return approvalUrl(token);
    },
    onSuccess: (url) => {
      setCreatedUrl(url);
      qc.invalidateQueries({ queryKey: ["approvals", projectId] });
      qc.invalidateQueries({ queryKey: ["approvals-panel", projectId] });
      toast.success("Link de aprovação criado.");
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao criar link."),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_approvals")
        .update({ status: "link_revogado", revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link revogado.");
      qc.invalidateQueries({ queryKey: ["approvals", projectId] });
    },
  });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setCreatedUrl(null); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enviar para aprovação</DialogTitle>
          <DialogDescription>
            Gere um link público para o cliente revisar e aprovar este conteúdo, sem precisar criar conta.
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3">
              <Label className="text-xs uppercase text-muted-foreground">Link gerado</Label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={createdUrl} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copy(createdUrl)}>
                  <Copy className="mr-1 h-4 w-4" />Copiar
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={createdUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" />Abrir
                  </a>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <ShieldAlert className="mr-1 inline h-3 w-3" />
                Este link só será exibido agora. Copie e envie ao cliente.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { setCreatedUrl(null); onOpenChange(false); }}>Concluir</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="ap-title">Título para o cliente</Label>
              <Input id="ap-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="ap-msg">Mensagem de apresentação</Label>
              <Textarea id="ap-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            </div>
            <div className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="ap-cap">Incluir legenda</Label>
                  <p className="text-xs text-muted-foreground">Mostra o texto sugerido para a publicação.</p>
                </div>
                <Switch id="ap-cap" checked={includeCaption} onCheckedChange={setIncludeCaption} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="ap-tags">Incluir hashtags</Label>
                  <p className="text-xs text-muted-foreground">Mostra as hashtags sugeridas.</p>
                </div>
                <Switch id="ap-tags" checked={includeHashtags} onCheckedChange={setIncludeHashtags} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="ap-piece">Aprovação por peça</Label>
                  <p className="text-xs text-muted-foreground">Cliente pode aprovar ou comentar cada peça individualmente.</p>
                </div>
                <Switch id="ap-piece" checked={allowPieceApproval} onCheckedChange={setAllowPieceApproval} />
              </div>
            </div>

            {existing && existing.length > 0 && (
              <div className="rounded-md border p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Links existentes</p>
                <ul className="space-y-1.5 text-sm">
                  {existing.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <Badge variant={a.revoked_at ? "outline" : "secondary"} className="text-xs">
                        {a.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("pt-BR")} · {a.view_count} visualização(ões)
                      </span>
                      {!a.revoked_at && a.status !== "link_revogado" && (
                        <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs"
                          onClick={() => revoke.mutate(a.id)}>
                          Revogar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                <Send className="mr-2 h-4 w-4" />
                {create.isPending ? "Gerando..." : "Gerar link de aprovação"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
