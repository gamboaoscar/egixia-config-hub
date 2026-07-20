import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  UserMinus,
  UserX,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EstadoPastilla } from "@/components/estado-pastilla";
import { supabase } from "@/integrations/supabase/client";
import { moduloCatalogo } from "@/lib/modulos-catalogo";
import { descargarActaFirmada } from "@/lib/acta.functions";
import { descargarPdfBlob } from "@/lib/acta/abrir-pdf";
import {
  actualizarMiembroEstado,
  desvincularMiembro,
  eliminarProyecto,
  listarInvitaciones,
  reenviarInvitacion,
  revocarInvitacion,
} from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { formatoFechaCortaCO, formatoFechaHoraCO, formatoFechaPlanaCortaCO } from "@/lib/fechas";

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
  updated_at: string;
  updated_por: string | null;
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

interface InvitacionProy {
  id: string;
  email: string;
  rol_invitado: "implementador" | "invitado";
  estado: "pendiente" | "aceptada" | "revocada" | "expirada";
  expira_at: string;
  created_at: string;
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
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [invitaciones, setInvitaciones] = useState<InvitacionProy[]>([]);
  const [invAction, setInvAction] = useState<string | null>(null);
  // M8: id de la mutación en vuelo (miembro o "eliminar-proyecto") para
  // deshabilitar los botones y evitar dobles envíos.
  const [mutando, setMutando] = useState<string | null>(null);

