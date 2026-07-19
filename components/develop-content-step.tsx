// Etapa "Desenvolver conteúdo com ChatGPT" do wizard.
// Sem chamadas a IA. Apenas cópia, colagem e importação manual.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, ExternalLink, Sparkles, Download, FileText, Bot } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { ImportCampaignDialog } from "@/components/import-campaign-dialog";
import { buildExternalCampaignPrompt } from "@/lib/externalPrompt";
import type { Tables } from "@/integrations/supabase/types";
import type { CampaignFields, ImportedCampaignContent, ContentSource } from "@/lib/campaignDevelopment";
import { mergeCampaignFields } from "@/lib/campaignDevelopment";

type Brand = Tables<"brands">;

export interface DevelopState {
  source: ContentSource;
  selected_differentiators: string[];
  avoid_terms: string[];
  campaign: CampaignFields;
  imported: ImportedCampaignContent | null;
  /** chaves dos campos editados manualmente (para proteger em re-imports). */
  manually_edited: string[];
  differentiators_mode: "auto" | "none" | "manual";
}

export const DEFAULT_DEVELOP_STATE: DevelopState = {
  source: "auto",
  selected_differentiators: [],
  avoid_terms: [],
  campaign: {},
  imported: null,
  manually_edited: [],
  differentiators_mode: "auto",
};

interface Props {
  brand: Brand | null;
  // Snapshot leve do briefing para usar no prompt externo
  projectLike: {
    internal_title: string;
    theme: string;
    objective: string;
    selected_formats: string[];
    specific_audience: string;
    audience_problem: string;
    main_message: string;
    mandatory_information: string;
    call_to_action: string;
    event_date: string;
    event_time: string;
    location: string;
    price_information: string;
    contact_information: string;
    restrictions: string;
    notes: string;
  };
  state: DevelopState;
  onChange: (next: DevelopState) => void;
}

function splitDiff(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split(/[\n;•]/).map((s) => s.trim()).filter(Boolean);
}

