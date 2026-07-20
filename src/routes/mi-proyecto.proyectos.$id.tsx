import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  FileText,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMiProyecto } from "@/hooks/use-mi-proyecto";
import { EstadoPastilla } from "@/components/estado-pastilla";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import {
  botonAccionModulo,
  diasHasta,
  type ModuloEstado,
} from "@/lib/modulo-estado";
import { esEditablePorInvitado } from "@/lib/modulo-estado";
import { descargarActaFirmada, listarActas } from "@/lib/acta.functions";
import { descargarPdfBlob } from "@/lib/acta/abrir-pdf";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatoFechaHoraCO, formatoFechaPlanaCortaCO } from "@/lib/fechas";

export const Route = createFileRoute("/mi-proyecto/proyectos/$id")({
  component: MiProyectoDetalle,
});

function MiProyectoDetalle() {
  const { id } = Route.useParams();
  const { proyectoById, modulosDeProyecto, loading } = useMiProyecto();

  const modulosProy = modulosDeProyecto(id);
  const idsUpdatedPor = useMemo(
    () =>
      Array.from(
        new Set(
          modulosProy
            .map((m) => m.updated_por)
            .filter((v): v is string => !!v),
        ),
      ),
    [modulosProy],
  );
  const [autores, setAutores] = useState<Record<string, string>>({});
  useEffect(() => {
    if (idsUpdatedPor.length === 0) {
      setAutores({});
      return;
    }
    let cancelado = false;
    supabase
      .from("profiles")
      .select("id, nombre, apellido, email")
      .in("id", idsUpdatedPor)
      .then(({ data }) => {
        if (cancelado || !data) return;
        const map: Record<string, string> = {};
        for (const p of data) {
          const n = `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim();
          map[p.id] = n || p.email || "Usuario";
        }
        setAutores(map);
      });
    return () => {
      cancelado = true;
    };
  }, [idsUpdatedPor.join("|")]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const proyecto = proyectoById(id);
  if (!proyecto) throw notFound();

  const modulos = modulosProy;
  const pendientes = modulos.filter((m) => m.estado !== "aprobado").length;
  const conObservaciones = modulos.filter(
    (m) => m.estado === "con_observaciones",
  ).length;
  const avanceGeneral =
    modulos.length === 0
      ? 0
      : Math.round(
          modulos.reduce((acc, m) => acc + (m.progreso ?? 0), 0) /
            modulos.length,
        );

  const mensajeSiguiente =
    conObservaciones > 0
      ? `Tienes ${conObservaciones} módulo${conObservaciones === 1 ? "" : "s"} con observaciones por corregir.`
      : pendientes === 0
        ? "¡Excelente! Ya completaste todos los módulos de este proyecto."
        : `Te falta${pendientes === 1 ? "" : "n"} completar ${pendientes} módulo${pendientes === 1 ? "" : "s"}.`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link to="/mi-proyecto/proyectos">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver a mis proyectos
          </Link>
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              {proyecto.empresa}
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {proyecto.nombre}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {mensajeSiguiente}
            </p>
          </div>
          <ProgresoAnillo valor={avanceGeneral} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Módulos
          </h3>
          <span className="text-xs text-muted-foreground">
            {modulos.length} en total
          </span>
        </div>

        {modulos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Aún no hay módulos asignados a este proyecto.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((m) => (
              <ModuloCard
                key={m.id}
                id={m.id}
                moduloKey={m.modulo_key}
                estado={m.estado}
                progreso={m.progreso}
                fechaLimite={m.fecha_limite}
                updatedAt={m.updated_at}
                updatedPorNombre={m.updated_por ? autores[m.updated_por] ?? null : null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ModuloCard({
  id,
  moduloKey,
  estado,
  progreso,
  fechaLimite,
  updatedAt,
  updatedPorNombre,
}: {
  id: string;
  moduloKey: string;
  estado: ModuloEstado;
  progreso: number;
  fechaLimite: string | null;
  updatedAt: string;
  updatedPorNombre: string | null;
}) {
  const cat = moduloCatalogo(moduloKey);
  const Icon = cat.icon;
  const dias = diasHasta(fechaLimite);
  const destacado = estado === "con_observaciones";
  const label = botonAccionModulo(estado);
  const bloqueado = !esEditablePorInvitado(estado);
  const descargar = useServerFn(descargarActaFirmada);
  const listar = useServerFn(listarActas);
  const [cargandoActa, setCargandoActa] = useState(false);
  const [versiones, setVersiones] = useState<
    Array<{ version: number; generada_at: string; autor: string }>
  >([]);
  const [descargandoVer, setDescargandoVer] = useState<number | null>(null);

  useEffect(() => {
    if (!bloqueado) {
      setVersiones([]);
      return;
    }
    let cancelado = false;
    listar({ data: { moduloId: id } })
      .then((rows) => {
        if (!cancelado) setVersiones(rows);
      })
      .catch(() => {
        if (!cancelado) setVersiones([]);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, bloqueado]);

  const handleVerActa = async () => {
    setCargandoActa(true);
    try {
      const res = await descargar({ data: { moduloId: id } });
      if (!res.base64) {
        toast.error("Aún no hay un acta generada para este módulo.");
        return;
      }
      descargarPdfBlob(res.base64, res.filename);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el acta.");
    } finally {
      setCargandoActa(false);
    }
  };

  const handleDescargarVersion = async (v: number) => {
    setDescargandoVer(v);
    try {
      const res = await descargar({ data: { moduloId: id, version: v } });
      if (!res.base64) {
        toast.error("No se pudo descargar esa versión.");
        return;
      }
      descargarPdfBlob(res.base64, res.filename);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar.");
    } finally {
      setDescargandoVer(null);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md",
        destacado ? "border-amber-300 ring-1 ring-amber-200" : "border-border",
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <EstadoPastilla estado={estado} />
        </div>
        <h4 className="mt-3 text-base font-semibold text-foreground">
          {cat.nombre}
        </h4>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {cat.descripcion}
        </p>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Avance</span>
            <span className="font-medium text-foreground">{progreso}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>

        {(progreso > 0 || estado !== "sin_iniciar") && updatedAt && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Última actualización: {formatoFechaHoraCO(updatedAt)}
            {updatedPorNombre ? ` · ${updatedPorNombre}` : ""}
          </div>
        )}

        {fechaLimite && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>
              {formatoFechaPlanaCortaCO(fechaLimite)}
              {dias !== null &&
                (dias < 0
                  ? " · vencido"
                  : dias <= 3
                    ? ` · faltan ${dias}d`
                    : "")}
            </span>
          </div>
        )}

        {bloqueado && (
          <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] text-sky-800">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              {estado === "aprobado"
                ? "Ya aprobado por EGIXIA. No es editable."
                : "En revisión por EGIXIA. No es editable mientras dure la revisión."}
            </span>
          </div>
        )}
      </div>

      {bloqueado ? (
        <div className="mt-5 space-y-2">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={handleVerActa}
            disabled={cargandoActa}
          >
            {cargandoActa ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Descargar acta{versiones.length > 0 ? ` v${versiones[0].version}` : ""}
            <ArrowRight className="h-4 w-4" />
          </Button>
          {versiones.length > 1 && (
            <details className="rounded-lg border border-border bg-background text-xs">
              <summary className="cursor-pointer px-3 py-2 text-muted-foreground">
                Versiones anteriores ({versiones.length - 1})
              </summary>
              <ul className="divide-y divide-border">
                {versiones.slice(1).map((v) => (
                  <li
                    key={v.version}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="text-muted-foreground">
                      v{v.version} · {formatoFechaHoraCO(v.generada_at)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDescargarVersion(v.version)}
                      disabled={descargandoVer === v.version}
                    >
                      {descargandoVer === v.version ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <Button
          asChild
          variant={destacado ? "default" : "outline"}
          className={cn(
            "mt-5 w-full justify-between",
            destacado && "bg-amber-600 hover:bg-amber-700",
          )}
        >
          <Link to="/mi-proyecto/modulo/$moduloId" params={{ moduloId: id }}>
            {label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

function ProgresoAnillo({ valor }: { valor: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, valor)) / 100) * c;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={r}
            strokeWidth="8"
            className="fill-none stroke-muted"
          />
          <circle
            cx="40"
            cy="40"
            r={r}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
            className="fill-none stroke-primary transition-all"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-foreground">
          {valor}%
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Avance
        <br />
        general
      </div>
    </div>
  );
}