  const actualizar = useServerFn(actualizarMiembroEstado);
  const desvincular = useServerFn(desvincularMiembro);
  const descargarActa = useServerFn(descargarActaFirmada);
  const remove = useServerFn(eliminarProyecto);
  const listarInv = useServerFn(listarInvitaciones);
  const reenviarInv = useServerFn(reenviarInvitacion);
  const revocarInv = useServerFn(revocarInvitacion);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleEliminarProyecto = async () => {
    if (!proy) return;
    if (!confirm(
      `Eliminar el proyecto "${proy.nombre}"? Esta acción borra sus módulos, ` +
      `observaciones y actas. No se puede deshacer.`,
    )) return;
    setMutando("eliminar-proyecto");
    try {
      await remove({ data: { proyectoId: proy.id } });
      toast.success("Proyecto eliminado.");
      navigate({ to: "/app/proyectos" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setMutando(null);
    }
  };

  const cargar = async () => {
    const [p, m, mem, ac] = await Promise.all([
      supabase.from("proyectos").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("proyecto_modulos")
        .select(
          "id, modulo_key, estado, progreso, fecha_limite, datos, enviado_at, revisado_at, updated_at, updated_por",
        )
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

    // Resolver nombres de autores (updated_por distintos) en una sola consulta.
    const ids = Array.from(
      new Set(
        ((m.data ?? []) as unknown as Modulo[])
          .map((x) => x.updated_por)
          .filter((v): v is string => !!v),
      ),
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, apellido, email")
        .in("id", ids);
      const map: Record<string, string> = {};
      for (const p of profs ?? []) {
        const n = `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim();
        map[p.id] = n || p.email || "Usuario";
      }
      setAutores(map);
    } else {
      setAutores({});
    }

    // Auditoría: filtrar por detalle->>proyecto_id o entidad_id = id
    const { data: aud } = await supabase
      .from("auditoria")
      .select("id, accion, entidad, entidad_id, detalle, created_at")
      .or(`entidad_id.eq.${id},detalle->>proyecto_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(80);
    setAuditoria((aud ?? []) as unknown as AuditoriaRow[]);

    try {
      const inv = await listarInv({ data: { proyectoId: id } });
      setInvitaciones(inv as unknown as InvitacionProy[]);
    } catch {
      setInvitaciones([]);
    }

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
    setMutando(mid);
    try {
      await actualizar({ data: { miembroId: mid, estado } });
      toast.success(estado === "activo" ? "Miembro activado." : "Miembro inhabilitado.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setMutando(null);
    }
  };

  const handleDesvincular = async (mid: string) => {
    if (!confirm("¿Desvincular este miembro del proyecto? La cuenta no se elimina.")) return;
    setMutando(mid);
    try {
      await desvincular({ data: { miembroId: mid } });
      toast.success("Miembro desvinculado.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo desvincular.");
    } finally {
      setMutando(null);
    }
  };

  const handleActa = async (mid: string) => {
    setDescargando(mid);
    try {
      const res = await descargarActa({ data: { moduloId: mid } });
      if (!res.base64) {
        toast.error("Aún no hay acta persistida para este módulo.");
        return;
      }
      descargarPdfBlob(res.base64, res.filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el acta.");
    } finally {
      setDescargando(null);
    }
  };

  const handleReenviarInv = async (invId: string) => {
    setInvAction(invId);
    try {
      const res = await reenviarInv({ data: { id: invId } });
      if (res.correoEnviado) toast.success("Invitación reenviada.");
      else
        toast.error(
          `Se generó un nuevo enlace, pero el correo NO pudo enviarse: ${res.correoError ?? "motivo desconocido"}.`,
        );
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reenviar.");
    } finally {
      setInvAction(null);
    }
  };

  const handleRevocarInv = async (invId: string) => {
    if (!confirm("¿Revocar esta invitación?")) return;
    setInvAction(invId);
    try {
      await revocarInv({ data: { id: invId } });
      toast.success("Invitación revocada.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo revocar.");
    } finally {
      setInvAction(null);
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
              {formatoFechaCortaCO(proy.created_at)}
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
            {profile?.rol === "admin" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={handleEliminarProyecto}
                disabled={mutando === "eliminar-proyecto"}
              >
                {mutando === "eliminar-proyecto" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-4 w-4" />
                )}
                Eliminar
              </Button>
            )}
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
                          ? ` · vence ${formatoFechaPlanaCortaCO(m.fecha_limite)}`
                          : ""}
                      </p>
                      {(m.progreso > 0 || m.estado !== "sin_iniciar") && m.updated_at && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Última actualización: {formatoFechaHoraCO(m.updated_at)}
                          {m.updated_por && autores[m.updated_por]
                            ? ` · ${autores[m.updated_por]}`
                            : ""}
                        </p>
                      )}
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
                        Descargar acta v{actasM[0].version}
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
            busyId={mutando}
            onEstado={handleEstado}
            onDesvincular={handleDesvincular}
          />
          <MiembrosLista
            titulo="Invitados del cliente"
            filas={invitados}
            busyId={mutando}
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
      </section>

      {/* Invitaciones del proyecto */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Invitaciones del proyecto ({invitaciones.length})
          </h3>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/invitaciones">
              <Mail className="mr-1 h-4 w-4" />
              Nueva invitación
            </Link>
          </Button>
        </div>
        {invitaciones.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay invitaciones registradas para este proyecto.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {invitaciones.map((r) => {
              const vencida = new Date(r.expira_at).getTime() < Date.now();
              const estadoEfectivo =
                r.estado === "pendiente" && vencida ? "expirada" : r.estado;
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {r.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.rol_invitado} · invitada el{" "}
                      {formatoFechaHoraCO(r.created_at)} · expira{" "}
                      {formatoFechaHoraCO(r.expira_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        estadoEfectivo === "aceptada"
                          ? "bg-emerald-100 text-emerald-700"
                          : estadoEfectivo === "revocada"
                            ? "bg-red-100 text-red-700"
                            : estadoEfectivo === "expirada"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-primary-soft text-primary"
                      }`}
                    >
                      {estadoEfectivo}
                    </span>
                    {r.estado === "pendiente" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReenviarInv(r.id)}
                          disabled={invAction === r.id}
                        >
                          {invAction === r.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1 h-3 w-3" />
                          )}
                          Reenviar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => handleRevocarInv(r.id)}
                          disabled={invAction === r.id}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Revocar
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* (Auditoría continúa abajo) */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Registro de auditoría
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
                  {formatoFechaHoraCO(a.created_at)}
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
  busyId,
  onEstado,
  onDesvincular,
}: {
  titulo: string;
  filas: Miembro[];
  busyId: string | null;
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
                      disabled={busyId === m.id}
                    >
                      {busyId === m.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <UserX className="mr-1 h-4 w-4" />
                      )}
                      Inhabilitar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEstado(m.id, "activo")}
                      disabled={busyId === m.id}
                    >
                      {busyId === m.id ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="mr-1 h-4 w-4" />
                      )}
                      Activar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => onDesvincular(m.id)}
                    disabled={busyId === m.id}
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