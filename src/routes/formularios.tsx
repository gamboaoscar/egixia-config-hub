import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/formularios")({
  component: () => (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Formularios</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Próximamente: aquí verás los módulos y formularios de tu proyecto.
        </p>
      </div>
    </div>
  ),
});