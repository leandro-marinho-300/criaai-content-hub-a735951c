import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Briefcase,
  Wand2,
  Library,
  Settings,
  LogOut,
  Moon,
  Sun,
  Sparkles,
  Lightbulb,
  CalendarCheck,
  TrendingUp,
  SlidersHorizontal,
  Film,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const items = [
  { title: "Início", url: "/app", icon: LayoutDashboard, exact: true },
  { title: "Minhas Marcas", url: "/app/brands", icon: Briefcase },
  { title: "Laboratório de Ideias", url: "/app/ideas", icon: Lightbulb },
  { title: "Radar de Tendências", url: "/app/trends", icon: TrendingUp },
  { title: "Criar conteúdo", url: "/app/create", icon: Wand2, exact: true },
  { title: "Criar Reel", url: "/app/create/reel", icon: Film },
  { title: "Calendário", url: "/app/calendar", icon: CalendarCheck },
  { title: "Biblioteca", url: "/app/library", icon: Library },
  { title: "Presets", url: "/app/templates", icon: SlidersHorizontal },
  { title: "Configurações", url: "/app/settings", icon: Settings },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const onLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu da conta.");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md gradient-brand">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-display text-sm font-bold leading-tight">Cria Aí 2.0</p>
            <p className="truncate text-xs text-muted-foreground">Estúdio criativo guiado</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Jornada</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url, item.exact)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-1 p-1 group-data-[collapsible=icon]:hidden">
          <Button variant="ghost" size="sm" className="justify-start gap-2 rounded-xl" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 rounded-xl text-destructive hover:text-destructive"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
