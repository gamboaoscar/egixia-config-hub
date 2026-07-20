import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstadoPastilla } from "@/components/estado-pastilla";
import { DatePickerHabil } from "@/components/ui/date-picker-habil";
import { useParametrosSistema } from "@/hooks/use-parametros-sistema";
import { esNoHabil, parseISOLocal } from "@/lib/festivos-co";
import {
  FormularioModulo,
  type FormularioModuloHandle,
} from "@/components/form-engine/formulario-modulo";
import { supabase } from "@/integrations/supabase/client";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import {
  aplicarOverrides,
  type CampoOverride,
  type SeccionOverride,
} from "@/lib/form-engine/overrides";
import { resolverOpcionesDinamicas } from "@/lib/form-engine/opciones-dinamicas";
import {
  aprobarModulo,
  devolverModuloConObservaciones,
  reabrirModulo,
  enviarModuloARevision,
  reenviarModulo,
} from "@/lib/revision.functions";
import { actualizarConfigModulo, editarDatosModulo } from "@/lib/admin.functions";
import { previsualizarActa, listarActas, descargarActaFirmada } from "@/lib/acta.functions";
import { descargarPdfBlob } from "@/lib/acta/abrir-pdf";
import { calcularProgreso } from "@/lib/form-engine/validacion";
import { fechaISOBogota, formatoFechaHoraCO } from "@/lib/fechas";

/** Decodifica base64 → Uint8Array sin importar pdf-lib en el cliente. */
function base64ABytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export const Route = createFileRoute("/app/modulo/$moduloId")({
  component: RevisionModuloPage,
});

interface ModuloRow {
  id: string;
  proyecto_id: string;
  modulo_key: string;
  estado:
    | "sin_iniciar"
    | "en_diligenciamiento"
    | "en_revision"
    | "con_observaciones"
    | "aprobado";
  datos: Record<string, unknown>;
  progreso: number;
  enviado_at: string | null;
  revisado_at: string | null;
  fecha_limite: string | null;
  comportamiento_vencimiento:
    | "bloquear"
    | "editable_avisar"
    | "solo_avisar"
    | "extension_implementador"
    | null;
  proyectos?: { nombre: string; empresa: string | null } | null;
}

interface Observacion {
  id: string;
  campo_key: string;
  comentario: string;
  estado: "abierta" | "resuelta";
  created_at: string;
}

interface NuevaObservacion {
  campo_key: string;
  comentario: string;
}

