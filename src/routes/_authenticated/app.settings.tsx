import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, LogOut, Moon, Sun, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/components/theme-provider";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Configurações — Cria Aí" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [defaultFormat, setDefaultFormat] = useState<string>(() => (typeof window !== "undefined" && localStorage.getItem("cria-default-format")) || "post");
  const [defaultMode, setDefaultMode] = useState<string>(() => (typeof window !== "undefined" && localStorage.getItem("cria-default-mode")) || "safe");
  const [customTerms, setCustomTerms] = useState<string>(() => (typeof window !== "undefined" && localStorage.getItem("cria-custom-terms")) || "");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
    supabase.from("profiles").select("full_name").maybeSingle().then(({ data }) => {
      setName(data?.full_name ?? "");
    });
  }, []);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const { error } = await supabase.from("profiles").upsert({ user_id: u.user.id, full_name: name }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Perfil atualizado."),
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const savePrefs = () => {
    localStorage.setItem("cria-default-format", defaultFormat);
    localStorage.setItem("cria-default-mode", defaultMode);
    localStorage.setItem("cria-custom-terms", customTerms);
    toast.success("Preferências salvas.");
  };

  const exportData = async () => {
    const [b, p, o] = await Promise.all([
      supabase.from("brands").select("*"),
      supabase.from("content_projects").select("*"),
      supabase.from("content_outputs").select("*"),
    ]);
    const blob = new Blob([JSON.stringify({ brands: b.data, projects: p.data, outputs: o.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cria-ai-export.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    // remove dados; conta auth é mantida (admin-only). Sai sessão.
    await Promise.all([
      supabase.from("content_outputs").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("content_projects").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("brand_assets").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("brands").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    ]);
    await supabase.auth.signOut();
    toast.success("Dados removidos. Você foi deslogado.");
    navigate({ to: "/auth" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize sua conta e o estúdio.</p>
      </header>

      <Card><CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">Dados do usuário</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>E-mail</Label><Input value={email} disabled /></div>
        </div>
        <div><Button onClick={() => saveProfile.mutate()}>Salvar</Button></div>
      </CardContent></Card>

      <Card><CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">Aparência</h2>
        <div className="flex items-center justify-between">
          <div><Label>Modo escuro</Label><p className="text-xs text-muted-foreground">Alterne entre tema claro e escuro.</p></div>
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch checked={theme === "dark"} onCheckedChange={(c) => setTheme(c ? "dark" : "light")} />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">Padrões de geração</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Formato padrão</Label>
            <Select value={defaultFormat} onValueChange={setDefaultFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="post">Post</SelectItem>
                <SelectItem value="carrossel">Carrossel</SelectItem>
                <SelectItem value="story">Story</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Modo padrão</Label>
            <Select value={defaultMode} onValueChange={setDefaultMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="safe">Seguro</SelectItem>
                <SelectItem value="fast">Rápido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Termos personalizados</Label>
          <Textarea rows={3} value={customTerms} onChange={(e) => setCustomTerms(e.target.value)} placeholder="Termos, regras ou estilo a aplicar em todos os prompts." />
        </div>
        <Button onClick={savePrefs}>Salvar preferências</Button>
      </CardContent></Card>

      <Card><CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">Dados</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}><Download className="mr-2 h-4 w-4" />Exportar meus dados</Button>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir todos os meus dados</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir todos os dados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação remove marcas, projetos, arquivos e modelos pessoais. Não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent></Card>
    </div>
  );
}
