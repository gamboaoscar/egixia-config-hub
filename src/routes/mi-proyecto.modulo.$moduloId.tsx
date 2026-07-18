import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, FileText, Loader2, Lock, MessageSquareWarning, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoPastilla } from "@/components/estado-pastilla";
import {
  VencimientoBanner,
  vencimientoBloqueaEdicion,
} from "@/components/vencimiento-banner";
import { useMiProyecto } from "@/hooks/use-mi-proyecto";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import { esEditablePorInvitado } from "@/lib/modulo-estado";
import { supabase } from "@/integrations/supabase/client";
import {
  FormularioModulo,
  type FormularioModuloHandle,
} from "@/components/form-engine/formulario-modulo";
import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import { aplicarOverrides } from "@/lib/form-engine/overrides";
import {
  enviarModuloARevision,
  reenviarModulo,
} from "@/lib/revision.functions";
import { previsualizarActa } from "@/lib/acta.functions";

/** Decodifica base64 → Uint8Array sin importar pdf-lib en el cliente. */
function base64ABytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

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
  const {
    moduloById,
    loading,
    refreshModulos,
    overridesDeProyecto,
    seccionOverridesDeProyecto,
  } = useMiProyecto();
  const modulo = moduloById(moduloId);
  const navigate = useNavigate();
  const [observaciones, setObservaciones] = useState<Observacion[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [progresoLive, setProgresoLive] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>("acta.pdf");
  const previewUrlRef = useRef<string | null>(null);
  const formRef = useRef<FormularioModuloHandle>(null);
  const [faltantesLive, setFaltantesLive] = useState<string[]>([]);
  const enviar = useServerFn(enviarModuloARevision);
  const reenviar = useServerFn(reenviarModulo);
  const previsualizar = useServerFn(previsualizarActa);

  // Overrides y datos iniciales memoizados: la definición no debe cambiar
  // de referencia en cada render, porque `useFormModulo` sólo resetea su
  // estado cuando cambia `moduloId`, pero el `useEffect` que valida
  // arrastra `definicion` como dependencia lógica.
  const modKey = moduloById(moduloId)?.modulo_key;
  const overridesTodos = overridesDeProyecto(
    moduloById(moduloId)?.proyecto_id ?? "",
  );
  const seccionOverridesTodos = seccionOverridesDeProyecto(
    moduloById(moduloId)?.proyecto_id ?? "",
  );
  const overridesKey = JSON.stringify(overridesTodos);
  const seccionOverridesKey = JSON.stringify(seccionOverridesTodos);
  const definicionMemo = useMemo(() => {
    if (!modKey) return { key: "", nombre: "", secciones: [] } as never;
    return aplicarOverrides(
      definicionModulo(modKey),
      overridesTodos,
      seccionOverridesTodos,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modKey, overridesKey, seccionOverridesKey]);
  // Datos iniciales: capturamos el snapshot al primer render del módulo
  // para NO reinyectar el estado en cada refresh del hook `useMiProyecto`
  // (que rehidrata `modulo.datos` con una referencia nueva).
  const datosInicialesMemo = useMemo(
    () => (moduloById(moduloId)?.datos as Record<string, unknown>) ?? {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moduloId],
  );

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

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  if (loading) {
    return <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl bg-muted" />;
  }

  if (!modulo) {
    throw notFound();
  }

  const overrides = overridesDeProyecto(modulo.proyecto_id);
  const seccionOverrides = seccionOverridesDeProyecto(modulo.proyecto_id);
  const cat = moduloCatalogo(modulo.modulo_key);
  const Icon = cat.icon;
  void overrides;
  void seccionOverrides;

  const bloqueadoPorEstado = !esEditablePorInvitado(modulo.estado);
  const bloqueadoPorVencimiento = vencimientoBloqueaEdicion(
    modulo.fecha_limite,
    modulo.comportamiento_vencimiento,
  );
  const soloLectura = bloqueadoPorEstado || bloqueadoPorVencimiento;
  const estadoPermiteEnviar =
    modulo.estado === "sin_iniciar" ||
    modulo.estado === "en_diligenciamiento" ||
    modulo.estado === "con_observaciones";
  const enviableAhora =
    !soloLectura && estadoPermiteEnviar && faltantesLive.length === 0;
  const esReenvio = modulo.estado === "con_observaciones";

  const irAlPrimerFaltante = (): boolean => {
    const faltantes = formRef.current?.mostrarFaltantes() ?? [];
    if (faltantes.length > 0) {
      toast.error(
        `Te faltan ${faltantes.length} campo(s) obligatorio(s). Te llevamos al primero.`,
      );
      return true;
    }
    return false;
  };

  const handlePrevisualizarActa = async () => {
    if (irAlPrimerFaltante()) return;
    // Guardado inmediato de cambios pendientes antes de generar el acta,
    // para que el PDF refleje siempre lo último que escribió el usuario.
    await formRef.current?.flush();
    setPrevisualizando(true);
    try {
      const res = await previsualizar({ data: { moduloId: modulo.id } });
      const bytes = base64ABytes(res.base64);
      const buf = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setPreviewFilename(res.filename ?? `acta-v${res.version}.pdf`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo generar el acta.";
      toast.error(msg);
    } finally {
      setPrevisualizando(false);
    }
  };

  const handleDescargarPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = previewFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const cerrarPreview = (open: boolean) => {
    if (open) return;
    setPreviewUrl(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  const handleEnviar = async () => {
    if (irAlPrimerFaltante()) return;
    if (!estadoPermiteEnviar) {
      toast.error("Este módulo no está en un estado que permita enviarlo.");
      return;
    }
    await formRef.current?.flush();
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
      navigate({
        to: "/mi-proyecto/proyectos/$id",
        params: { id: modulo.proyecto_id },
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo enviar el módulo.";
      toast.error(msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
          <Link
            to="/mi-proyecto/proyectos/$id"
            params={{ id: modulo.proyecto_id }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al proyecto
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
        ref={formRef}
        moduloId={modulo.id}
        proyectoId={modulo.proyecto_id}
        definicion={definicionMemo}
        datosIniciales={datosInicialesMemo}
        soloLectura={soloLectura}
        onProgreso={setProgresoLive}
        onFaltantes={setFaltantesLive}
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
            disabled={enviando || soloLectura || !estadoPermiteEnviar}
            className="sm:w-auto"
            title={
              !enviableAhora && !enviando
                ? "Al enviar te llevaremos al primer campo obligatorio que falte."
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

      <Dialog open={previewUrl !== null} onOpenChange={cerrarPreview}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <DialogTitle>Vista previa del acta</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDescargarPreview}
              className="mr-8"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
          </DialogHeader>
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title="Acta"
              className="flex-1 w-full rounded-md border border-border bg-white"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {!soloLectura && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Avance del módulo
            </span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progresoLive ?? modulo.progreso}%` }}
              />
            </div>
            <span className="min-w-[3ch] text-right text-sm font-semibold text-foreground">
              {progresoLive ?? modulo.progreso}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}