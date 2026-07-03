import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FolderKanban, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMiProyecto } from "@/hooks/use-mi-proyecto";

export const Route = createFileRoute("/mi-proyecto/proyectos/")({
  head: () => ({ meta: [{ title: "Mis proyectos · EGIXIA Configurator" }] }),
  component: MisProyectos,
});

function MisProyectos() {
  const { proyectos, modulosDeProyecto, loading } = useMiProyecto();

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (proyectos.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <Inbox className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            Aún no tienes proyectos asignados
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando el equipo de EGIXIA te vincule a un proyecto, aparecerá aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <FolderKanban className="h-5 w-5 text-primary" /> Mis proyectos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecciona un proyecto para ver y diligenciar sus módulos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proyectos.map((p) => {
          const modulos = modulosDeProyecto(p.id);
          const total = modulos.length;
          const aprobados = modulos.filter((m) => m.estado === "aprobado").length;
          const pendientes = total - aprobados;
          const avance =
            total === 0
              ? 0
              : Math.round(
                  modulos.reduce((acc, m) => acc + (m.progreso ?? 0), 0) / total,
                );
          return (
            <div
              key={p.id}
              className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                  {p.empresa}
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground">
                  {p.nombre}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {total} módulo{total === 1 ? "" : "s"} ·{" "}
                  {pendientes === 0
                    ? "Todos completados"
                    : `${pendientes} pendiente${pendientes === 1 ? "" : "s"}`}
                </p>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Avance general</span>
                    <span className="font-medium text-foreground">{avance}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${avance}%` }}
                    />
                  </div>
                </div>
              </div>

              <Button asChild className="mt-5 w-full justify-between">
                <Link to="/mi-proyecto/proyectos/$id" params={{ id: p.id }}>
                  Abrir proyecto
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
