import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FolderKanban,
  ClipboardCheck,
  AlarmClock,
  CheckCircle2,
  Hand,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import { ESTADO_LABEL, type ModuloEstado } from "@/lib/modulo-estado";

export const Route = createFileRoute("/app/")({
  component: DashboardAdmin,
});

interface ModuloRow {
  id: string;
  proyecto_id: string;
  modulo_key: string;
  estado: string;
  fecha_limite: string | null;
  enviado_at: string | null;
  progreso: number;
  proyectos: { nombre: string; empresa: string | null; estado: string } | null;
}

function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function DashboardAdmin() {
  const { profile } = useAuth();
  const [modulos, setModulos] = useState<ModuloRow[]>([]);
  const [proyectosActivos, setProyectosActivos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: mods }, { count }] = await Promise.all([
        supabase
          .from("proyecto_modulos")
          .select(
            "id, proyecto_id, modulo_key, estado, fecha_limite, enviado_at, progreso, proyectos(nombre, empresa, estado)",
          )
          .order("enviado_at", { ascending: true, nullsFirst: false }),
        supabase
          .from("proyectos")
          .select("id", { count: "exact", head: true })
          .in("estado", ["nuevo", "en_proceso", "en_revision"]),
      ]);
      setModulos((mods ?? []) as unknown as ModuloRow[]);
      setProyectosActivos(count ?? 0);
      setLoading(false);
    })();
  }, []);

  const porEstado = useMemo(() => {
    const acc: Record<string, number> = {
      sin_iniciar: 0,
      en_diligenciamiento: 0,
      en_revision: 0,
      con_observaciones: 0,
      aprobado: 0,
    };
    for (const m of modulos) acc[m.estado] = (acc[m.estado] ?? 0) + 1;
    return acc;
  }, [modulos]);

  const enRevision = porEstado.en_revision;
  const proximos = useMemo(
    () =>
      modulos
        .filter(
          (m) =>
            m.fecha_limite &&
            m.estado !== "aprobado" &&
            daysUntil(m.fecha_limite) <= 7,
        )
        .sort((a, b) => (a.fecha_limite! < b.fecha_limite! ? -1 : 1)),
    [modulos],
  );
  const aprobados = porEstado.aprobado;

  const dataChart = [
    { name: "Sin iniciar", total: porEstado.sin_iniciar },
    { name: "Diligenciando", total: porEstado.en_diligenciamiento },
    { name: "En revisión", total: porEstado.en_revision },
    { name: "Con obs.", total: porEstado.con_observaciones },
    { name: "Aprobado", total: porEstado.aprobado },
  ];

  const pendientes = modulos
    .filter((m) => m.estado === "en_revision")
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Hola{profile?.nombre ? `, ${profile.nombre}` : ""} 👋
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Panorama general de los proyectos e implementaciones en curso.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={FolderKanban}
          label="Proyectos activos"
          value={loading ? "—" : proyectosActivos}
          hint="Nuevo · en proceso · en revisión"
        />
        <Metric
          icon={ClipboardCheck}
          label="Pendientes de revisión"
          value={loading ? "—" : enRevision}
          hint="Módulos esperando decisión"
          accent
        />
        <Metric
          icon={AlarmClock}
          label="Próximos a vencer"
          value={loading ? "—" : proximos.length}
          hint="En los siguientes 7 días"
        />
        <Metric
          icon={CheckCircle2}
          label="Módulos aprobados"
          value={loading ? "—" : aprobados}
          hint="Trabajo completado"
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Módulos por estado
        </h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#0F2B8E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Revisiones pendientes
            </h3>
            <Link
              to="/app/revisiones"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>
          {pendientes.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No hay módulos en cola de revisión.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {pendientes.map((m) => {
                const cat = moduloCatalogo(m.modulo_key);
                return (
                  <li key={m.id}>
                    <Link
                      to="/app/modulo/$moduloId"
                      params={{ moduloId: m.id }}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition hover:border-primary/40"
                    >
                      <cat.icon className="h-4 w-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {cat.nombre}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.proyectos?.nombre}
                          {m.proyectos?.empresa ? ` · ${m.proyectos.empresa}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Próximos a vencer
          </h3>
          {proximos.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Ningún módulo vence en los próximos 7 días.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {proximos.slice(0, 5).map((m) => {
                const cat = moduloCatalogo(m.modulo_key);
                const dias = daysUntil(m.fecha_limite!);
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    <cat.icon className="h-4 w-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {cat.nombre}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.proyectos?.nombre} · {ESTADO_LABEL[m.estado as ModuloEstado]}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        dias < 0
                          ? "bg-red-100 text-red-700"
                          : dias <= 3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-primary-soft text-primary"
                      }`}
                    >
                      {dias < 0
                        ? `vencido ${Math.abs(dias)} d.`
                        : dias === 0
                          ? "hoy"
                          : `en ${dias} d.`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
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
        accent
          ? "border-primary/30 bg-primary-soft"
          : "border-border bg-card"
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