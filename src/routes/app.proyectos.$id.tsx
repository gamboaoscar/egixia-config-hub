import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  UserMinus,
  UserX,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EstadoPastilla } from "@/components/estado-pastilla";
import { supabase } from "@/integrations/supabase/client";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import { descargarActaPreview } from "@/lib/acta.functions";
import {
  actualizarMiembroEstado,
  desvincularMiembro,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/app/proyectos/$id")({
  component: DetalleProyecto,
});

interface Proyecto {
  id: string;
  nombre: string;
  empresa: string;
  estado: string;
  created_at: string;
}

interface Modulo {
  id: string;
  modulo_key: string;
  estado: string;
  progreso: number;
  fecha_limite: string | null;
  datos: Record<string, unknown>;
  enviado_at: string | null;
  revisado_at: string | null;
}

interface Miembro {
  id: string;
  rol_en_proyecto: "implementador" | "invitado";
  estado: "activo" | "inhabilitado";
  profiles: {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  } | null;
}

interface Acta {
  id: string;
  proyecto_modulo_id: string;
  version: number;
  generada_at: string;
}

interface AuditoriaRow {
  id: string;
  accion: string;
  entidad: string;
  entidad_id: string;
  detalle: Record<string, unknown> | null;
  created_at: string;
}

function DetalleProyecto() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [proy, setProy] = useState<Proyecto | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaRow[]>([]);
  const [descargando, setDescargando] = useState<string | null>(null);

  const actualizar = useServerFn(actualizarMiembroEstado);
  const desvincular = useServerFn(desvincularMiembro);
  const descargarActa = useServerFn(descargarActaPreview);

  const cargar = async () => {
    const [p, m, mem, ac] = await Promise.all([
      supabase.from("proyectos").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("proyecto_modulos")
        .select("id, modulo_key, estado, progreso, fecha_limite, datos, enviado_at, revisado_at")
        .eq("proyecto_id", id)
        .order("modulo_key"),
      supabase
        .from("proyecto_miembros")
        .select("id, rol_en_proyecto, estado, profiles(id, nombre, apellido, email)")
        .eq("proyecto_id", id),
      supabase
        .from("actas")
        .select("id, proyecto_modulo_id, version, generada_at")
        .in(
          "proyecto_modulo_id",
          (
            await supabase
              .from("proyecto_modulos")
              .select("id")
              .eq("proyecto_id", id)
          ).data?.map((x) => x.id) ?? [],
        )
        .order("generada_at", { ascending: false }),
    ]);
    setProy((p.data as Proyecto | null) ?? null);
    setModulos((m.data ?? []) as unknown as Modulo[]);
    setMiembros((mem.data ?? []) as unknown as Miembro[]);
    setActas((ac.data ?? []) as Acta[]);

    // Auditoría: filtrar por detalle->>proyecto_id o entidad_id = id
    const { data: aud } = await supabase
      .from("auditoria")
      .select("id, accion, entidad, entidad_id, detalle, created_at")
      .or(`entidad_id.eq.${id},detalle->>proyecto_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(80);
    setAuditoria((aud ?? []) as unknown as AuditoriaRow[]);

    setLoading(false);
  };

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const actasPorModulo = useMemo(() => {
    const map: Record<string, Acta[]> = {};
    for (const a of actas) {
      (map[a.proyecto_modulo_id] ??= []).push(a);
    }
    return map;
  }, [actas]);

  if (loading) {
    return <div className="mx-auto h-64 max-w-5xl animate-pulse rounded-2xl bg-muted" />;
  }
  if (!proy) throw notFound();

  const invitados = miembros.filter((x) => x.rol_en_proyecto === "invitado");
  const equipo = miembros.filter((x) => x.rol_en_proyecto === "implementador");

  const handleEstado = async (mid: string, estado: "activo" | "inhabilitado") => {
    try {
      await actualizar({ data: { miembroId: mid, estado } });
      toast.success(estado === "activo" ? "Miembro activado." : "Miembro inhabilitado.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    }
  };

  const handleDesvincular = async (mid: string) => {
    if (!confirm("¿Desvincular este miembro del proyecto? La cuenta no se elimina.")) return;
    try {
      await desvincular({ data: { miembroId: mid } });
      toast.success("Miembro desvinculado.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo desvincular.");
    }
  };

  const handleActa = async (mid: string) => {
    setDescargando(mid);
    try {
      const res = await descargarActa({ data: { moduloId: mid } });
      // res esperado: { base64, filename } o url
      const cualquiera = res as { base64?: string; filename?: string; url?: string };
      if (cualquiera.url) {
        window.open(cualquiera.url, "_blank");
      } else if (cualquiera.base64) {
        const blob = await (await fetch(`data:application/pdf;base64,${cualquiera.base64}`)).blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = cualquiera.filename || "acta.pdf";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el acta.");
    } finally {
      setDescargando(null);
    }
  };

  const exportarJson = () => {
    const payload = {
      proyecto: proy,
      modulos,
      miembros: miembros.map((m) => ({
        rol: m.rol_en_proyecto,
        estado: m.estado,
        profile: m.profiles,
      })),
      exportado_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, `${slug(proy.nombre)}.json`);
  };

  const exportarCsv = () => {
    const lineas: string[] = ["Modulo,Estado,Progreso,Campo,Valor"];
    for (const m of modulos) {
      const cat = moduloCatalogo(m.modulo_key);
      const flat = flatten(m.datos);
      if (flat.length === 0) {
        lineas.push(csv([cat.nombre, m.estado, `${m.progreso}%`, "", ""]));
      } else {
        for (const [k, v] of flat) {
          lineas.push(csv([cat.nombre, m.estado, `${m.progreso}%`, k, v]));
        }
      }
    }
    const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${slug(proy.nombre)}.csv`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/app/proyectos">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver a proyectos
        </Link>
      </Button>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{proy.nombre}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {proy.empresa} · creado el{" "}
              {new Date(proy.created_at).toLocaleDateString("es-CO")}
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium capitalize text-primary">
                {proy.estado.replace("_", " ")}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportarJson}>
              <Download className="mr-1 h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCsv}>
              <Download className="mr-1 h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Módulos ({modulos.length})
        </h3>
        <div className="mt-4 grid gap-3">
          {modulos.map((m) => {
            const cat = moduloCatalogo(m.modulo_key);
            const actasM = actasPorModulo[m.id] ?? [];
            return (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <cat.icon className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{cat.nombre}</span>
                        <EstadoPastilla estado={m.estado as never} size="sm" />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Avance {m.progreso}%
                        {m.fecha_limite
                          ? ` · vence ${new Date(m.fecha_limite + "T00:00:00").toLocaleDateString("es-CO")}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/app/modulo/$moduloId" params={{ moduloId: m.id }}>
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Ver / editar
                      </Link>
                    </Button>
                    {actasM.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActa(m.id)}
                        disabled={descargando === m.id}
                      >
                        {descargando === m.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="mr-1 h-4 w-4" />
                        )}
                        Acta v{actasM[0].version}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Miembros */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Miembros
          </h3>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/invitaciones">
              <Mail className="mr-1 h-4 w-4" />
              Invitar
            </Link>
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <MiembrosLista
            titulo="Equipo interno"
            filas={equipo}
            onEstado={handleEstado}
            onDesvincular={handleDesvincular}
          />
          <MiembrosLista
            titulo="Invitados del cliente"
            filas={invitados}
            onEstado={handleEstado}
            onDesvincular={handleDesvincular}
          />
        </div>
      </section>

      {/* Auditoría */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Auditoría reciente ({auditoria.length})
        </h3>
        {auditoria.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sin registros aún.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {auditoria.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-medium text-foreground">{a.accion}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{a.entidad}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("es-CO")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MiembrosLista({
  titulo,
  filas,
  onEstado,
  onDesvincular,
}: {
  titulo: string;
  filas: Miembro[];
  onEstado: (id: string, estado: "activo" | "inhabilitado") => void;
  onDesvincular: (id: string) => void;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo} ({filas.length})
      </h4>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin miembros.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {filas.map((m) => {
            const nombre = m.profiles
              ? `${m.profiles.nombre} ${m.profiles.apellido}`.trim() ||
                m.profiles.email
              : "Usuario";
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
              >
                <div>
                  <div className="font-medium text-foreground">{nombre}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.profiles?.email} ·{" "}
                    {m.estado === "activo" ? (
                      <span className="text-emerald-700">activo</span>
                    ) : (
                      <span className="text-red-700">inhabilitado</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {m.estado === "activo" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEstado(m.id, "inhabilitado")}
                    >
                      <UserX className="mr-1 h-4 w-4" />
                      Inhabilitar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEstado(m.id, "activo")}
                    >
                      <UserCheck className="mr-1 h-4 w-4" />
                      Activar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => onDesvincular(m.id)}
                  >
                    <UserMinus className="mr-1 h-4 w-4" />
                    Desvincular
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function flatten(obj: unknown, prefix = ""): [string, string][] {
  const out: [string, string][] = [];
  if (obj == null) return out;
  if (typeof obj !== "object") {
    out.push([prefix, String(obj)]);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => out.push(...flatten(v, `${prefix}[${i}]`)));
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") out.push(...flatten(v, key));
    else out.push([key, v == null ? "" : String(v)]);
  }
  return out;
}

function csv(fields: string[]): string {
  return fields
    .map((f) => `"${String(f).replace(/"/g, '""').replace(/\n/g, " ")}"`)
    .join(",");
}