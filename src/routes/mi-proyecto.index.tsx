import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/mi-proyecto/")({
  component: MiProyectoIndex,
});

function MiProyectoIndex() {
  const { profile } = useAuth();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          Portal de proveedor
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Hola{profile?.nombre ? `, ${profile.nombre}` : ""}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Este es tu espacio de proyecto. Pronto podrás diligenciar los formularios
          asignados por tu equipo de implementación.
        </p>
      </div>
    </div>
  );
}