import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODULOS_CATALOGO, type ModuloKey } from "@/lib/modulos-catalogo";
import { crearProyecto } from "@/lib/admin.functions";

export const Route = createFileRoute("/app/proyectos/nuevo")({
  component: NuevoProyecto,
});

type Comp =
  | "bloquear"
  | "editable_avisar"
  | "solo_avisar"
  | "extension_implementador";

const COMP: { v: Comp; l: string; d: string }[] = [
  { v: "solo_avisar", l: "Solo avisar", d: "Se muestra un aviso, pero puede seguir editando." },
  { v: "editable_avisar", l: "Editable con aviso", d: "Aviso destacado, edición permitida." },
  { v: "bloquear", l: "Bloquear al vencer", d: "El módulo se bloquea automáticamente." },
  { v: "extension_implementador", l: "Requiere extensión", d: "Solo el implementador puede extender la fecha." },
];

interface ModuloForm {
  activo: boolean;
  fecha_limite: string;
  comportamiento: Comp;
}

function NuevoProyecto() {
  const navigate = useNavigate();
  const crear = useServerFn(crearProyecto);
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [modulos, setModulos] = useState<Record<ModuloKey, ModuloForm>>({
    imagen: { activo: true, fecha_limite: "", comportamiento: "solo_avisar" },
    sociedades: { activo: true, fecha_limite: "", comportamiento: "solo_avisar" },
    seguridad: { activo: false, fecha_limite: "", comportamiento: "solo_avisar" },
  });
  const [saving, setSaving] = useState(false);

  const set = (k: ModuloKey, patch: Partial<ModuloForm>) =>
    setModulos((m) => ({ ...m, [k]: { ...m[k], ...patch } }));

  const submit = async () => {
    if (nombre.trim().length < 2) {
      toast.error("Escribe el nombre del proyecto.");
      return;
    }
    if (empresa.trim().length < 2) {
      toast.error("Indica la empresa del proyecto.");
      return;
    }
    const activos = (Object.keys(modulos) as ModuloKey[]).filter(
      (k) => modulos[k].activo,
    );
    if (activos.length === 0) {
      toast.error("Selecciona al menos un módulo.");
      return;
    }
    const sinFecha = activos.filter((k) => !modulos[k].fecha_limite);
    if (sinFecha.length > 0) {
      const nombres = sinFecha
        .map((k) => MODULOS_CATALOGO[k].nombre)
        .join(", ");
      toast.error(`Define la fecha límite para: ${nombres}.`);
      return;
    }
    const seleccionados = activos.map((k) => ({
      modulo_key: k,
      fecha_limite: modulos[k].fecha_limite,
      comportamiento_vencimiento: modulos[k].comportamiento,
    }));
    setSaving(true);
    try {
      const res = await crear({
        data: { nombre: nombre.trim(), empresa: empresa.trim(), modulos: seleccionados },
      });
      toast.success("Proyecto creado.");
      navigate({ to: "/app/proyectos/$id", params: { id: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/app/proyectos">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a proyectos
        </Link>
      </Button>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Nuevo proyecto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Nombre del proyecto</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Portal Proveedores 2026"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Razón social"
              className="mt-1"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Módulos a asignar
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Marca los módulos, define fecha límite y qué debe pasar al vencer.
          </p>
        </div>

        <div className="space-y-3">
          {(Object.keys(MODULOS_CATALOGO) as ModuloKey[]).map((k) => {
            const cat = MODULOS_CATALOGO[k];
            const m = modulos[k];
            return (
              <div
                key={k}
                className={`rounded-xl border p-4 transition ${
                  m.activo ? "border-primary/40 bg-primary-soft/40" : "border-border bg-background"
                }`}
              >
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={m.activo}
                    onCheckedChange={(v) => set(k, { activo: v === true })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <cat.icon className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{cat.nombre}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {cat.descripcion}
                    </p>
                  </div>
                </label>
                {m.activo && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Fecha límite</Label>
                      <Input
                        type="date"
                        value={m.fecha_limite}
                        onChange={(e) => set(k, { fecha_limite: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Al vencer</Label>
                      <Select
                        value={m.comportamiento}
                        onValueChange={(v) => set(k, { comportamiento: v as Comp })}
                        disabled={!m.fecha_limite}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMP.map((c) => (
                            <SelectItem key={c.v} value={c.v}>
                              {c.l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {COMP.find((c) => c.v === m.comportamiento)?.d}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear proyecto
        </Button>
      </div>
    </div>
  );
}