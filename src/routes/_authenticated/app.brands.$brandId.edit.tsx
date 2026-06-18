import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrandForm } from "@/components/brand-form";

export const Route = createFileRoute("/_authenticated/app/brands/$brandId/edit")({
  head: () => ({ meta: [{ title: "Editar marca — Cria Aí" }] }),
  component: EditBrand,
});

function EditBrand() {
  const { brandId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["brand", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").eq("id", brandId).single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Editar marca</h1>
        <p className="text-sm text-muted-foreground">Atualize a identidade e regras da marca.</p>
      </header>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : data ? <BrandForm initial={data} brandId={brandId} /> : null}
    </div>
  );
}