function RevisionModuloPage() {
  const { moduloId } = Route.useParams();
  const parametros = useParametrosSistema();
  const [modulo, setModulo] = useState<ModuloRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [observaciones, setObservaciones] = useState<Observacion[]>([]);
  const [nuevas, setNuevas] = useState<NuevaObservacion[]>([]);
  const [accion, setAccion] = useState<
    "idle" | "aprobar" | "devolver" | "reabrir"
  >("idle");

  const aprobar = useServerFn(aprobarModulo);
  const devolver = useServerFn(devolverModuloConObservaciones);
  const reabrir = useServerFn(reabrirModulo);
  const editar = useServerFn(editarDatosModulo);
  const actualizarConfig = useServerFn(actualizarConfigModulo);
  const enviar = useServerFn(enviarModuloARevision);
  const reenviar = useServerFn(reenviarModulo);
  const previsualizar = useServerFn(previsualizarActa);
  const listar = useServerFn(listarActas);
  const descargarVersion = useServerFn(descargarActaFirmada);
  const [versiones, setVersiones] = useState<
    Array<{ version: number; generada_at: string; autor: string }>
  >([]);
  const [descargandoVer, setDescargandoVer] = useState<number | null>(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [datosEdit, setDatosEdit] = useState<Record<string, unknown>>({});
  const [guardando, setGuardando] = useState(false);
  const [overrides, setOverrides] = useState<CampoOverride[]>([]);
  const [seccionOverrides, setSeccionOverrides] = useState<SeccionOverride[]>([]);
  // Datos de los módulos hermanos del proyecto (por modulo_key) para
  // resolver `opcionesDesde` (opciones dinámicas entre módulos).
  const [datosHermanos, setDatosHermanos] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [cfgFecha, setCfgFecha] = useState<string>("");
  const [cfgComp, setCfgComp] = useState<string>("solo_avisar");
  const [cfgEstado, setCfgEstado] = useState<string>("sin_iniciar");
  const [guardandoCfg, setGuardandoCfg] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [previsualizando, setPrevisualizando] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>("acta.pdf");
  const previewUrlRef = useRef<string | null>(null);
  const formRef = useRef<FormularioModuloHandle>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // "Hoy" en zona America/Bogota (no la zona local del navegador).
  const hoyStr = fechaISOBogota();

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("proyecto_modulos")
      .select(
        "id, proyecto_id, modulo_key, estado, datos, progreso, enviado_at, revisado_at, fecha_limite, comportamiento_vencimiento, proyectos(nombre, empresa)",
      )
      .eq("id", moduloId)
      .maybeSingle();
    if (error) {
      console.error("[revision] cargar", error);
    }
    setModulo((data ?? null) as ModuloRow | null);
    const { data: obs } = await supabase
      .from("observaciones")
      .select("id, campo_key, comentario, estado, created_at")
      .eq("proyecto_modulo_id", moduloId)
      .order("created_at", { ascending: false });
    setObservaciones((obs ?? []) as Observacion[]);
    setLoading(false);
    if (data) {
      setDatosEdit((data.datos as Record<string, unknown>) ?? {});
      setCfgFecha((data.fecha_limite as string | null) ?? "");
      setCfgComp(
        (data.comportamiento_vencimiento as string | null) ?? "solo_avisar",
      );
      setCfgEstado(data.estado as string);
    }
    if (data?.proyecto_id) {
      const [{ data: ov }, { data: os }, { data: hermanos }] = await Promise.all([
        supabase
          .from("catalogo_overrides")
          .select("modulo_key, campo_key, activo, label, requerido, guia, opciones_permitidas")
          .eq("proyecto_id", data.proyecto_id),
        supabase
          .from("catalogo_overrides_seccion")
          .select("modulo_key, seccion_key, habilitada, obligatoria")
          .eq("proyecto_id", data.proyecto_id),
        supabase
          .from("proyecto_modulos")
          .select("modulo_key, datos")
          .eq("proyecto_id", data.proyecto_id),
      ]);
      setOverrides((ov ?? []) as unknown as CampoOverride[]);
      setSeccionOverrides((os ?? []) as unknown as SeccionOverride[]);
      const mapa: Record<string, Record<string, unknown>> = {};
      for (const h of hermanos ?? []) {
        mapa[h.modulo_key as string] =
          (h.datos as Record<string, unknown>) ?? {};
      }
      setDatosHermanos(mapa);
    }
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduloId]);

  useEffect(() => {
    let cancelado = false;
    listar({ data: { moduloId } })
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
  }, [moduloId, modulo?.estado]);

  const handleDescargarVersion = async (v: number) => {
    setDescargandoVer(v);
    try {
      const res = await descargarVersion({ data: { moduloId, version: v } });
      if (!res.base64) {
        toast.error("No se pudo descargar esa versión.");
        return;
      }
      descargarPdfBlob(res.base64, res.filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar.");
    } finally {
      setDescargandoVer(null);
    }
  };

  // Definición efectiva: catálogo + overrides + opciones dinámicas
  // resueltas con los datos de los módulos hermanos del proyecto.
  const definicionEfectiva = (moduloKey: string) =>
    resolverOpcionesDinamicas(
      aplicarOverrides(definicionModulo(moduloKey), overrides, seccionOverrides),
      (k) => datosHermanos[k] ?? null,
    );

  const campos = useMemo(() => {
    if (!modulo) return [] as { key: string; label: string; seccion: string }[];
    const def = resolverOpcionesDinamicas(
      aplicarOverrides(
        definicionModulo(modulo.modulo_key),
        overrides,
        seccionOverrides,
      ),
      (k) => datosHermanos[k] ?? null,
    );
    const out: { key: string; label: string; seccion: string }[] = [];
    for (const s of def.secciones) {
      for (const c of s.campos) {
        if (c.tipo === "info") continue;
        out.push({ key: c.key, label: c.label, seccion: s.titulo });
      }
    }
    return out;
  }, [modulo, overrides, seccionOverrides, datosHermanos]);

  if (loading) {
    return <div className="mx-auto h-64 max-w-4xl animate-pulse rounded-2xl bg-muted" />;
  }
  if (!modulo) throw notFound();

  const cat = moduloCatalogo(modulo.modulo_key);
  const Icon = cat.icon;
  const abiertas = observaciones.filter((o) => o.estado === "abierta");
  const resueltas = observaciones.filter((o) => o.estado === "resuelta");

  const puedeAprobar = modulo.estado === "en_revision";
  const puedeDevolver = modulo.estado === "en_revision";
  const puedeReabrir = modulo.estado === "aprobado";
  const estadoPermiteEnviar =
    modulo.estado === "sin_iniciar" ||
    modulo.estado === "en_diligenciamiento" ||
    modulo.estado === "con_observaciones";
  const esReenvio = modulo.estado === "con_observaciones";

  const handleGuardarEdicion = async () => {
    if (!modulo) return;
    setGuardando(true);
    try {
      const def = definicionEfectiva(modulo.modulo_key);
      const progreso = calcularProgreso(def, datosEdit);
      await editar({
        data: { moduloId: modulo.id, datos: datosEdit, progreso },
      });
      toast.success("Cambios guardados. Se registró en auditoría.");
      setModoEdicion(false);
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const handleAprobar = async () => {
    setAccion("aprobar");
    try {
      await aprobar({ data: { moduloId: modulo.id } });
      toast.success("Módulo aprobado.");
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aprobar.");
    } finally {
      setAccion("idle");
    }
  };

  const handleDevolver = async () => {
    if (nuevas.length === 0) {
      toast.error("Añade al menos una observación.");
      return;
    }
    const invalidas = nuevas.some(
      (o) => !o.campo_key || o.comentario.trim().length < 3,
    );
    if (invalidas) {
      toast.error("Cada observación necesita un campo y un comentario.");
      return;
    }
    setAccion("devolver");
    try {
      await devolver({
        data: { moduloId: modulo.id, observaciones: nuevas },
      });
      toast.success("Módulo devuelto al proveedor con observaciones.");
      setNuevas([]);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo devolver.");
    } finally {
      setAccion("idle");
    }
  };

  const handleReabrir = async () => {
    setAccion("reabrir");
    try {
      await reabrir({ data: { moduloId: modulo.id } });
      toast.success("Módulo reabierto.");
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reabrir.");
    } finally {
      setAccion("idle");
    }
  };

  const handleGuardarConfig = async () => {
    if (!modulo) return;
    if (cfgFecha && cfgFecha < hoyStr) {
      toast.error("La fecha límite no puede ser anterior a hoy.");
      return;
    }
    if (
      cfgFecha &&
      parametros.bloquear_fines_semana_festivos &&
      esNoHabil(parseISOLocal(cfgFecha))
    ) {
      toast.error(
        "La fecha no puede caer en fin de semana o festivo de Colombia.",
      );
      return;
    }
    setGuardandoCfg(true);
    try {
      await actualizarConfig({
        data: {
          moduloId: modulo.id,
          fecha_limite: cfgFecha ? cfgFecha : null,
          comportamiento_vencimiento: cfgComp as
            | "bloquear"
            | "editable_avisar"
            | "solo_avisar"
            | "extension_implementador",
          estado: cfgEstado as ModuloRow["estado"],
        },
      });
      toast.success("Configuración actualizada.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setGuardandoCfg(false);
    }
  };

  const guardarSiEditando = async (): Promise<boolean> => {
    if (!modoEdicion) return true;
    try {
      const def = definicionEfectiva(modulo.modulo_key);
      const progreso = calcularProgreso(def, datosEdit);
      await editar({ data: { moduloId: modulo.id, datos: datosEdit, progreso } });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    }
  };

  const irAlPrimerFaltante = (): boolean => {
    if (!modoEdicion) return false;
    const faltantes = formRef.current?.mostrarFaltantes() ?? [];
    if (faltantes.length > 0) {
      toast.error(
        `Faltan ${faltantes.length} campo(s) obligatorio(s). Te llevamos al primero.`,
      );
      return true;
    }
    return false;
  };

  const handlePrevisualizar = async () => {
    if (irAlPrimerFaltante()) return;
    if (!(await guardarSiEditando())) return;
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
      toast.error(err instanceof Error ? err.message : "No se pudo generar el acta.");
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

  const handleEnviarRevision = async () => {
    if (irAlPrimerFaltante()) return;
    if (!(await guardarSiEditando())) return;
    setEnviando(true);
    try {
      if (esReenvio) {
        await reenviar({ data: { moduloId: modulo.id } });
        toast.success("Módulo reenviado a revisión.");
      } else {
        await enviar({ data: { moduloId: modulo.id } });
        toast.success("Módulo enviado a revisión.");
      }
      setModoEdicion(false);
      await cargar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/app/$section" params={{ section: "revisiones" }}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver a revisiones
          </Link>
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{cat.nombre}</h2>
                <EstadoPastilla estado={modulo.estado} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {modulo.proyectos?.nombre}
                {modulo.proyectos?.empresa ? ` · ${modulo.proyectos.empresa}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {modulo.enviado_at
                  ? `Enviado el ${formatoFechaHoraCO(modulo.enviado_at)}`
                  : "Aún sin envíos."}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Avance</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{modulo.progreso}%</div>
          </div>
        </div>
      </section>

      {/* Configuración del módulo (interno) */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Configuración del módulo
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Ajusta el avance, la fecha de vencimiento y qué debe pasar cuando se
          cumpla. Los cambios quedan registrados en auditoría.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Estado del módulo</Label>
            <Select value={cfgEstado} onValueChange={setCfgEstado}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin_iniciar">Sin iniciar</SelectItem>
                <SelectItem value="en_diligenciamiento">
                  En diligenciamiento (reabierto)
                </SelectItem>
                <SelectItem value="con_observaciones">
                  Con observaciones
                </SelectItem>
                <SelectItem value="en_revision">En revisión</SelectItem>
                <SelectItem value="aprobado">Aprobado</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cambiar a “En diligenciamiento” reabre el módulo para que el
              invitado pueda seguir editando.
            </p>
          </div>
          <div>
            <Label className="text-xs">Fecha límite</Label>
            <div className="mt-1">
              <DatePickerHabil
                value={cfgFecha}
                onChange={setCfgFecha}
                min={hoyStr}
                bloquearNoHabiles={parametros.bloquear_fines_semana_festivos}
              />
            </div>
            {cfgFecha && cfgFecha < hoyStr && (
              <p className="mt-1 text-xs text-red-600">
                La fecha no puede ser anterior a hoy.
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">Al vencer</Label>
            <Select value={cfgComp} onValueChange={setCfgComp}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solo_avisar">Solo avisar</SelectItem>
                <SelectItem value="editable_avisar">
                  Editable con aviso
                </SelectItem>
                <SelectItem value="bloquear">Bloquear al vencer</SelectItem>
                <SelectItem value="extension_implementador">
                  Requiere extensión
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            onClick={handleGuardarConfig}
            disabled={guardandoCfg || (!!cfgFecha && cfgFecha < hoyStr)}
          >
            {guardandoCfg ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Guardar configuración
          </Button>
        </div>
      </section>

      {/* Observaciones abiertas y resueltas */}
      {abiertas.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-900">
            <MessageSquareWarning className="h-4 w-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">
              Observaciones abiertas ({abiertas.length})
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {abiertas.map((o) => (
              <li key={o.id} className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  {o.campo_key}
                </div>
                <p className="mt-1 text-foreground">{o.comentario}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formulario en solo lectura para revisar */}
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Contenido del módulo
        </p>
        {!modoEdicion ? (
          <Button size="sm" variant="outline" onClick={() => setModoEdicion(true)}>
            <Pencil className="mr-1 h-4 w-4" />
            Editar respuestas
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDatosEdit((modulo.datos as Record<string, unknown>) ?? {});
                setModoEdicion(false);
              }}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleGuardarEdicion} disabled={guardando}>
              {guardando ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        )}
      </div>
      {modoEdicion && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Estás editando respuestas del invitado. Cada guardado queda registrado
          en la auditoría del proyecto.
        </p>
      )}
      <FormularioModulo
        ref={formRef}
        moduloId={modulo.id}
        proyectoId={modulo.proyecto_id}
        definicion={definicionEfectiva(modulo.modulo_key)}
        datosIniciales={modoEdicion ? datosEdit : (modulo.datos as Record<string, unknown>) ?? {}}
        soloLectura={!modoEdicion}
        onCambio={modoEdicion ? setDatosEdit : undefined}
      />

      {/* Acciones de flujo (previsualizar y enviar a revisión) — disponibles para admin/implementador */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Acta y envío
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Puedes previsualizar el acta con los datos actuales o enviar el
              módulo a revisión en nombre del invitado. Si estás editando,
              guardaremos primero tus cambios.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handlePrevisualizar}
              disabled={previsualizando}
            >
              {previsualizando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Previsualizar acta
            </Button>
            {estadoPermiteEnviar && (
              <Button onClick={handleEnviarRevision} disabled={enviando}>
                {enviando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {esReenvio ? "Reenviar a revisión" : "Enviar a revisión"}
              </Button>
            )}
          </div>
        </div>
      </section>

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

      {/* Historial de actas */}
      {versiones.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Versiones del acta ({versiones.length})
          </h3>
          <ul className="mt-3 divide-y divide-border">
            {versiones.map((v, i) => (
              <li
                key={v.version}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    Acta v{v.version}
                    {i === 0 && (
                      <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                        Más reciente
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Generada {formatoFechaHoraCO(v.generada_at)} · {v.autor}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDescargarVersion(v.version)}
                  disabled={descargandoVer === v.version}
                >
                  {descargandoVer === v.version ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-4 w-4" />
                  )}
                  Descargar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Panel de decisión */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Decisión de revisión
        </h3>

        {puedeDevolver && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-foreground">
              Marca los campos con observación para devolver al proveedor:
            </p>
            {nuevas.map((n, idx) => (
              <div
                key={idx}
                className="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
              >
                <Select
                  value={n.campo_key}
                  onValueChange={(v) =>
                    setNuevas((arr) =>
                      arr.map((it, i) => (i === idx ? { ...it, campo_key: v } : it)),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Campo observado" />
                  </SelectTrigger>
                  <SelectContent>
                    {campos.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.seccion} — {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={n.comentario}
                  onChange={(e) =>
                    setNuevas((arr) =>
                      arr.map((it, i) =>
                        i === idx ? { ...it, comentario: e.target.value } : it,
                      ),
                    )
                  }
                  placeholder="Comentario para el proveedor…"
                  rows={2}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNuevas((arr) => arr.filter((_, i) => i !== idx))}
                  aria-label="Eliminar observación"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setNuevas((arr) => [...arr, { campo_key: "", comentario: "" }])
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Añadir observación
            </Button>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {puedeReabrir && (
            <Button
              variant="outline"
              onClick={handleReabrir}
              disabled={accion !== "idle"}
            >
              {accion === "reabrir" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reabrir módulo
            </Button>
          )}
          {puedeDevolver && (
            <Button
              variant="outline"
              onClick={handleDevolver}
              disabled={accion !== "idle" || nuevas.length === 0}
            >
              {accion === "devolver" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="mr-2 h-4 w-4" />
              )}
              Devolver con observaciones
            </Button>
          )}
          {puedeAprobar && (
            <Button onClick={handleAprobar} disabled={accion !== "idle"}>
              {accion === "aprobar" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Aprobar módulo
            </Button>
          )}
          {!puedeAprobar && !puedeDevolver && !puedeReabrir && (
            <p className="text-sm text-muted-foreground">
              No hay acciones disponibles para este estado.
            </p>
          )}
        </div>
      </section>

      {/* Historial */}
      {resueltas.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Observaciones resueltas ({resueltas.length})
          </h3>
          <ul className="mt-3 space-y-2">
            {resueltas.map((o) => (
              <li key={o.id} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {o.campo_key}
                </div>
                <p className="mt-1 text-foreground/80">{o.comentario}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}