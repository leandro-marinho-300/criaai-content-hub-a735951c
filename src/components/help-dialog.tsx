import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const SEEN_KEY = "cria-help-seen";

export function HelpDialog({ trigger, autoOpen = false }: { trigger?: React.ReactNode; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {}
  }, [autoOpen]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v && dontShow) {
      try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    }
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
            O Cria Aí organiza o seu briefing e monta um prompt profissional. A criação do conteúdo final
            (textos, legendas e imagens) acontece na ferramenta de IA escolhida por você.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm leading-relaxed">
          <section>
            <h3 className="mb-1 font-semibold">O que o aplicativo faz</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Cadastra marcas com identidade, público e tom de voz.</li>
              <li>Recebe um briefing estruturado para cada conteúdo.</li>
              <li>Monta um prompt profissional pronto para copiar.</li>
            </ul>
          </section>
          <section>
            <h3 className="mb-1 font-semibold">O que o aplicativo não faz nesta fase</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Não gera o conteúdo final.</li>
              <li>Não gera imagens.</li>
              <li>Não conecta automaticamente com ChatGPT ou outras IAs.</li>
            </ul>
          </section>
          <section>
            <h3 className="mb-1 font-semibold">Como preencher um bom briefing</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Defina um tema claro e a mensagem principal que quer transmitir.</li>
              <li>Informe dados obrigatórios: datas, valores, locais, contatos.</li>
              <li>Escreva a chamada para ação esperada.</li>
              <li>Quanto mais específico, melhor o resultado da IA.</li>
            </ul>
          </section>
          <section>
            <h3 className="mb-1 font-semibold">Como copiar e executar o prompt</h3>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Clique em “Copiar prompt completo”.</li>
              <li>Abra o ChatGPT ou outra ferramenta de IA.</li>
              <li>Cole o prompt no chat e envie.</li>
              <li>Receba os textos, legendas, hashtags e demais materiais solicitados.</li>
            </ol>
          </section>
          <section>
            <h3 className="mb-1 font-semibold">Fotos e arquivos de referência</h3>
            <p className="text-muted-foreground">
              Use o cadastro da marca para anexar logos e referências. Ao executar o prompt, envie essas imagens
              junto na conversa com a IA para resultados mais fiéis.
            </p>
          </section>
          <section>
            <h3 className="mb-1 font-semibold">Transformando o resultado em arte</h3>
            <p className="text-muted-foreground">
              Pegue o “Prompt visual” gerado e use em um gerador de imagens (Midjourney, DALL·E, Lovable, etc.).
              Combine com os textos para montar a peça final em sua ferramenta de edição preferida.
            </p>
          </section>

          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 p-3">
            <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(Boolean(v))} />
            <span>Não mostrar novamente</span>
          </label>
          <div className="flex justify-end">
            <Button onClick={() => handleOpenChange(false)}>Entendi</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
