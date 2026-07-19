import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";

const SEEN_KEY = "cria-help-seen-v2";

export function HelpDialog({ trigger, autoOpen = false }: { trigger?: React.ReactNode; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (!autoOpen) return;
    try { if (!localStorage.getItem(SEEN_KEY)) setOpen(true); } catch {}
  }, [autoOpen]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v && dontShow) { try { localStorage.setItem(SEEN_KEY, "1"); } catch {} }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-1.5">
            <HelpCircle className="h-4 w-4" />
            Como usar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Como usar o Cria Aí</DialogTitle>
          <DialogDescription>
            Do briefing à publicação — um fluxo em etapas curtas. A imagem final é criada fora do app
            (por uma IA visual ou um designer) e importada para o pacote.
          </DialogDescription>
        </DialogHeader>

        <Accordion type="single" collapsible defaultValue="step-1" className="text-sm">
          <AccordionItem value="step-1">
            <AccordionTrigger>1. Cadastrar a marca</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Salve identidade visual, tom de voz, públicos, ofertas e referências. Tudo isso é usado em
              todos os conteúdos da marca.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-2">
            <AccordionTrigger>2. Pedir uma ideia (opcional)</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              No Laboratório de Ideias, gere sugestões a partir da marca selecionada. Use a ideia como
              ponto de partida do briefing.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-3">
            <AccordionTrigger>3. Preencher o briefing</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Tema, mensagem, públicos, dores, CTA, formatos e canais. Quanto mais específico, melhor o
              pacote gerado.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-4">
            <AccordionTrigger>4. Gerar o pacote de produção</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              O Cria Aí entrega copy, legenda, hashtags, estrutura das peças e prompts visuais para os
              layouts. Tudo já editável.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-5">
            <AccordionTrigger>5. Criar a arte fora do app</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Use o prompt visual em uma IA externa (Midjourney, DALL·E, Gemini, etc.) ou em ferramenta
              de design. Você também pode usar o ChatGPT para revisar copy e gerar variações.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-6">
            <AccordionTrigger>6. Anexar artes ao projeto</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Suba as imagens finais nas peças correspondentes (individualmente ou em lote). Cada peça
              fica vinculada ao seu layout.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-7">
            <AccordionTrigger>7. Gerar PDF para o cliente</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Exporte um PDF compacto (3 páginas) ou detalhado, com identidade da marca, prévia das artes
              e planejamento da publicação.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="step-8">
            <AccordionTrigger>8. Planejar no calendário</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Agende cada publicação com data, horário e canal. O calendário organiza por marca, status e
              aprovação. Nesta fase o app não publica automaticamente nas redes — ele organiza.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 p-3">
          <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(Boolean(v))} />
          <span>Não mostrar novamente</span>
        </label>
        <div className="flex justify-end">
          <Button onClick={() => handleOpenChange(false)}>Entendi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