export function DevelopContentStep({ brand, projectLike, state, onChange }: Props) {
  const [openImport, setOpenImport] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const availableDiff = useMemo(() => splitDiff(brand?.differentiators), [brand]);

  const setField = <K extends keyof CampaignFields>(key: K, value: CampaignFields[K]) => {
    onChange({
      ...state,
      campaign: { ...state.campaign, [key]: value },
      source: state.source === "external_chatgpt" ? "manual" : state.source === "auto" ? "manual" : state.source,
      manually_edited: Array.from(new Set([...state.manually_edited, key as string])),
    });
  };

  const promptText = useMemo(() => {
    if (!brand) return "";
    const fakeProject = {
      ...projectLike,
      selected_formats: projectLike.selected_formats,
    } as unknown as Tables<"content_projects">;
    return buildExternalCampaignPrompt({
      brand,
      project: fakeProject,
      selectedDifferentiators: state.selected_differentiators,
      avoidTerms: state.avoid_terms,
      campaign: state.campaign,
    });
  }, [brand, projectLike, state]);

  const handleCopyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      toast.success("Pedido copiado!", { description: "Abrindo ChatGPT em nova aba." });
      window.open("https://chat.openai.com/", "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Use o botão Copiar.");
    }
  };

  const handleApplyImport = (sel: Parameters<NonNullable<React.ComponentProps<typeof ImportCampaignDialog>["onApply"]>>[0]) => {
    const merged = mergeCampaignFields(state.campaign, sel.campaign as CampaignFields);
    onChange({
      ...state,
      source: "external_chatgpt",
      campaign: merged,
      imported: sel.full,
      // Não consideramos os campos importados como "manualmente editados"
    });
    toast.success("Conteúdo importado.", { description: "Os campos e peças selecionadas foram aplicados." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Desenvolver conteúdo</h2>
        <p className="text-sm text-muted-foreground">
          Escolha como desenvolver o conteúdo desta campanha. O Cria Aí não faz chamadas de IA: o ChatGPT é usado externamente via cópia e colagem, sem cobranças adicionais.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <PathCard
          icon={<FileText className="h-5 w-5" />}
          title="Preencher manualmente"
          desc="Edite os campos abaixo. Use quando você já tem clareza editorial."
          active={state.source === "manual"}
          onClick={() => onChange({ ...state, source: "manual" })}
        />
        <PathCard
          icon={<Bot className="h-5 w-5" />}
          title="Preparar pedido para o ChatGPT"
          desc="Geramos um pedido pronto. Cole no ChatGPT e importe o JSON de volta."
          active={state.source === "external_chatgpt"}
          onClick={() => { onChange({ ...state, source: "external_chatgpt" }); setShowRequest(true); }}
        />
        <PathCard
          icon={<Sparkles className="h-5 w-5" />}
          title="Continuar com rascunho automático"
          desc="Usa o gerador interno como ponto de partida (rascunho)."
          active={state.source === "auto"}
          onClick={() => onChange({ ...state, source: "auto" })}
        />
      </div>

      {/* Diferenciais e termos a evitar */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <Label className="text-sm font-medium">Diferenciais da marca nesta campanha</Label>
            <p className="text-xs text-muted-foreground">Os diferenciais gerais só serão usados quando realmente fizerem sentido para o tema.</p>
            <Select
              value={state.differentiators_mode}
              onValueChange={(v: DevelopState["differentiators_mode"]) =>
                onChange({ ...state, differentiators_mode: v, selected_differentiators: v === "none" ? [] : state.selected_differentiators })
              }
            >
              <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Selecionar automaticamente com moderação</SelectItem>
                <SelectItem value="none">Não utilizar diferenciais institucionais</SelectItem>
                <SelectItem value="manual">Escolher manualmente</SelectItem>
              </SelectContent>
            </Select>
            {state.differentiators_mode === "manual" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {availableDiff.length === 0 && <p className="text-xs text-muted-foreground">A marca não tem diferenciais cadastrados.</p>}
                {availableDiff.map((d) => {
                  const on = state.selected_differentiators.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...state,
                          selected_differentiators: on
                            ? state.selected_differentiators.filter((x) => x !== d)
                            : [...state.selected_differentiators, d],
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">Evitar nesta campanha</Label>
            <p className="text-xs text-muted-foreground">Separe por vírgula. Esses termos serão bloqueados nas peças e prompts visuais.</p>
            <Input
              value={state.avoid_terms.join(", ")}
              onChange={(e) =>
                onChange({
                  ...state,
                  avoid_terms: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="atendimento humano, suporte, orçamento"
              className="mt-1"
            />
            {state.avoid_terms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {state.avoid_terms.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pedido externo */}
      {(state.source === "external_chatgpt" || showRequest) && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Pedido para o ChatGPT pronto</h3>
                <p className="text-xs text-muted-foreground">Cole no ChatGPT. Após receber o JSON, volte e importe a resposta.</p>
              </div>
              <Badge variant="outline">{promptText.length} caracteres</Badge>
            </div>
            <Textarea readOnly value={promptText} className="min-h-[220px] font-mono text-xs" />
            <div className="flex flex-wrap gap-2">
              <CopyButton text={promptText} label="Copiar pedido" />
              <Button variant="secondary" onClick={handleCopyAndOpen}>
                <ExternalLink className="mr-1 h-4 w-4" /> Copiar e abrir ChatGPT
              </Button>
              <Button variant="outline" onClick={() => setOpenImport(true)}>
                <Download className="mr-1 h-4 w-4" /> Importar resposta
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campos editáveis */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Campos da campanha (preencher só o que for específico)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Ângulo da campanha" value={state.campaign.angle ?? ""} onChange={(v) => setField("angle", v)} />
            <Field label="Mensagem central" value={state.campaign.central_message ?? ""} onChange={(v) => setField("central_message", v)} />
            <Field label="Promessa principal" value={state.campaign.main_promise ?? ""} onChange={(v) => setField("main_promise", v)} />
            <Field label="Dor principal" value={state.campaign.main_pain ?? ""} onChange={(v) => setField("main_pain", v)} />
            <Field label="Benefício principal" value={state.campaign.main_benefit ?? ""} onChange={(v) => setField("main_benefit", v)} />
            <Field label="CTA principal" value={state.campaign.main_cta ?? ""} onChange={(v) => setField("main_cta", v)} />
            <Field label="Estratégia de CTA" value={state.campaign.cta_strategy ?? ""} onChange={(v) => setField("cta_strategy", v)} />
            <Field label="Estrutura narrativa" value={state.campaign.narrative_structure ?? ""} onChange={(v) => setField("narrative_structure", v)} />
            <Field label="Direção visual específica" value={state.campaign.visual_focus ?? ""} onChange={(v) => setField("visual_focus", v)} />
            <div>
              <Label className="text-xs">Intensidade comercial</Label>
              <Select
                value={state.campaign.commercial_intensity ?? "none"}
                onValueChange={(v) => setField("commercial_intensity", v as CampaignFields["commercial_intensity"])}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="light">Leve</SelectItem>
                  <SelectItem value="moderate">Moderada</SelectItem>
                  <SelectItem value="direct">Direta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Field
            label="Pontos principais (um por linha)"
            value={(state.campaign.key_points ?? []).join("\n")}
            onChange={(v) =>
              setField("key_points", v.split(/\n+/).map((s) => s.trim()).filter(Boolean))
            }
            multiline
          />
          <Field
            label="Desejos do público (um por linha)"
            value={(state.campaign.audience_desires ?? []).join("\n")}
            onChange={(v) =>
              setField("audience_desires", v.split(/\n+/).map((s) => s.trim()).filter(Boolean))
            }
            multiline
          />
        </CardContent>
      </Card>

      {state.imported && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
          ✓ Conteúdo importado do ChatGPT em {state.imported.imported_at ? new Date(state.imported.imported_at).toLocaleString("pt-BR") : "—"}.
          {state.imported.pieces?.length ? ` ${state.imported.pieces.length} peças propostas.` : ""}
        </div>
      )}

      <ImportCampaignDialog
        open={openImport}
        onOpenChange={setOpenImport}
        currentCampaign={state.campaign}
        currentPieces={state.imported?.pieces}
        manuallyEditedKeys={state.manually_edited as Array<keyof CampaignFields>}
        onApply={handleApplyImport}
      />
    </div>
  );
}

function PathCard({ icon, title, desc, active, onClick }: { icon: React.ReactNode; title: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-all ${active ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border hover:border-border/80"}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 min-h-[80px]" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1" />
      )}
    </div>
  );
}
