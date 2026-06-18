import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Cria Aí" },
      { name: "description", content: "Acesse seu estúdio de conteúdo Cria Aí." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [stayConnected, setStayConnected] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    if (!stayConnected) {
      // best-effort: encerra sessão ao fechar a aba
      try {
        sessionStorage.setItem("cria-no-persist", "1");
      } catch {}
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    toast.success("Conta criada! Verifique seu e-mail se a confirmação estiver ativada.");
    setTab("login");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao enviar e-mail", { description: error.message });
      return;
    }
    toast.success("Enviamos um link para redefinir sua senha.");
    setTab("login");
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-card p-10 lg:flex">
        <div className="gradient-brand absolute inset-0 opacity-10" />
        <div className="relative flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg gradient-brand">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none">Cria Aí</p>
            <p className="text-xs text-muted-foreground">Estúdio de Conteúdo</p>
          </div>
        </div>
        <div className="relative space-y-3">
          <h1 className="text-3xl font-bold leading-tight">
            Está sem criatividade hoje? <span className="text-gradient-brand">A gente organiza suas ideias.</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre suas marcas, preencha o briefing e receba um pacote completo de prompts profissionais para
            redes sociais.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} Cria Aí</p>
      </aside>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/60">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="grid h-9 w-9 place-items-center rounded-lg gradient-brand">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-display text-lg font-bold leading-none">Cria Aí</p>
                <p className="text-xs text-muted-foreground">Estúdio de Conteúdo</p>
              </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
                <TabsTrigger value="forgot">Esqueci</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPwd ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((s) => !s)}
                        className="absolute inset-y-0 right-2 my-auto grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground"
                        aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={stayConnected} onCheckedChange={(v) => setStayConnected(Boolean(v))} />
                    Permanecer conectado
                  </label>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-s">E-mail</Label>
                    <Input id="email-s" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-s">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password-s"
                        type={showPwd ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((s) => !s)}
                        className="absolute inset-y-0 right-2 my-auto grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground"
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="forgot">
                <form onSubmit={handleForgot} className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Enviaremos um link para redefinir sua senha.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="email-f">E-mail</Label>
                    <Input id="email-f" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Enviando..." : "Enviar link"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
