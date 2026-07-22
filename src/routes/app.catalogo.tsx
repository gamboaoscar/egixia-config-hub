import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CircleHelp,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Lock,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  aplicarPlantillaCatalogo,
  eliminarPlantillaCatalogo,
  guardarOverrideCampo,
  guardarOverrideSeccion,
  guardarPlantillaCatalogo,
  listarPlantillasCatalogo,
} from "@/lib/admin.functions";
import { formatoFechaCortaCO } from "@/lib/fechas";
import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import { firmarUrl } from "@/lib/form-engine/archivo";
import { moduloCatalogo, type ModuloKey } from "@/lib/modulos-catalogo";
import type {
  CampoDefinicion,
  GuiaCampo,
  ImagenGuia,
} from "@/lib/form-engine/tipos";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/catalogo")({ component: CatalogoPage });

interface ProyectoLite { id: string; nombre: string; empresa: string }
interface OverrideRow {
  id: string;
  modulo_key: string;
  campo_key: string;
  activo: boolean;
  label: string | null;
  requerido: boolean | null;
  guia: Partial<GuiaCampo> | null;
  opciones_permitidas: string[] | null;
}
interface OverrideSeccionRow {
  id: string;
  modulo_key: string;
  seccion_key: string;
  habilitada: boolean;
  obligatoria: boolean | null;
}

