import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileText, Loader2, Lock, MessageSquareWarning, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EstadoPastilla } from "@/components/estado-pastilla";
import {
  VencimientoBanner,
  vencimientoBloqueaEdicion,
} from "@/components/vencimiento-banner";
import { useMiProyecto } from "@/hooks/use-mi-proyecto";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import { esEditablePorInvitado } from "@/lib/modulo-estado";
import { supabase } from "@/integrations/supabase/client";
import { FormularioModulo } from "@/components/form-engine/formulario-modulo";
import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import {
  enviarModuloARevision,
  reenviarModulo,
} from "@/lib/revision.functions";
import { previsualizarActa } from "@/lib/acta.functions";
import { base64ABytes } from "@/lib/acta/acta-pdf";

export const Route = createFileRoute("/mi-proyecto/modulo/$moduloId")({
  component: ModuloPage,
});

interface Observacion {
  id: string;
  campo_key: string;
  comentario: string;
  estado: "abierta" | "resuelta";
  created_at: string;
}

function ModuloPage() {
  const { moduloId } = Route.useParams();
  const { modulos, loading, refreshModulos } = useMiProyecto();
  const modulo = modulos.find((m) => m.id === moduloId);
  const [observaciones, setObservaciones] = useState<Observacion[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const enviar = useServerFn(enviarModuloARevision);
  const reenviar = useServerFn(reenviarModulo);
  const previsualizar = useServerFn(previsualizarActa);

  useEffect(() => {
    if (!moduloId) return;
    supabase
      .from("observaciones")
      .select("id, campo_key, comentario, estado, created_at")
      .eq("proyecto_modulo_id", moduloId)
      .eq("estado", "abierta")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("[modulo] observaciones", error);
          return;
        }
        setObservaciones((data ?? []) as Observacion[]);
      });
  }, [moduloId]);

  if (loading) {
    return <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl bg-muted" />;
  }

  if (!modulo) {
    throw notFound();
  }

  const cat = moduloCatalogo(modulo.modulo_key);
  const Icon = cat.icon;

  const bloqueadoPorEstado = !esEditablePorInvitado(modulo.estado);
  const bloqueadoPorVencimiento = vencimientoBloqueaEdicion(
    modulo.fecha_limite,
    modulo.comportamiento_vencimiento,
  );
  const soloLectura = bloqueadoPorEstado || bloqueadoPorVencimiento;
  const puedeEnviar =
    !soloLectura &&
    modulo.progreso >= 100 &&
    (modulo.estado === "sin_iniciar" ||
      modulo.estado === "en_diligenciamiento" ||
      modulo.estado === "con_observaciones");
  const esReenvio = modulo.estado === "con_observaciones";

  const handlePrevisualizarActa = async () => {
    setPrevisualizando(true);
    try {
      const res = await previsualizar({ data: { moduloId: modulo.id } });
      const bytes = base64ABytes(res.base64);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Liberamos el objeto tras un momento razonable.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo generar el acta.";
      toast.error(msg);
    } finally {
      setPrevisualizando(false);
    }
  };

  const handleEnviar = async () => {
    setEnviando(true);
    try {
      if (esReenvio) {
        await reenviar({ data: { moduloId: modulo.id } });
        toast.success("Módulo reenviado a revisión.");
      } else {
        await enviar({ data: { moduloId: modulo.id } });
        toast.success("Módulo enviado a revisión.");
      }
      await refreshModulos();
      setObservaciones([]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo enviar el módulo.";
      toast.error(msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link to="/mi-proyecto">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al inicio
          </Link>
        </Button>
      </div>

      {/* Encabezado */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">
                  {cat.nombre}
                </h2>
                <EstadoPastilla estado={modulo.estado} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {cat.descripcion}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-muted-foreground">Avance</div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${modulo.progreso}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground">
                {modulo.progreso}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Banners */}
      <VencimientoBanner
        fechaLimite={modulo.fecha_limite}
        comportamiento={modulo.comportamiento_vencimiento}
      />

      {bloqueadoPorEstado && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          <Lock className="mt-0.5 h-4 w-4" />
          <span>
            {modulo.estado === "aprobado"
              ? "Este módulo ya fue aprobado; no es editable."
              : "Este módulo está en revisión; no es editable mientras el equipo de EGIXIA lo revisa."}
          </span>
        </div>
      )}

      {observaciones.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-900">
            <MessageSquareWarning className="h-4 w-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">
              Observaciones por corregir ({observaciones.length})
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {observaciones.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm text-amber-900"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  {o.campo_key}
                </div>
                <p className="mt-1 text-sm text-foreground">{o.comentario}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formulario dinámico (motor de la Parte 5) */}
      <FormularioModulo
        moduloId={modulo.id}
        proyectoId={modulo.proyecto_id}
        definicion={definicionModulo(modulo.modulo_key)}
        datosIniciales={(modulo.datos as Record<string, unknown>) ?? {}}
        soloLectura={soloLectura}
      />

      {/* Acciones */}
      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Tus cambios se guardan automáticamente. Puedes cerrar sesión y volver
          cuando quieras.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={handlePrevisualizarActa}
            disabled={previsualizando}
            className="sm:w-auto"
          >
            {previsualizando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Previsualizar acta
          </Button>
          <Button
            onClick={handleEnviar}
            disabled={!puedeEnviar || enviando}
            className="sm:w-auto"
            title={
              !puedeEnviar && !enviando
                ? "Completa todos los campos requeridos para habilitar el envío."
                : undefined
            }
          >
            {enviando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {esReenvio ? "Reenviar tras corregir" : "Enviar a revisión"}
          </Button>
        </div>
      </div>
    </div>
  );
}