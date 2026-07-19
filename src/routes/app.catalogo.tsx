import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Settings2 } from "lucide-react";
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
  guardarOverrideCampo,
  guardarOverrideSeccion,
} from "@/lib/admin.functions";
import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import { moduloCatalogo, type ModuloKey } from "@/lib/modulos-catalogo";
import type { CampoDefinicion } from "@/lib/form-engine/tipos";
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
  guia: { que?: string; formato?: string; tamano?: string } | null;
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

  const modulos: ModuloKey[] = ["imagen", "sociedades", "seguridad"];

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
                              disabled={seccionLocked && habilitada}
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
                                      disabled={campoLocked && activo}
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
                                </div>
                              </div>

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
                                          disabled={opLocked}
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
    </div>
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
  const [guiaQue, setGuiaQue] = useState("");
  const [guiaFormato, setGuiaFormato] = useState("");
  const [guiaTamano, setGuiaTamano] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!estado) return;
    setLabel(estado.ov?.label ?? estado.campo.label ?? "");
    setRequerido(estado.ov?.requerido ?? estado.campo.requerido ?? false);
    setGuiaQue(estado.ov?.guia?.que ?? estado.campo.guia?.que ?? "");
    setGuiaFormato(estado.ov?.guia?.formato ?? estado.campo.guia?.formato ?? "");
    setGuiaTamano(estado.ov?.guia?.tamano ?? estado.campo.guia?.tamano ?? "");
  }, [estado]);

  if (!estado) return null;

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
          guia: (guiaQue || guiaFormato || guiaTamano)
            ? { que: guiaQue, formato: guiaFormato || undefined, tamano: guiaTamano || undefined }
            : null,
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
          <div className="space-y-1">
            <Label>Guía — "¿qué debo ingresar?"</Label>
            <Textarea rows={2} value={guiaQue} onChange={(e) => setGuiaQue(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Formato esperado</Label>
              <Input value={guiaFormato} onChange={(e) => setGuiaFormato(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tamaño / medida</Label>
              <Input value={guiaTamano} onChange={(e) => setGuiaTamano(e.target.value)} />
            </div>
          </div>
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
