import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const { profile } = useAuth();
  const nombre = profile?.nombre || "";
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          Área interna
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Bienvenido{nombre ? `, ${nombre}` : ""}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Desde aquí gestionarás los proyectos de implementación, revisiones e
          invitaciones. Los módulos se irán habilitando en los siguientes pasos.
        </p>
      </div>
    </div>
  );
}