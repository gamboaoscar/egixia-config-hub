import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/auditoria")({ component: AuditoriaPage });

interface Row {
  id: string;
  actor_id: string | null;
  accion: string;
  entidad: string;
  entidad_id: string;
  detalle: Record<string, unknown> | null;
  created_at: string;
  profiles?: { nombre: string; apellido: string; email: string } | null;
}

function AuditoriaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [entidadFiltro, setEntidadFiltro] = useState<string>("todas");

  const cargar = async () => {
    setLoading(true);
    // No hay una FK declarada entre `auditoria.actor_id` y `profiles.id`
    // (ambas apuntan a `auth.users`), así que PostgREST no permite hacer
    // embed en una sola consulta. Traemos los registros y hacemos la
    // correspondencia con los perfiles en el cliente.
    const { data: auditoria } = await supabase
      .from("auditoria")
      .select("id, actor_id, accion, entidad, entidad_id, detalle, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    const base = (auditoria ?? []) as Array<Omit<Row, "profiles">>;
    const ids = Array.from(
      new Set(base.map((r) => r.actor_id).filter((v): v is string => !!v)),
    );
    let mapa: Record<string, Row["profiles"]> = {};
    if (ids.length > 0) {
      const { data: perfiles } = await supabase
        .from("profiles")
        .select("id, nombre, apellido, email")
        .in("id", ids);
      mapa = Object.fromEntries(
        (perfiles ?? []).map((p) => [
          p.id,
          { nombre: p.nombre ?? "", apellido: p.apellido ?? "", email: p.email ?? "" },
        ]),
      );
    }
    setRows(
      base.map((r) => ({
        ...r,
        profiles: r.actor_id ? (mapa[r.actor_id] ?? null) : null,
      })),
    );
    setLoading(false);
  };
  useEffect(() => { void cargar(); }, []);

  const entidades = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entidad))).sort(),
    [rows],
  );

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (entidadFiltro !== "todas" && r.entidad !== entidadFiltro) return false;
      if (!term) return true;
      return (
        r.accion.toLowerCase().includes(term) ||
        r.entidad.toLowerCase().includes(term) ||
        r.entidad_id.toLowerCase().includes(term) ||
        (r.profiles?.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [rows, q, entidadFiltro]);

  const exportarCsv = () => {
    const encabezado = ["fecha", "actor", "accion", "entidad", "entidad_id", "detalle"];
    const lineas = [encabezado.join(",")];
    for (const r of filtradas) {
      const actor = r.profiles
        ? `${r.profiles.nombre} ${r.profiles.apellido}`.trim() || r.profiles.email
        : (r.actor_id ?? "sistema");
      lineas.push([
        r.created_at,
        actor,
        r.accion,
        r.entidad,
        r.entidad_id,
        JSON.stringify(r.detalle ?? {}),
      ].map(csvCell).join(","));
    }
    const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Auditoría global</h2>
            <p className="text-sm text-muted-foreground">
              Histórico de acciones del sistema. Se muestran las 1.000 más recientes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={filtradas.length === 0}>
            <Download className="mr-1 h-4 w-4" />Exportar CSV
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por acción, entidad, id o usuario…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={entidadFiltro} onValueChange={setEntidadFiltro}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las entidades</SelectItem>
              {entidades.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Cargando…
          </div>
        ) : filtradas.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Sin registros con los filtros actuales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Acción</th>
                  <th className="px-3 py-2 text-left">Entidad</th>
                  <th className="px-3 py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtradas.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-2">
                      {r.profiles
                        ? `${r.profiles.nombre} ${r.profiles.apellido}`.trim() || r.profiles.email
                        : <span className="text-muted-foreground italic">sistema</span>}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.accion}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div>{r.entidad}</div>
                      <div className="font-mono opacity-60">{r.entidad_id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <pre className="max-w-md truncate font-mono text-[11px] text-muted-foreground">
                        {JSON.stringify(r.detalle ?? {})}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
