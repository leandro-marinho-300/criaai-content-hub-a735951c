import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LayoutGrid, List, Archive, Trash2, Pencil, Heart, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { FORMAT_LABELS, OBJECTIVE_LABELS } from "@/lib/promptBuilder";
import { getProjectDisplayTitle } from "@/lib/displayTitle";
import { RenameTitleDialog } from "@/components/rename-title-dialog";

export const Route = createFileRoute("/_authenticated/app/library")({
  head: () => ({ meta: [{ title: "Biblioteca — Cria Aí" }] }),
  component: LibraryPage,
});

const STATUSES = [
  { value: "all", label: "Todos status" },
  { value: "draft", label: "Rascunho" },
  { value: "review", label: "Aguardando revisão" },
  { value: "approved", label: "Aprovado" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];

function LibraryPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [brandId, setBrandId] = useState<string>("all");
  const [objective, setObjective] = useState<string>("all");
  const [format, setFormat] = useState<string>("all");

  const { data: brands } = useQuery({
    queryKey: ["brands-light"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["library", { search, status, brandId, objective, format }],
    queryFn: async () => {
      let q = supabase
        .from("content_projects")
        .select("id, internal_title, status, objective, selected_formats, brand_id, is_favorite, updated_at, brands(name, logo_url)")
        .order("updated_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      if (brandId !== "all") q = q.eq("brand_id", brandId);
      if (objective !== "all") q = q.eq("objective", objective);
      if (format !== "all") q = q.contains("selected_formats", [format]);
      if (search.trim()) q = q.ilike("internal_title", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("content_projects").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projeto excluído.");
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">Todos os seus pacotes de prompts em um só lugar.</p>
        </div>
        <div className="flex rounded-md border border-border/60 bg-card p-1">
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setView("grid")} className="h-8 px-2"><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setView("table")} className="h-8 px-2"><List className="h-4 w-4" /></Button>
        </div>
      </header>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas marcas</SelectItem>
              {(brands ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={objective} onValueChange={setObjective}>
            <SelectTrigger><SelectValue placeholder="Objetivo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos objetivos</SelectItem>
              {Object.entries(OBJECTIVE_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger><SelectValue placeholder="Formato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos formatos</SelectItem>
              {Object.entries(FORMAT_LABELS).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !items?.length ? (
        <Card className="border-dashed"><CardContent className="p-10 text-center text-sm text-muted-foreground">Nenhum projeto encontrado.</CardContent></Card>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id} className="border-border/60">
              <CardContent className="p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{p.brands?.name ?? "Sem marca"}</p>
                    <Link to="/app/content/$projectId/result" params={{ projectId: p.id }} className="line-clamp-2 font-semibold hover:underline">
                      {p.internal_title || "Sem título"}
                    </Link>
                  </div>
                  <ProjectMenu id={p.id} status={p.status} onStatus={(s) => updateStatus.mutate({ id: p.id, status: s })} onDelete={() => del.mutate(p.id)} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{statusLabel(p.status)}</Badge>
                  {p.objective && <Badge variant="outline">{OBJECTIVE_LABELS[p.objective] ?? p.objective}</Badge>}
                  {p.is_favorite && <Heart className="h-3.5 w-3.5 fill-primary text-primary" />}
                </div>
                {p.selected_formats?.length > 0 && (
                  <p className="mt-2 truncate text-xs text-muted-foreground">{p.selected_formats.map((f) => FORMAT_LABELS[f] ?? f).join(" · ")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Título</TableHead><TableHead>Marca</TableHead><TableHead>Status</TableHead><TableHead>Objetivo</TableHead><TableHead className="w-10" /></TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-[260px]"><Link to="/app/content/$projectId/result" params={{ projectId: p.id }} className="font-medium hover:underline">{p.internal_title || "Sem título"}</Link></TableCell>
                  <TableCell>{p.brands?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{statusLabel(p.status)}</Badge></TableCell>
                  <TableCell>{OBJECTIVE_LABELS[p.objective ?? ""] ?? "—"}</TableCell>
                  <TableCell><ProjectMenu id={p.id} status={p.status} onStatus={(s) => updateStatus.mutate({ id: p.id, status: s })} onDelete={() => del.mutate(p.id)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function statusLabel(s: string) {
  return ({ draft: "Rascunho", review: "Em revisão", approved: "Aprovado", published: "Publicado", archived: "Arquivado" } as Record<string, string>)[s] ?? s;
}

function ProjectMenu({ id, status, onStatus, onDelete }: { id: string; status: string; onStatus: (s: string) => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild><Link to="/app/content/$projectId/result" params={{ projectId: id }}><Pencil className="mr-2 h-4 w-4" />Abrir</Link></DropdownMenuItem>
        {status !== "approved" && <DropdownMenuItem onClick={() => onStatus("approved")}>Marcar aprovado</DropdownMenuItem>}
        {status !== "published" && <DropdownMenuItem onClick={() => onStatus("published")}>Marcar publicado</DropdownMenuItem>}
        {status !== "archived" && <DropdownMenuItem onClick={() => onStatus("archived")}><Archive className="mr-2 h-4 w-4" />Arquivar</DropdownMenuItem>}
        <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
