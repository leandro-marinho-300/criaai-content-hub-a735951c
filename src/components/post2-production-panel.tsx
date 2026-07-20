import { FileImage, MessageSquareText, Palette, Pencil, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/copy-button";
import { PieceAssetUploader } from "@/components/piece-asset-uploader";
import type { PieceAsset } from "@/lib/pieceAssets";
import type { Post2ProjectSnapshot } from "@/lib/post2Project";

interface Post2ProductionPanelProps {
  projectId: string;
  outputId: string;
  userId: string;
  snapshot: Post2ProjectSnapshot;
  assets: PieceAsset[];
  onAssetsChanged: () => void;
}

export function Post2ProductionPanel({
  projectId,
  outputId,
  userId,
  snapshot,
  assets,
  onAssetsChanged,
}: Post2ProductionPanelProps) {
  const content = snapshot.generated_content ?? snapshot.post2.imported_content;
  const editHref = `/app/create/post?projectId=${encodeURIComponent(projectId)}`;

  if (!content) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-5">
          <p className="font-semibold">Conteúdo do Post 2.0 ainda não foi importado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Volte ao editor, gere o conteúdo no ChatGPT e importe o JSON antes de continuar.
          </p>
          <Button asChild className="mt-4">
            <a href={editHref}>
              <Pencil className="mr-2 h-4 w-4" /> Abrir Post 2.0
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Pacote de produção do Post 2.0</h2>
          <p className="text-sm text-muted-foreground">
            Revise o conteúdo, copie o prompt visual e anexe a arte final sem sair deste projeto.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={editHref}>
            <Pencil className="mr-2 h-4 w-4" /> Ajustar conteúdo
          </a>
        </Button>
      </div>

      <Tabs defaultValue="conteudo" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
          <TabsTrigger value="prompt">Prompt da arte</TabsTrigger>
          <TabsTrigger value="arte">Arte final</TabsTrigger>
        </TabsList>

        <TabsContent value="conteudo">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquareText className="h-4 w-4 text-orange-500" /> Texto da arte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Field label="Título" value={content.art.title} />
                <Field label="Texto de apoio" value={content.art.support_text} />
                {content.art.optional_seal && <Field label="Selo" value={content.art.optional_seal} />}
                {content.art.art_cta && <Field label="CTA da arte" value={content.art.art_cta} />}
                <CopyButton
                  text={[
                    content.art.optional_seal,
                    content.art.title,
                    content.art.support_text,
                    content.art.art_cta,
                  ]
                    .filter(Boolean)
                    .join("\n\n")}
                  label="Copiar texto da arte"
                  variant="outline"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquareText className="h-4 w-4 text-orange-500" /> Publicação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Field label="Legenda" value={content.publication.caption} />
                {content.publication.cta && <Field label="CTA" value={content.publication.cta} />}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Hashtags
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {content.publication.hashtags.map((hashtag) => (
                      <Badge key={hashtag} variant="outline">
                        {hashtag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <CopyButton
                  text={`${content.publication.caption}\n\n${content.publication.hashtags.join(" ")}`}
                  label="Copiar publicação"
                  variant="outline"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prompt">
          <Card className="border-violet-500/30 bg-violet-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-violet-500" /> Prompt visual aprovado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O prompt usa o conteúdo importado e separa o texto publicável das instruções internas.
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={snapshot.layout_prompt} label="Copiar prompt da arte" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open("https://chatgpt.com", "_blank", "noopener,noreferrer")}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Abrir ChatGPT
                </Button>
              </div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-background p-4 text-xs leading-relaxed">
                {snapshot.layout_prompt}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="arte">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileImage className="h-4 w-4 text-orange-500" /> Arte final gerada no GPT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Anexe a arte final aqui. O arquivo permanece ligado a este Post 2.0 para aprovação e calendário.
              </p>
              {userId && outputId ? (
                <PieceAssetUploader
                  userId={userId}
                  projectId={projectId}
                  outputId={outputId}
                  assets={assets}
                  multiple={false}
                  onChange={onAssetsChanged}
                />
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Não foi possível localizar a peça publicável deste projeto.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-muted/40 px-3 py-2">{value || "—"}</p>
    </div>
  );
}
