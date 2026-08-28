import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PostV2PipelineShell } from "@/components/post-v2/post-v2-pipeline-shell";
import { PostV2ActionConsole } from "@/components/post-v2/post-v2-action-console";
import { loadPostV2Pipeline } from "@/lib/creation/post-v2-pipeline-loader";

export const Route = createFileRoute("/_authenticated/app/create/post-v2")({
  head: () => ({ meta: [{ title: "Post V2 Studio — Cria Aí" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    projectId:
      typeof search.projectId === "string" && search.projectId.trim()
        ? search.projectId.trim()
        : undefined,
  }),
  component: PostV2StudioRoute,
});

function PostV2StudioRoute() {
  const { projectId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const pipelineQuery = useQuery({
    queryKey: ["post-v2-pipeline", projectId],
    queryFn: () => loadPostV2Pipeline(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const refresh = async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: ["post-v2-pipeline", projectId] });
    await pipelineQuery.refetch();
  };

  const openProject = (newProjectId: string) => {
    void navigate({ search: { projectId: newProjectId }, replace: true });
  };

  if (projectId && pipelineQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-[45vh] max-w-7xl items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando estado canônico da Creation V2…
        </div>
      </div>
    );
  }

  if (projectId && pipelineQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível abrir esta Creation V2</AlertTitle>
          <AlertDescription>
            {pipelineQuery.error instanceof Error
              ? pipelineQuery.error.message
              : "Falha inesperada ao carregar o pipeline."}
          </AlertDescription>
        </Alert>
        <PostV2PipelineShell
          loaded={null}
          actionConsole={<PostV2ActionConsole loaded={null} onChanged={() => undefined} onBootstrapped={openProject} />}
        />
      </div>
    );
  }

  const loaded = pipelineQuery.data ?? null;
  return (
    <PostV2PipelineShell
      loaded={loaded}
      actionConsole={
        <PostV2ActionConsole
          loaded={loaded}
          onChanged={refresh}
          onBootstrapped={openProject}
        />
      }
    />
  );
}
