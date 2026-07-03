import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/admin-only";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { guardarOverrideCampo } from "@/lib/admin.functions";
import { definicionModulo } from "@/lib/form-engine/modulo-ejemplo";
import { moduloCatalogo, type ModuloKey } from "@/lib/modulos-catalogo";
import type { CampoDefinicion } from "@/lib/form-engine/tipos";

export const Route = createFileRoute("/app/catalogo")({ component: CatalogoGuarded });

function CatalogoGuarded() {
  return (
    <AdminOnly>
      <CatalogoPage />
    </AdminOnly>
  );
}

interface ProyectoLite { id: string; nombre: string; empresa: string }
interface OverrideRow {
  id: string;
  modulo_key: string;
  campo_key: string;
  activo: boolean;
  label: string | null;
  requerido: boolean | null;
  guia: { que?: string; formato?: string; tamano?: string } | null;
}

function CatalogoPage() {
  const [proyectos, setProyectos] = useState<ProyectoLite[]>([]);
  const [proyectoId, setProyectoId] = useState<string>("");
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<{
    modulo_key: string; campo: CampoDefinicion; ov?: OverrideRow;
  } | null>(null);
  const guardar = useServerFn(guardarOverrideCampo);

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

  const cargarOverrides = async (pid: string) => {
    const { data } = await supabase
      .from("catalogo_overrides")
      .select("id, modulo_key, campo_key, activo, label, requerido, guia")
      .eq("proyecto_id", pid);
    setOverrides((data ?? []) as unknown as OverrideRow[]);
  };

  useEffect(() => {
    if (!proyectoId) return;
    void cargarOverrides(proyectoId);
  }, [proyectoId]);

  const ovMap = useMemo(() => {
    const m = new Map<string, OverrideRow>();
    for (const o of overrides) m.set(`${o.modulo_key}:${o.campo_key}`, o);
    return m;
  }, [overrides]);

  const modulos: ModuloKey[] = ["imagen", "sociedades", "seguridad"];

  const toggleActivo = async (
    modulo_key: string,
    campo: CampoDefinicion,
    activo: boolean,
  ) => {
    if (!proyectoId) return;
    try {
      await guardar({
        data: {
          proyectoId, moduloKey: modulo_key, campoKey: campo.key, activo,
        },
      });
      toast.success(activo ? "Campo activado." : "Campo desactivado.");
      await cargarOverrides(proyectoId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };

  if (loading) {
    return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-muted" />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Catálogo de módulos y campos</h2>
        <p className="text-sm text-muted-foreground">
          Ajusta qué campos ve el invitado en cada proyecto. Los campos desactivados
          no se muestran y no cuentan para el porcentaje de avance.
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

              <div className="space-y-4">
                {def.secciones.map((s) => (
                  <div key={s.key}>
                    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {s.titulo}
                    </h4>
                    <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                      {s.campos.map((c) => {
                        if (c.tipo === "info") return null;
                        const ov = ovMap.get(`${key}:${c.key}`);
                        const activo = ov?.activo ?? c.activo !== false;
                        const label = ov?.label ?? c.label;
                        const req = ov?.requerido ?? c.requerido ?? false;
                        return (
                          <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">
                                {label}
                                {req && <span className="ml-1 text-red-600">*</span>}
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
                                  onCheckedChange={(v) => toggleActivo(key, c, v)}
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
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
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
        onSaved={() => { setEditando(null); void cargarOverrides(proyectoId); }}
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
