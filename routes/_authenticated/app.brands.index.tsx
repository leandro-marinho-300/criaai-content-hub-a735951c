import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Wand2, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/brands/")({
  head: () => ({ meta: [{ title: "Minhas Marcas — Cria Aí" }] }),
  component: BrandsList,
});

interface BrandRow {
  id: string;
  name: string;
  segment: string | null;
  primary_color: string | null;
  logo_url: string | null;
  content_count?: number;
}

function BrandsList() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data: brands, error } = await supabase
        .from("brands")
        .select("id, name, segment, primary_color, logo_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: counts } = await supabase.from("content_projects").select("brand_id");
      const map = new Map<string, number>();
      (counts ?? []).forEach((r) => {
        if (r.brand_id) map.set(r.brand_id, (map.get(r.brand_id) ?? 0) + 1);
      });
      return (brands ?? []).map((b) => ({ ...b, content_count: map.get(b.id) ?? 0 })) as BrandRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marca excluída.");
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Minhas marcas</h1>
          <p className="text-sm text-muted-foreground">Cadastre marcas para reutilizar a identidade nos briefings.</p>
        </div>
        <Button asChild>
          <Link to="/app/brands/new"><Plus className="mr-2 h-4 w-4" />Nova marca</Link>
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data?.length ? (
        <Card className="border-dashed">
          <CardContent className="grid place-items-center gap-3 p-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma marca cadastrada.</p>
            <Button asChild><Link to="/app/brands/new">Cadastrar primeira marca</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((b) => (
            <Card key={b.id} className="border-border/60">
              <CardContent className="p-5">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                  {b.logo_url ? (
                    <img src={b.logo_url} alt={b.name} className="h-12 w-12 shrink-0 rounded-lg border bg-muted object-contain p-1" />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg gradient-brand text-sm font-bold text-white">
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.segment || "Sem segmento"}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to="/app/brands/$brandId/edit" params={{ brandId: b.id }}><Pencil className="mr-2 h-4 w-4" />Editar</Link>
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Excluir
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir marca?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Os conteúdos vinculados ficam sem marca.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del.mutate(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {b.primary_color && (
                    <Badge variant="secondary" className="gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-full border" style={{ background: b.primary_color }} />
                      {b.primary_color}
                    </Badge>
                  )}
                  <Badge variant="outline">{b.content_count} conteúdos</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/app/brands/$brandId/edit" params={{ brandId: b.id }}>Editar</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/app/content/new"><Wand2 className="mr-1.5 h-3.5 w-3.5" />Criar conteúdo</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
