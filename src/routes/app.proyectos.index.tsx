import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, FolderKanban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ControlesPaginacion,
  usePaginacion,
} from "@/components/ui/paginacion";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/proyectos/")({
  component: ProyectosLista,
});

interface Fila {
  id: string;
  nombre: string;
  empresa: string;
  estado: string;
  created_at: string;
  proyecto_modulos: { fecha_limite: string | null; estado: string; progreso: number }[];
}

const ESTADOS = [
  { v: "all", l: "Todos los estados" },
  { v: "nuevo", l: "Nuevo" },
  { v: "en_proceso", l: "En proceso" },
  { v: "en_revision", l: "En revisión" },
  { v: "completado", l: "Completado" },
  { v: "cerrado", l: "Cerrado" },
];

const VENCE = [
  { v: "all", l: "Cualquier vencimiento" },
  { v: "atrasado", l: "Atrasado" },
  { v: "7", l: "Próximos 7 días" },
  { v: "30", l: "Próximos 30 días" },
  { v: "sin", l: "Sin fecha límite" },
];

function ProyectosLista() {
  const [rows, setRows] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("all");
  const [empresa, setEmpresa] = useState("all");
  const [vence, setVence] = useState("all");

  useEffect(() => {
    supabase
      .from("proyectos")
      .select(
        "id, nombre, empresa, estado, created_at, proyecto_modulos(fecha_limite, estado, progreso)",
      )
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("[proyectos]", error);
        setRows((data ?? []) as unknown as Fila[]);
        setLoading(false);
      });
  }, []);

  const empresas = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.empresa) set.add(r.empresa);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const proximaFecha = (r: Fila) => {
    const fechas = r.proyecto_modulos
      .map((m) => m.fecha_limite)
      .filter(Boolean) as string[];
    if (fechas.length === 0) return null;
    return fechas.sort()[0];
  };

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return rows.filter((r) => {
      if (estado !== "all" && r.estado !== estado) return false;
      if (empresa !== "all" && r.empresa !== empresa) return false;
      if (vence !== "all") {
        const pf = proximaFecha(r);
        if (vence === "sin") {
          if (pf) return false;
        } else if (!pf) {
          return false;
        } else {
          const d = new Date(pf + "T00:00:00");
          const dias = Math.round((d.getTime() - hoy.getTime()) / 86400000);
          if (vence === "atrasado" && dias >= 0) return false;
          if (vence === "7" && (dias < 0 || dias > 7)) return false;
          if (vence === "30" && (dias < 0 || dias > 30)) return false;
        }
      }
      if (term) {
        const hay = `${r.nombre} ${r.empresa}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, estado, empresa, vence]);

  const avanceProm = (r: Fila) => {
    if (r.proyecto_modulos.length === 0) return 0;
    return Math.round(
      r.proyecto_modulos.reduce((a, m) => a + m.progreso, 0) /
        r.proyecto_modulos.length,
    );
  };

  const pag = usePaginacion(filtradas, "proyectos");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Proyectos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} proyecto(s) en total.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/proyectos/nuevo">
            <Plus className="mr-1 h-4 w-4" />
            Nuevo proyecto
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o empresa…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((e) => (
              <SelectItem key={e.v} value={e.v}>
                {e.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={empresa} onValueChange={setEmpresa}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Todas las empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {empresas.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={vence} onValueChange={setVence}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VENCE.map((v) => (
              <SelectItem key={v.v} value={v.v}>
                {v.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            No hay proyectos que coincidan con los filtros.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pag.itemsPagina.map((r) => {
            const pf = proximaFecha(r);
            const avance = avanceProm(r);
            return (
              <Link
                key={r.id}
                to="/app/proyectos/$id"
                params={{ id: r.id }}
                className="group grid grid-cols-1 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                    {r.nombre}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.empresa} · {r.proyecto_modulos.length} módulos
                  </p>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Estado
                  </div>
                  <div className="text-sm capitalize text-foreground">
                    {r.estado.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Próxima fecha
                  </div>
                  <div className="text-sm text-foreground">
                    {pf ? new Date(pf + "T00:00:00").toLocaleDateString("es-CO") : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Avance
                  </div>
                  <div className="text-sm font-semibold text-primary">{avance}%</div>
                </div>
              </Link>
            );
          })}
          <ControlesPaginacion {...pag} />
        </div>
      )}
    </div>
  );
}