import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/configuracion")({
  component: () => (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Próximamente: ajustes del sistema y del catálogo de módulos.
        </p>
      </div>
    </div>
  ),
});