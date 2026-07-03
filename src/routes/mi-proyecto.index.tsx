import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  FolderKanban,
  AlarmClock,
  CheckCircle2,
  Hand,
  Inbox,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useMiProyecto } from "@/hooks/use-mi-proyecto";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import { diasHasta } from "@/lib/modulo-estado";

export const Route = createFileRoute("/mi-proyecto/")({
  component: MiProyectoInicio,
});

function MiProyectoInicio() {
  const { profile } = useAuth();
  const { proyectos, modulos, modulosDeProyecto, loading } = useMiProyecto();

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

  const pendientes = modulos.filter((m) => m.estado !== "aprobado").length;
  const conObs = modulos.filter((m) => m.estado === "con_observaciones").length;
  const aprobados = modulos.filter((m) => m.estado === "aprobado").length;
  const proximos = modulos
    .filter(
      (m) =>
        m.fecha_limite &&
        m.estado !== "aprobado" &&
        (diasHasta(m.fecha_limite) ?? 999) <= 7,
    )
    .sort((a, b) => (a.fecha_limite! < b.fecha_limite! ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <span>Hola{profile?.nombre ? `, ${profile.nombre}` : ""}</span>
          <Hand aria-hidden className="h-5 w-5 text-primary" strokeWidth={2.2} />
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Este es el resumen de los proyectos donde EGIXIA te ha invitado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={FolderKanban}
          label="Proyectos"
          value={proyectos.length}
          hint="Donde participas"
        />
        <Metric
          icon={ClipboardCheck}
          label="Módulos pendientes"
          value={pendientes}
          hint="Por diligenciar o corregir"
          accent
        />
        <Metric
          icon={AlarmClock}
          label="Con observaciones"
          value={conObs}
          hint="Requieren tu atención"
        />
        <Metric
          icon={CheckCircle2}
          label="Aprobados"
          value={aprobados}
          hint="Módulos completados"
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mis proyectos
          </h3>
          <Link
            to="/mi-proyecto/proyectos"
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {proyectos.slice(0, 4).map((p) => {
            const mods = modulosDeProyecto(p.id);
            const avance =
              mods.length === 0
                ? 0
                : Math.round(
                    mods.reduce((a, m) => a + (m.progreso ?? 0), 0) / mods.length,
                  );
            return (
              <Link
                key={p.id}
                to="/mi-proyecto/proyectos/$id"
                params={{ id: p.id }}
                className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition hover:border-primary/40"
              >
                <FolderKanban className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.nombre}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.empresa} · {mods.length} módulo
                    {mods.length === 1 ? "" : "s"}
                  </p>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${avance}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-foreground">
                    {avance}%
                  </div>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Próximos a vencer
        </h3>
        {proximos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No tienes módulos que venzan en los próximos 7 días.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {proximos.map((m) => {
              const cat = moduloCatalogo(m.modulo_key);
              const dias = diasHasta(m.fecha_limite!);
              const proy = proyectos.find((p) => p.id === m.proyecto_id);
              return (
                <li key={m.id}>
                  <Link
                    to="/mi-proyecto/modulo/$moduloId"
                    params={{ moduloId: m.id }}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition hover:border-primary/40"
                  >
                    <cat.icon className="h-4 w-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-foreground">
                          {cat.nombre}
                        </p>
                        {proy && (
                          <span className="inline-flex items-center rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {proy.nombre}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {proy?.empresa ? `${proy.empresa} · ` : ""}
                        {m.progreso}% avance
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        dias !== null && dias < 0
                          ? "bg-red-100 text-red-700"
                          : dias !== null && dias <= 3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-primary-soft text-primary"
                      }`}
                    >
                      {dias === null
                        ? ""
                        : dias < 0
                          ? `vencido ${Math.abs(dias)} d.`
                          : dias === 0
                            ? "hoy"
                            : `en ${dias} d.`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number | string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        accent ? "border-primary/30 bg-primary-soft" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-foreground">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

