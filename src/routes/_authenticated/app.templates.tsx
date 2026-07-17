import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Save, SlidersHorizontal, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagInput } from "@/components/tag-input";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import {
  IDEA_APPROACH_LABELS,
  IDEA_FOCUS_LABELS,
  IDEA_OBJECTIVE_LABELS,
  IDEA_TONE_LABELS,
  type IdeaApproach,
  type IdeaFocus,
  type IdeaObjective,
  type IdeaTone,
} from "@/lib/ideaTaxonomy";
import {
  deleteUserPreset,
  duplicatePreset,
  getAllPresets,
  presetToWizardPrefill,
  saveUserPreset,
  type ContentPreset,
  type PresetDraft,
} from "@/lib/contentPresets";

export const Route = createFileRoute("/_authenticated/app/templates")({
  head: () => ({ meta: [{ title: "Presets — Cria Aí" }] }),
  component: PresetsPage,
});

const formatEntries = Object.entries(FORMAT_LABELS).filter(([key]) => key !== "outro");

function PresetsPage() {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<ContentPreset[]>(() => getAllPresets());
  const [editing, setEditing] = useState<ContentPreset | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("all");

  useEffect(() => {
    setPresets(getAllPresets());
  }, []);

  const { data: brands } = useQuery({
    queryKey: ["brands-for-presets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Tables<"brands">, "id" | "name">[];
    },
  });

  const refresh = () => setPresets(getAllPresets());

  const filtered = useMemo(() => {
    if (brandFilter === "all") return presets;
    if (brandFilter === "global") return presets.filter((preset) => preset.scope === "global");
    return presets.filter((preset) => preset.scope === "global" || preset.brand_id === brandFilter);
  }, [brandFilter, presets]);

  const brandName = (id?: string | null) => brands?.find((brand) => brand.id === id)?.name ?? "Marca";

  const usePreset = (preset: ContentPreset) => {
    try {
      localStorage.setItem("cria-wizard-prefill", JSON.stringify(presetToWizardPrefill(preset)));
      toast.success("Preset aplicado ao novo conteúdo.");
      navigate({ to: "/app/content/new" });
    } catch (error) {
      toast.error("Não foi possível aplicar o preset", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <Badge variant="secondary" className="mb-2 rounded-full">
            <SlidersHorizontal className="mr-1 h-3 w-3" />
            Presets de criação
          </Badge>
          <h1 className="text-2xl font-bold sm:text-3xl">Presets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Salve receitas de criação para preencher objetivo, formatos, tom, CTA e orientações sem começar do zero.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo preset
        </Button>
      </header>

      <Card className="border-primary/25 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-medium">Como usar</p>
            <p className="text-muted-foreground">
              Escolha um preset aqui para abrir o briefing já preenchido, ou aplique um preset dentro do Laboratório de Ideias.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os presets</SelectItem>
                <SelectItem value="global">Somente globais</SelectItem>
                {(brands ?? []).map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((preset) => (
          <Card key={preset.id} className="border-border/60 min-w-0">
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-1">
                    <Badge variant={preset.is_system ? "secondary" : "outline"}>
                      {preset.is_system ? "Sistema" : "Meu preset"}
                    </Badge>
                    <Badge variant="outline">
                      {preset.scope === "brand" && preset.brand_id ? brandName(preset.brand_id) : "Global"}
                    </Badge>
                  </div>
                  <h2 className="line-clamp-2 font-semibold" title={preset.name}>
                    {preset.name}
                  </h2>
                  {preset.description && (
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                      {preset.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const copy = duplicatePreset(preset);
                      refresh();
                      setEditing(copy);
                      toast.success("Cópia criada.");
                    }}
                    title="Duplicar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {!preset.is_system && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(preset)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          deleteUserPreset(preset.id);
                          refresh();
                          toast.success("Preset excluído.");
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 text-xs">
                <Badge variant="outline">{IDEA_OBJECTIVE_LABELS[preset.objective]}</Badge>
                <Badge variant="outline">{IDEA_APPROACH_LABELS[preset.approach]}</Badge>
                <Badge variant="outline">{IDEA_TONE_LABELS[preset.tone]}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {preset.formats.map((format) => (
                  <Badge key={format} variant="secondary" className="text-xs">
                    {FORMAT_LABELS[format] ?? format}
                  </Badge>
                ))}
              </div>
              {preset.cta && (
                <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  CTA: <span className="text-foreground">{preset.cta}</span>
                </p>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => usePreset(preset)}>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Usar preset
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(preset)}>
                  Ver detalhes
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PresetDialog
        open={openNew || !!editing}
        initial={editing}
        brands={brands ?? []}
        onClose={() => {
          setOpenNew(false);
          setEditing(null);
        }}
        onSaved={() => {
          refresh();
          setOpenNew(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

const emptyPreset = (): PresetDraft => ({
  name: "",
  description: "",
  scope: "global",
  brand_id: null,
  objective: "educar",
  focus: "qualquer",
  approach: "orientacao_pratica",
  tone: "marca",
  formats: ["post"],
  idea_formats: ["post"],
  cta: "",
  desired_style: "",
  mandatory_information: "",
  restrictions: "",
  notes: "",
  reel_instructions: "",
  visual_instructions: "",
  caption_instructions: "",
  hashtag_suggestions: [],
  locked_fields: [],
  allow_fallback: true,
  is_system: false,
});

function PresetDialog({
  open,
  initial,
  brands,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: ContentPreset | null;
  brands: Pick<Tables<"brands">, "id" | "name">[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<PresetDraft>(emptyPreset);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ? { ...initial } : emptyPreset());
  }, [initial, open]);

  const set = <K extends keyof PresetDraft>(key: K, value: PresetDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const toggleFormat = (format: string) => {
    setDraft((current) => {
      const formats = current.formats.includes(format)
        ? current.formats.filter((item) => item !== format)
        : [...current.formats, format];
      const idea_formats = formats.filter((item) =>
        ["post", "carrossel", "story", "sequencia_stories", "status_whatsapp", "reel", "comunicado"].includes(item),
      ) as PresetDraft["idea_formats"];
      return { ...current, formats, idea_formats: idea_formats.length ? idea_formats : ["auto"] };
    });
  };

  const save = () => {
    try {
      const saved = saveUserPreset({
        ...draft,
        scope: draft.scope === "brand" ? "brand" : "global",
        brand_id: draft.scope === "brand" ? draft.brand_id : null,
      });
      toast.success("Preset salvo.", { description: saved.name });
      onSaved();
    } catch (error) {
      toast.error("Não foi possível salvar o preset", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const isSystem = Boolean(initial?.is_system);
  const canSave = draft.name.trim().length >= 3 && draft.formats.length > 0 && !isSystem;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isSystem ? "Detalhes do preset" : initial ? "Editar preset" : "Novo preset"}</DialogTitle>
        </DialogHeader>

        {isSystem && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            Este é um preset de sistema. Duplique para editar sua própria versão.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome</Label>
            <Input value={draft.name} onChange={(event) => set("name", event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={draft.description} onChange={(event) => set("description", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Escopo</Label>
            <Select value={draft.scope} onValueChange={(value) => set("scope", value as PresetDraft["scope"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="brand">Marca específica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Marca</Label>
            <Select
              value={draft.brand_id || "none"}
              onValueChange={(value) => set("brand_id", value === "none" ? null : value)}
              disabled={isSystem || draft.scope !== "brand"}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem marca</SelectItem>
                {brands.map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Select value={draft.objective} onValueChange={(value) => set("objective", value as IdeaObjective)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(IDEA_OBJECTIVE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Foco</Label>
            <Select value={draft.focus} onValueChange={(value) => set("focus", value as IdeaFocus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(IDEA_FOCUS_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Abordagem</Label>
            <Select value={draft.approach} onValueChange={(value) => set("approach", value as IdeaApproach)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(IDEA_APPROACH_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tom</Label>
            <Select value={draft.tone} onValueChange={(value) => set("tone", value as IdeaTone)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(IDEA_TONE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Formatos padrão</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {formatEntries.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm">
                  <Checkbox checked={draft.formats.includes(key)} onCheckedChange={() => toggleFormat(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>CTA padrão</Label>
            <Input value={draft.cta} onChange={(event) => set("cta", event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Orientação de copy</Label>
            <Textarea rows={3} value={draft.desired_style} onChange={(event) => set("desired_style", event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Informações obrigatórias</Label>
            <Textarea rows={3} value={draft.mandatory_information} onChange={(event) => set("mandatory_information", event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Restrições</Label>
            <Textarea rows={3} value={draft.restrictions} onChange={(event) => set("restrictions", event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Orientação para roteiro de Reel</Label>
            <Textarea rows={3} value={draft.reel_instructions} onChange={(event) => set("reel_instructions", event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Orientação visual</Label>
            <Textarea rows={3} value={draft.visual_instructions} onChange={(event) => set("visual_instructions", event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Orientação para legenda</Label>
            <Textarea rows={3} value={draft.caption_instructions} onChange={(event) => set("caption_instructions", event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Hashtags sugeridas — máximo 5</Label>
            <TagInput value={draft.hashtag_suggestions} onChange={(value) => set("hashtag_suggestions", value.slice(0, 5))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Notas internas do preset</Label>
            <Textarea rows={3} value={draft.notes} onChange={(event) => set("notes", event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Fechar
          </Button>
          {!isSystem && (
            <Button onClick={save} disabled={!canSave}>
              <Save className="mr-2 h-4 w-4" />
              Salvar preset
            </Button>
          )}
          {isSystem && initial && (
            <Button
              onClick={() => {
                duplicatePreset(initial);
                toast.success("Cópia criada para edição.");
                onSaved();
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicar para editar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
