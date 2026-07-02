import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/proyectos")({
  component: () => (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Proyectos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Próximamente: listado de clientes y proyectos de implementación.
        </p>
      </div>
    </div>
  ),
});