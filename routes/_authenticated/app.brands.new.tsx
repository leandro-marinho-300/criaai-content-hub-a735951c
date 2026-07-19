import { createFileRoute } from "@tanstack/react-router";
import { BrandForm } from "@/components/brand-form";

export const Route = createFileRoute("/_authenticated/app/brands/new")({
  head: () => ({ meta: [{ title: "Nova marca — Cria Aí" }] }),
  component: NewBrand,
});

function NewBrand() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Nova marca</h1>
        <p className="text-sm text-muted-foreground">Preencha os dados que serão reutilizados em todos os briefings.</p>
      </header>
      <BrandForm />
    </div>
  );
}