function CandadoBadge({ mensaje }: { mensaje: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-800">
            <Lock className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent>{mensaje}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CatalogoPage() {
  const { profile } = useAuth();
  const esAdmin = profile?.rol === "admin";
  const [proyectos, setProyectos] = useState<ProyectoLite[]>([]);
  const [proyectoId, setProyectoId] = useState<string>("");
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [ovSecciones, setOvSecciones] = useState<OverrideSeccionRow[]>([]);
  const [datosModulos, setDatosModulos] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<{
    modulo_key: string; campo: CampoDefinicion; ov?: OverrideRow;
  } | null>(null);
  const [editandoAyuda, setEditandoAyuda] = useState<EstadoAyuda | null>(null);
  const [dialogGuardarPlantilla, setDialogGuardarPlantilla] = useState(false);
  const [dialogAplicarPlantilla, setDialogAplicarPlantilla] = useState(false);
  // Set de claves ocupadas mientras se ejecuta una mutación de override
  // (para deshabilitar el control y evitar carreras hasta que `cargar()`
  // refresque el estado). Claves: `campo:<mod>:<key>`, `seccion:<mod>:<key>`,
  // `opciones:<mod>:<key>`.
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const conBusy = async (clave: string, fn: () => Promise<void>) => {
    setBusy((prev) => {
      const n = new Set(prev);
      n.add(clave);
      return n;
    });
    try {
      await fn();
    } finally {
      setBusy((prev) => {
        const n = new Set(prev);
        n.delete(clave);
        return n;
      });
    }
  };
  const guardarCampo = useServerFn(guardarOverrideCampo);
  const guardarSeccion = useServerFn(guardarOverrideSeccion);

  useEffect(() => {
    supabase
      .from("proyectos")
      .select("id, nombre, empresa")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []) as ProyectoLite[];
        setProyectos(rows);
        if (rows[0] && !proyectoId) setProyectoId(rows[0].id);
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cargar = async (pid: string) => {
    const [{ data: ov }, { data: os }, { data: mods }] = await Promise.all([
      supabase
        .from("catalogo_overrides")
        .select("id, modulo_key, campo_key, activo, label, requerido, guia, opciones_permitidas")
        .eq("proyecto_id", pid),
      supabase
        .from("catalogo_overrides_seccion")
        .select("id, modulo_key, seccion_key, habilitada, obligatoria")
        .eq("proyecto_id", pid),
      supabase
        .from("proyecto_modulos")
        .select("modulo_key, datos")
        .eq("proyecto_id", pid),
    ]);
    setOverrides((ov ?? []) as unknown as OverrideRow[]);
    setOvSecciones((os ?? []) as unknown as OverrideSeccionRow[]);
    const mapDatos: Record<string, Record<string, unknown>> = {};
    for (const m of (mods ?? []) as Array<{ modulo_key: string; datos: unknown }>) {
      mapDatos[m.modulo_key] = (m.datos as Record<string, unknown>) ?? {};
    }
    setDatosModulos(mapDatos);
  };

  useEffect(() => {
    if (!proyectoId) return;
    void cargar(proyectoId);
  }, [proyectoId]);

  const ovMap = useMemo(() => {
    const m = new Map<string, OverrideRow>();
    for (const o of overrides) m.set(`${o.modulo_key}:${o.campo_key}`, o);
    return m;
  }, [overrides]);
  const osMap = useMemo(() => {
    const m = new Map<string, OverrideSeccionRow>();
    for (const o of ovSecciones) m.set(`${o.modulo_key}:${o.seccion_key}`, o);
    return m;
  }, [ovSecciones]);

  const modulos: ModuloKey[] = [
    "imagen",
    "sociedades",
    "seguridad",
    "usuarios_internos",
    "matriz_documental",
    "maestros_compras",
    "integracion_erp",
  ];

  const tieneDato = (moduloKey: string, campoKey: string): boolean => {
    const datos = datosModulos[moduloKey] ?? {};
    const v = datos[campoKey];
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number") return !Number.isNaN(v);
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return true;
  };

  const seccionTieneDatos = (moduloKey: string, seccionKey: string): boolean => {
    const def = definicionModulo(moduloKey);
    const sec = def.secciones.find((s) => s.key === seccionKey);
    if (!sec) return false;
    return sec.campos.some((c) => c.tipo !== "info" && tieneDato(moduloKey, c.key));
  };

  const opcionesSeleccionadas = (moduloKey: string, campoKey: string): Set<string> => {
    const v = (datosModulos[moduloKey] ?? {})[campoKey];
    if (Array.isArray(v)) return new Set(v.filter((x) => typeof x === "string") as string[]);
    if (typeof v === "string" && v.length > 0) return new Set([v]);
    return new Set();
  };

  const toggleActivoCampo = async (
    modulo_key: string,
    campo: CampoDefinicion,
    activo: boolean,
  ) => {
    if (!proyectoId) return;
    await conBusy(`campo:${modulo_key}:${campo.key}`, async () => {
      try {
        await guardarCampo({
          data: { proyectoId, moduloKey: modulo_key, campoKey: campo.key, activo },
        });
        toast.success(activo ? "Campo activado." : "Campo desactivado.");
        await cargar(proyectoId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  const toggleSeccion = async (
    modulo_key: string,
    seccion_key: string,
    habilitada: boolean,
  ) => {
    if (!proyectoId) return;
    await conBusy(`seccion:${modulo_key}:${seccion_key}`, async () => {
      try {
        await guardarSeccion({
          data: { proyectoId, moduloKey: modulo_key, seccionKey: seccion_key, habilitada },
        });
        toast.success(habilitada ? "Sección habilitada." : "Sección oculta.");
        await cargar(proyectoId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  const toggleObligatoria = async (
    modulo_key: string,
    seccion_key: string,
    obligatoria: boolean,
  ) => {
    if (!proyectoId) return;
    await conBusy(`seccion:${modulo_key}:${seccion_key}`, async () => {
      try {
        await guardarSeccion({
          data: {
            proyectoId,
            moduloKey: modulo_key,
            seccionKey: seccion_key,
            obligatoria: obligatoria ? null : false,
          },
        });
        toast.success("Configuración guardada.");
        await cargar(proyectoId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  const toggleOpcionPermitida = async (
    modulo_key: string,
    campo: CampoDefinicion,
    valor: string,
    permitida: boolean,
  ) => {
    if (!proyectoId || !campo.opciones) return;
    const todas = campo.opciones.map((o) => o.valor);
    const ov = ovMap.get(`${modulo_key}:${campo.key}`);
    const actual = new Set<string>(ov?.opciones_permitidas ?? todas);
    if (permitida) actual.add(valor);
    else actual.delete(valor);
    const arr = Array.from(actual);
    const enviar = arr.length === todas.length ? null : arr;
    await conBusy(`opciones:${modulo_key}:${campo.key}`, async () => {
      try {
        await guardarCampo({
          data: {
            proyectoId,
            moduloKey: modulo_key,
            campoKey: campo.key,
            opciones_permitidas: enviar,
          },
        });
        toast.success("Opciones actualizadas.");
        await cargar(proyectoId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  };

  if (loading) {
    return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-muted" />;
  }

  const MSG_LOCK = "Contiene información diligenciada — solo un administrador puede modificarlo";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Catálogo de módulos y campos</h2>
        <p className="text-sm text-muted-foreground">
          Parametriza qué secciones, campos y opciones estarán disponibles en
          cada proyecto según el alcance contratado.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label className="sm:w-32">Proyecto</Label>
          <Select value={proyectoId} onValueChange={setProyectoId}>
            <SelectTrigger className="sm:w-96"><SelectValue placeholder="Elige un proyecto" /></SelectTrigger>
            <SelectContent>
              {proyectos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre} — {p.empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={!proyectoId}
              onClick={() => setDialogGuardarPlantilla(true)}
            >
              <Save className="mr-1 h-4 w-4" />
              Guardar como plantilla
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!proyectoId}
              onClick={() => setDialogAplicarPlantilla(true)}
            >
              <LayoutTemplate className="mr-1 h-4 w-4" />
              Aplicar plantilla
            </Button>
          </div>
        </div>
      </section>

      {!proyectoId ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Crea un proyecto para configurar su catálogo.
        </div>
      ) : (
        modulos.map((key) => {
          const def = definicionModulo(key);
          const cat = moduloCatalogo(key);
          return (
            <section key={key} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <header className="mb-4 flex items-start gap-3">
                <cat.icon className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">{cat.nombre}</h3>
                  <p className="text-xs text-muted-foreground">{cat.descripcion}</p>
                </div>
              </header>

              <div className="space-y-5">
                {def.secciones.map((s) => {
                  const os = osMap.get(`${key}:${s.key}`);
                  const habilitada = os?.habilitada ?? true;
                  const obligatoria = (os?.obligatoria ?? null) !== false;
                  const secProtegida = seccionTieneDatos(key, s.key);
                  const seccionLocked = secProtegida && !esAdmin;
                  const seccionBusy = busy.has(`seccion:${key}:${s.key}`);
                  return (
                    <div key={s.key} className="rounded-lg border border-border">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            {s.titulo}
                          </h4>
                          {secProtegida && <CandadoBadge mensaje={MSG_LOCK} />}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`sec-${key}-${s.key}-hab`}
                              checked={habilitada}
                              disabled={(seccionLocked && habilitada) || seccionBusy}
                              onCheckedChange={(v) => toggleSeccion(key, s.key, v)}
                            />
                            <Label htmlFor={`sec-${key}-${s.key}-hab`} className="text-xs">
                              {habilitada ? "Habilitada" : "Oculta"}
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`sec-${key}-${s.key}-obl`}
                              checked={obligatoria}
                              disabled={seccionBusy}
                              onCheckedChange={(v) => toggleObligatoria(key, s.key, v)}
                            />
                            <Label htmlFor={`sec-${key}-${s.key}-obl`} className="text-xs">
                              Obligatoria
                            </Label>
                          </div>
                        </div>
                      </div>
                      <ul className="divide-y divide-border">
                        {s.campos.map((c) => {
                          if (c.tipo === "info") return null;
                          const ov = ovMap.get(`${key}:${c.key}`);
                          const activo = ov?.activo ?? c.activo !== false;
                          const label = ov?.label ?? c.label;
                          const req = ov?.requerido ?? c.requerido ?? false;
                          const campoProtegido = tieneDato(key, c.key);
                          const campoLocked = campoProtegido && !esAdmin;
                          const campoBusy = busy.has(`campo:${key}:${c.key}`);
                          const opcionesBusy = busy.has(`opciones:${key}:${c.key}`);
                          const seleccionadas = opcionesSeleccionadas(key, c.key);
                          const permitidas = new Set<string>(
                            ov?.opciones_permitidas ?? c.opciones?.map((o) => o.valor) ?? [],
                          );
                          return (
                            <li key={c.key} className="p-3 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 font-medium text-foreground">
                                    {label}
                                    {req && <span className="text-red-600">*</span>}
                                    {campoProtegido && <CandadoBadge mensaje={MSG_LOCK} />}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                                      {c.key}
                                    </code>
                                    <span className="ml-2">{c.tipo}</span>
                                    {ov && <span className="ml-2 text-primary">· personalizado</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={activo}
                                      disabled={(campoLocked && activo) || campoBusy}
                                      onCheckedChange={(v) => toggleActivoCampo(key, c, v)}
                                      id={`sw-${key}-${c.key}`}
                                    />
                                    <Label htmlFor={`sw-${key}-${c.key}`} className="text-xs">
                                      {activo ? "Activo" : "Oculto"}
                                    </Label>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditando({ modulo_key: key, campo: c, ov })}
                                  >
                                    <Settings2 className="mr-1 h-4 w-4" />Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Editar ayuda"
                                    onClick={() =>
                                      setEditandoAyuda({
                                        moduloKey: key,
                                        campoKey: c.key,
                                        label,
                                        guiaDefault: c.guia,
                                        guiaOverride: ov?.guia ?? null,
                                      })
                                    }
                                  >
                                    <CircleHelp className="mr-1 h-4 w-4" />Ayuda
                                  </Button>
                                </div>
                              </div>

                              {c.tipo === "tabla" &&
                                (c.columnas ?? []).some(
                                  (col) =>
                                    col.guia ||
                                    ovMap.get(`${key}:${c.key}.${col.key}`)?.guia,
                                ) && (
                                  <div className="mt-3 rounded-md border border-dashed border-border bg-muted/30 p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                      Ayuda por columna
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {(c.columnas ?? [])
                                        .filter(
                                          (col) =>
                                            col.guia ||
                                            ovMap.get(`${key}:${c.key}.${col.key}`)?.guia,
                                        )
                                        .map((col) => {
                                          const ovCol = ovMap.get(
                                            `${key}:${c.key}.${col.key}`,
                                          );
                                          return (
                                            <Button
                                              key={col.key}
                                              size="sm"
                                              variant="outline"
                                              title={`Editar ayuda de la columna ${col.label}`}
                                              onClick={() =>
                                                setEditandoAyuda({
                                                  moduloKey: key,
                                                  campoKey: `${c.key}.${col.key}`,
                                                  label: col.label,
                                                  guiaDefault: col.guia,
                                                  guiaOverride: ovCol?.guia ?? null,
                                                })
                                              }
                                            >
                                              <CircleHelp className="mr-1 h-3.5 w-3.5" />
                                              {col.label}
                                              {ovCol?.guia && (
                                                <span className="ml-1 text-primary">
                                                  · personalizada
                                                </span>
                                              )}
                                            </Button>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}

                              {c.tipo === "checkbox_multiple" && c.opciones && (
                                <div className="mt-3 grid gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 sm:grid-cols-2">
                                  <div className="col-span-full text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Opciones disponibles en este proyecto
                                  </div>
                                  {c.opciones.map((op) => {
                                    const marcada = permitidas.has(op.valor);
                                    const opProtegida = seleccionadas.has(op.valor);
                                    const opLocked = opProtegida && !esAdmin && marcada;
                                    return (
                                      <label
                                        key={op.valor}
                                        className="flex items-start gap-2 text-xs text-foreground"
                                      >
                                        <Checkbox
                                          checked={marcada}
                                          disabled={opLocked || opcionesBusy}
                                          onCheckedChange={(v) =>
                                            toggleOpcionPermitida(key, c, op.valor, v === true)
                                          }
                                        />
                                        <span className="min-w-0">
                                          <span className="flex items-center gap-1">
                                            {op.etiqueta}
                                            {opProtegida && (
                                              <CandadoBadge mensaje={MSG_LOCK} />
                                            )}
                                          </span>
                                          {op.descripcion && (
                                            <span className="block text-muted-foreground">
                                              {op.descripcion}
                                            </span>
                                          )}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      <EditorCampoDialog
        open={!!editando}
        proyectoId={proyectoId}
        estado={editando}
        onClose={() => setEditando(null)}
        onSaved={() => { setEditando(null); void cargar(proyectoId); }}
      />

      <EditorAyudaDialog
        open={!!editandoAyuda}
        proyectoId={proyectoId}
        estado={editandoAyuda}
        onClose={() => setEditandoAyuda(null)}
        onSaved={() => { setEditandoAyuda(null); void cargar(proyectoId); }}
      />

      <GuardarPlantillaDialog
        open={dialogGuardarPlantilla}
        proyectoId={proyectoId}
        onClose={() => setDialogGuardarPlantilla(false)}
      />

      <AplicarPlantillaDialog
        open={dialogAplicarPlantilla}
        proyectoId={proyectoId}
        esAdmin={esAdmin}
        onClose={() => setDialogAplicarPlantilla(false)}
        onApplied={() => {
          setDialogAplicarPlantilla(false);
          void cargar(proyectoId);
        }}
      />
    </div>
  );
}

// ---------- Plantillas de parametrización ---------------------------------

function GuardarPlantillaDialog({
  open, proyectoId, onClose,
}: {
  open: boolean;
  proyectoId: string;
  onClose: () => void;
}) {
  const guardar = useServerFn(guardarPlantillaCatalogo);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre("");
      setDescripcion("");
    }
  }, [open]);

  const submit = async () => {
    if (nombre.trim().length < 2) {
      toast.error("Escribe un nombre para la plantilla.");
      return;
    }
    setBusy(true);
    try {
      await guardar({
        data: {
          proyectoId,
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
        },
      });
      toast.success("Plantilla guardada.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la plantilla.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar como plantilla</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Guarda la parametrización actual del proyecto (secciones, campos,
            opciones y guías de ayuda) para reutilizarla en otros proyectos.
          </p>
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input
              value={nombre}
              maxLength={120}
              placeholder="Ej.: Alcance estándar Alimentos y Bebidas"
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Descripción (opcional)</Label>
            <Textarea
              rows={3}
              value={descripcion}
              maxLength={500}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PlantillaLite {
  id: string;
  nombre: string;
  descripcion: string | null;
  created_at: string;
  creado_por_nombre: string | null;
}

function AplicarPlantillaDialog({
  open, proyectoId, esAdmin, onClose, onApplied,
}: {
  open: boolean;
  proyectoId: string;
  esAdmin: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const listar = useServerFn(listarPlantillasCatalogo);
  const aplicar = useServerFn(aplicarPlantillaCatalogo);
  const eliminar = useServerFn(eliminarPlantillaCatalogo);
  const [plantillas, setPlantillas] = useState<PlantillaLite[]>([]);
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const cargarLista = async () => {
    setCargando(true);
    try {
      const rows = await listar();
      setPlantillas(rows as PlantillaLite[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las plantillas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSeleccion("");
      void cargarLista();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const borrar = async (id: string) => {
    try {
      await eliminar({ data: { plantillaId: id } });
      toast.success("Plantilla eliminada.");
      if (seleccion === id) setSeleccion("");
      await cargarLista();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  const submit = async () => {
    if (!seleccion) return;
    setBusy(true);
    try {
      const r = await aplicar({
        data: { plantillaId: seleccion, proyectoId },
      });
      toast.success(
        `Aplicada: ${r.aplicados} ajustes, ${r.omitidos} omitidos por protección`,
      );
      onApplied();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo aplicar la plantilla.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aplicar plantilla</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Los ajustes protegidos por datos ya diligenciados no se
            sobreescriben.
          </p>
          {cargando ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          ) : plantillas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Todavía no hay plantillas guardadas.
            </p>
          ) : (
            <ul className="space-y-2">
              {plantillas.map((p) => (
                <li key={p.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSeleccion(p.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSeleccion(p.id)}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                      seleccion === p.id
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {p.nombre}
                      </div>
                      {p.descripcion && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {p.descripcion}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatoFechaCortaCO(p.created_at)}
                        {p.creado_por_nombre ? ` · ${p.creado_por_nombre}` : ""}
                      </div>
                    </div>
                    {esAdmin && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Eliminar plantilla ${p.nombre}`}
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          void borrar(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !seleccion}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Aplicar a este proyecto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditorCampoDialog({
  open, proyectoId, estado, onClose, onSaved,
}: {
  open: boolean;
  proyectoId: string;
  estado: { modulo_key: string; campo: CampoDefinicion; ov?: OverrideRow } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const guardar = useServerFn(guardarOverrideCampo);
  const [label, setLabel] = useState("");
  const [requerido, setRequerido] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!estado) return;
    setLabel(estado.ov?.label ?? estado.campo.label ?? "");
    setRequerido(estado.ov?.requerido ?? estado.campo.requerido ?? false);
  }, [estado]);

  if (!estado) return null;

  // La guía se edita en su propio diálogo ("Ayuda"); aquí no se envía
  // `guia` para no sobreescribir la guía enriquecida (título + imágenes).
  const submit = async () => {
    setBusy(true);
    try {
      await guardar({
        data: {
          proyectoId,
          moduloKey: estado.modulo_key,
          campoKey: estado.campo.key,
          label: label.trim() || null,
          requerido,
        },
      });
      toast.success("Cambios guardados.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar campo <code className="text-sm">{estado.campo.key}</code></DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Etiqueta</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="req" checked={requerido} onCheckedChange={setRequerido} />
            <Label htmlFor="req">Campo obligatorio</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            La guía de ayuda (textos e imágenes) se edita con el botón{" "}
            <span className="font-medium">Ayuda</span> del campo.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Editor de ayuda enriquecida (título, textos e imágenes) ------

interface EstadoAyuda {
  moduloKey: string;
  /** Clave del campo, o `"{campoKey}.{columnaKey}"` para columnas de tabla. */
  campoKey: string;
  label: string;
  guiaDefault?: GuiaCampo;
  guiaOverride?: Partial<GuiaCampo> | null;
}

const AYUDA_MAX_IMAGENES = 3;
const AYUDA_MAX_MB = 2;
const AYUDA_TIPOS = ["image/png", "image/jpeg"];

function slugArchivo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function EditorAyudaDialog({
  open, proyectoId, estado, onClose, onSaved,
}: {
  open: boolean;
  proyectoId: string;
  estado: EstadoAyuda | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const guardar = useServerFn(guardarOverrideCampo);
  const [titulo, setTitulo] = useState("");
  const [que, setQue] = useState("");
  const [formato, setFormato] = useState("");
  const [tamano, setTamano] = useState("");
  const [imagenes, setImagenes] = useState<ImagenGuia[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [busy, setBusy] = useState(false);

  const firmarThumb = async (img: ImagenGuia) => {
    const url = await firmarUrl(img.bucket, img.storagePath);
    setThumbs((prev) => ({ ...prev, [img.storagePath]: url }));
  };

  useEffect(() => {
    if (!estado) return;
    // Valores iniciales = guía efectiva actual (override si existe,
    // si no la default del módulo).
    const efectiva: Partial<GuiaCampo> = {
      ...(estado.guiaDefault ?? {}),
      ...(estado.guiaOverride ?? {}),
    };
    setTitulo(efectiva.titulo ?? "");
    setQue(efectiva.que ?? "");
    setFormato(efectiva.formato ?? "");
    setTamano(efectiva.tamano ?? "");
    const imgs = (efectiva.imagenes ?? []).filter(
      (i) => !!i && !!i.bucket && !!i.storagePath,
    );
    setImagenes(imgs);
    setThumbs({});
    for (const img of imgs) void firmarThumb(img);
  }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!estado) return null;

  const subir = async (file: File) => {
    if (imagenes.length >= AYUDA_MAX_IMAGENES) {
      toast.error(`Máximo ${AYUDA_MAX_IMAGENES} imágenes por campo.`);
      return;
    }
    if (!AYUDA_TIPOS.includes(file.type.toLowerCase())) {
      toast.error("Solo se permiten imágenes PNG o JPG.");
      return;
    }
    if (file.size > AYUDA_MAX_MB * 1024 * 1024) {
      toast.error(`La imagen supera el máximo de ${AYUDA_MAX_MB} MB.`);
      return;
    }
    setSubiendo(true);
    try {
      const base = slugArchivo(file.name) || "imagen";
      const storagePath = `${proyectoId}/${estado.moduloKey}/${estado.campoKey}/${Date.now()}-${base}`;
      const { error } = await supabase.storage
        .from("ayudas")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      const img: ImagenGuia = {
        bucket: "ayudas",
        storagePath,
        nombre: file.name,
        caption: "",
      };
      setImagenes((prev) => [...prev, img]);
      void firmarThumb(img);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  };

  // Quitar solo remueve la referencia de la guía; el binario en Storage
  // no se borra (puede estar referenciado por versiones previas).
  const quitar = (storagePath: string) =>
    setImagenes((prev) => prev.filter((i) => i.storagePath !== storagePath));

  const setCaption = (storagePath: string, caption: string) =>
    setImagenes((prev) =>
      prev.map((i) => (i.storagePath === storagePath ? { ...i, caption } : i)),
    );

  const submit = async () => {
    setBusy(true);
    try {
      const imgs = imagenes.map((i) => ({
        bucket: i.bucket,
        storagePath: i.storagePath,
        nombre: i.nombre || undefined,
        caption: i.caption?.trim() || undefined,
      }));
      const hayContenido =
        titulo.trim() || que.trim() || formato.trim() || tamano.trim() ||
        imgs.length > 0;
      await guardar({
        data: {
          proyectoId,
          moduloKey: estado.moduloKey,
          campoKey: estado.campoKey,
          guia: hayContenido
            ? {
                titulo: titulo.trim(),
                que: que.trim(),
                formato: formato.trim(),
                tamano: tamano.trim(),
                imagenes: imgs,
              }
            : null,
        },
      });
      toast.success("Ayuda guardada.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Editar ayuda — {estado.label}{" "}
            <code className="text-sm">{estado.campoKey}</code>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Título del popup</Label>
            <Input
              value={titulo}
              maxLength={200}
              placeholder={estado.label}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Qué es / qué debe ingresar</Label>
            <Textarea rows={3} value={que} maxLength={500} onChange={(e) => setQue(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Formato esperado</Label>
              <Input value={formato} maxLength={200} onChange={(e) => setFormato(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tamaño / recomendación</Label>
              <Input value={tamano} maxLength={200} onChange={(e) => setTamano(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Imágenes de guía (hasta {AYUDA_MAX_IMAGENES}, PNG/JPG, máx {AYUDA_MAX_MB} MB c/u)</Label>
            {imagenes.length > 0 && (
              <ul className="space-y-2">
                {imagenes.map((img) => {
                  const thumb = thumbs[img.storagePath];
                  return (
                    <li
                      key={img.storagePath}
                      className="flex items-start gap-3 rounded-lg border border-border p-2"
                    >
                      {thumb === undefined ? (
                        <div className="h-16 w-24 shrink-0 animate-pulse rounded-md bg-muted" />
                      ) : thumb ? (
                        <img
                          src={thumb}
                          alt={img.nombre ?? "Imagen de ayuda"}
                          className="h-16 w-24 shrink-0 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                          Sin vista previa
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        {img.nombre && (
                          <div className="truncate text-xs text-muted-foreground">
                            {img.nombre}
                          </div>
                        )}
                        <Input
                          value={img.caption ?? ""}
                          maxLength={300}
                          placeholder="Caption (se muestra debajo de la imagen)"
                          onChange={(e) => setCaption(img.storagePath, e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Quitar imagen"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
                        onClick={() => quitar(img.storagePath)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {imagenes.length < AYUDA_MAX_IMAGENES && (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                {subiendo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {subiendo ? "Subiendo..." : "Subir imagen"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  className="sr-only"
                  disabled={subiendo}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void subir(f);
                  }}
                />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy || subiendo}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy || subiendo}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
