import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  UserMinus,
  UserX,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { DatePickerHabil } from "@/components/ui/date-picker-habil";
import { EstadoPastilla } from "@/components/estado-pastilla";
import { supabase } from "@/integrations/supabase/client";
import {
  MODULOS_CATALOGO,
  moduloCatalogo,
  type ModuloKey,
} from "@/lib/modulos-catalogo";
import { descargarActaFirmada } from "@/lib/acta.functions";
import { descargarPdfBlob } from "@/lib/acta/abrir-pdf";
import {
  actualizarMiembroEstado,
  agregarModuloAProyecto,
  desvincularMiembro,
  eliminarProyecto,
  listarInvitaciones,
  reenviarInvitacion,
  revocarInvitacion,
} from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { useParametrosSistema } from "@/hooks/use-parametros-sistema";
import { esNoHabil, parseISOLocal } from "@/lib/festivos-co";
import {
  fechaISOBogota,
  formatoFechaCortaCO,
  formatoFechaHoraCO,
  formatoFechaPlanaCortaCO,
} from "@/lib/fechas";

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
  extension_solicitada_at: string | null;
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
  actor_id: string | null;
  accion: string;
  entidad: string;
  entidad_id: string;
  detalle: Record<string, unknown> | null;
  created_at: string;
}

type RolPerfil = "admin" | "implementador" | "cliente";

interface ActorAudit {
  nombre: string;
  rol: RolPerfil | null;
}

const PAGE_SIZE = 10;

// Etiquetas legibles en español para los códigos de `accion` de auditoría.
const ACCION_LABELS: Record<string, string> = {
  modulo_datos_actualizados: "Datos del módulo actualizados",
  modulo_editado_admin: "Módulo editado por equipo interno",
  archivo_subido: "Archivo cargado",
  acta_generada: "Acta generada",
  modulo_enviado_revision: "Módulo enviado a revisión",
  enviado_a_revision: "Módulo enviado a revisión",
  modulo_aprobado: "Módulo aprobado",
  modulo_devuelto: "Módulo devuelto con observaciones",
  devuelto_con_observaciones: "Módulo devuelto con observaciones",
  observacion_respondida: "Respuesta a observación",
  extension_solicitada: "Extensión solicitada",
  extension_concedida: "Extensión concedida",
  invitacion_creada: "Invitación creada",
  invitacion_correo_enviado: "Correo de invitación",
  notificacion_invitacion_enviada: "Correo de invitación",
  recordatorios_enviados: "Recordatorios enviados",
  plantilla_aplicada: "Plantilla aplicada",
  modulo_agregado: "Módulo agregado",
};

function accionLegible(accion: string): string {
  const found = ACCION_LABELS[accion];
  if (found) return found;
  const limpio = accion.replace(/_/g, " ").trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

const ROL_LABELS: Record<RolPerfil, string> = {
  admin: "Admin",
  implementador: "Implementador",
  cliente: "Cliente",
};

function rolBadgeVariant(
  rol: RolPerfil | null,
): "default" | "secondary" | "outline" {
  if (rol === "admin") return "default";
  if (rol === "implementador") return "secondary";
  return "outline";
}

function DetalleProyecto() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [proy, setProy] = useState<Proyecto | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaRow[]>([]);
  const [actoresAudit, setActoresAudit] = useState<Record<string, ActorAudit>>(
    {},
  );
  const [descargando, setDescargando] = useState<string | null>(null);
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [invitaciones, setInvitaciones] = useState<InvitacionProy[]>([]);
  const [invAction, setInvAction] = useState<string | null>(null);
  // Paginación en cliente (10 por página) para invitaciones y auditoría.
  const [invPage, setInvPage] = useState(1);
  const [audPage, setAudPage] = useState(1);
  // M8: id de la mutación en vuelo (miembro o "eliminar-proyecto") para
  // deshabilitar los botones y evitar dobles envíos.
  const [mutando, setMutando] = useState<string | null>(null);
  // Agregar módulo a un proyecto existente (Dialog interno).
  const [dlgAgregarModulo, setDlgAgregarModulo] = useState(false);
  const [nuevoModuloKey, setNuevoModuloKey] = useState<string>("");
  const [nuevoModuloFecha, setNuevoModuloFecha] = useState<string>("");
  const [nuevoModuloComp, setNuevoModuloComp] = useState<string>("solo_avisar");
  const [agregandoModulo, setAgregandoModulo] = useState(false);

  const actualizar = useServerFn(actualizarMiembroEstado);
  const desvincular = useServerFn(desvincularMiembro);
  const descargarActa = useServerFn(descargarActaFirmada);
  const remove = useServerFn(eliminarProyecto);
  const listarInv = useServerFn(listarInvitaciones);
  const reenviarInv = useServerFn(reenviarInvitacion);
  const revocarInv = useServerFn(revocarInvitacion);
  const agregarModulo = useServerFn(agregarModuloAProyecto);
  const { profile } = useAuth();
  const parametros = useParametrosSistema();
  const navigate = useNavigate();
  const hoyStr = fechaISOBogota();

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
          "id, modulo_key, estado, progreso, fecha_limite, extension_solicitada_at, datos, enviado_at, revisado_at, updated_at, updated_por",
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
      .select("id, actor_id, accion, entidad, entidad_id, detalle, created_at")
      .or(`entidad_id.eq.${id},detalle->>proyecto_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(100);
    const audRows = (aud ?? []) as unknown as AuditoriaRow[];
    setAuditoria(audRows);
    setAudPage(1);

    // Resolver los actor_id distintos de la auditoría en UNA sola consulta,
    // trayendo también el rol para la pastilla.
    const actorIds = Array.from(
      new Set(
        audRows
          .map((x) => x.actor_id)
          .filter((v): v is string => !!v),
      ),
    );
    if (actorIds.length > 0) {
      const { data: actProfs } = await supabase
        .from("profiles")
        .select("id, nombre, apellido, email, rol")
        .in("id", actorIds);
      const amap: Record<string, ActorAudit> = {};
      for (const p of actProfs ?? []) {
        const n = `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim();
        amap[p.id] = {
          nombre: n || p.email || "Usuario",
          rol: (p.rol as RolPerfil | null) ?? null,
        };
      }
      setActoresAudit(amap);
    } else {
      setActoresAudit({});
    }

    try {
      const inv = await listarInv({ data: { proyectoId: id } });
      setInvitaciones(inv as unknown as InvitacionProy[]);
    } catch {
      setInvitaciones([]);
    }
    setInvPage(1);

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

  // Paginación en cliente: la lista completa ya está en memoria, así que
  // solo cortamos la página visible sin nuevas consultas.
  const invTotalPages = Math.max(1, Math.ceil(invitaciones.length / PAGE_SIZE));
  const invPageClamped = Math.min(invPage, invTotalPages);
  const invVisibles = useMemo(
    () =>
      invitaciones.slice(
        (invPageClamped - 1) * PAGE_SIZE,
        invPageClamped * PAGE_SIZE,
      ),
    [invitaciones, invPageClamped],
  );

  const audTotalPages = Math.max(1, Math.ceil(auditoria.length / PAGE_SIZE));
  const audPageClamped = Math.min(audPage, audTotalPages);
  const audVisibles = useMemo(
    () =>
      auditoria.slice(
        (audPageClamped - 1) * PAGE_SIZE,
        audPageClamped * PAGE_SIZE,
      ),
    [auditoria, audPageClamped],
  );

  if (loading) {
    return <div className="mx-auto h-64 max-w-5xl animate-pulse rounded-2xl bg-muted" />;
  }
  if (!proy) throw notFound();

  const invitados = miembros.filter((x) => x.rol_en_proyecto === "invitado");
  const equipo = miembros.filter((x) => x.rol_en_proyecto === "implementador");

  // Solo el equipo interno puede agregar módulos; se ofrecen los del
  // catálogo que aún no están asignados al proyecto.
  const esInterno =
    profile?.rol === "admin" || profile?.rol === "implementador";
  const modulosDisponibles = (
    Object.keys(MODULOS_CATALOGO) as ModuloKey[]
  ).filter((k) => !modulos.some((m) => m.modulo_key === k));

  const handleAgregarModulo = async () => {
    if (!nuevoModuloKey) {
      toast.error("Selecciona el módulo a agregar.");
      return;
    }
    if (nuevoModuloFecha && nuevoModuloFecha < hoyStr) {
      toast.error("La fecha límite no puede ser anterior a hoy.");
      return;
    }
    if (
      nuevoModuloFecha &&
      parametros.bloquear_fines_semana_festivos &&
      esNoHabil(parseISOLocal(nuevoModuloFecha))
    ) {
      toast.error(
        "La fecha no puede caer en fin de semana o festivo de Colombia.",
      );
      return;
    }
    setAgregandoModulo(true);
    try {
      await agregarModulo({
        data: {
          proyectoId: id,
          moduloKey: nuevoModuloKey as ModuloKey,
          fecha_limite: nuevoModuloFecha || null,
          comportamiento_vencimiento: nuevoModuloComp as
            | "bloquear"
            | "editable_avisar"
            | "solo_avisar"
            | "extension_implementador",
        },
      });
      toast.success("Módulo agregado al proyecto.");
      setDlgAgregarModulo(false);
      setNuevoModuloKey("");
      setNuevoModuloFecha("");
      setNuevoModuloComp("solo_avisar");
      await cargar();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo agregar el módulo.",
      );
    } finally {
      setAgregandoModulo(false);
    }
  };

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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Módulos ({modulos.length})
          </h3>
          {esInterno && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDlgAgregarModulo(true)}
              disabled={modulosDisponibles.length === 0}
              title={
                modulosDisponibles.length === 0
                  ? "El proyecto ya tiene todos los módulos del catálogo."
                  : undefined
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Agregar módulo
            </Button>
          )}
        </div>
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
                        {m.extension_solicitada_at && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                            <CalendarClock className="h-3 w-3" />
                            Extensión solicitada {formatoFechaHoraCO(m.extension_solicitada_at)}
                          </span>
                        )}
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
            {invVisibles.map((r) => {
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
        {invitaciones.length > PAGE_SIZE && (
          <Paginador
            page={invPageClamped}
            totalPages={invTotalPages}
            total={invitaciones.length}
            onPrev={() => setInvPage((p) => Math.max(1, p - 1))}
            onNext={() => setInvPage((p) => Math.min(invTotalPages, p + 1))}
          />
        )}
      </section>

      {/* Auditoría */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Auditoría reciente ({auditoria.length})
        </h3>
        {auditoria.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sin registros aún.</p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-border text-sm">
              {audVisibles.map((a) => (
                <AuditoriaFila
                  key={a.id}
                  row={a}
                  actor={a.actor_id ? actoresAudit[a.actor_id] : undefined}
                />
              ))}
            </ul>
            {auditoria.length > PAGE_SIZE && (
              <Paginador
                page={audPageClamped}
                totalPages={audTotalPages}
                total={auditoria.length}
                onPrev={() => setAudPage((p) => Math.max(1, p - 1))}
                onNext={() => setAudPage((p) => Math.min(audTotalPages, p + 1))}
              />
            )}
          </>
        )}
      </section>

      {/* Dialog: agregar módulo al proyecto (interno) */}
      <Dialog open={dlgAgregarModulo} onOpenChange={setDlgAgregarModulo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar módulo al proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Módulo</Label>
              <Select value={nuevoModuloKey} onValueChange={setNuevoModuloKey}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona un módulo" />
                </SelectTrigger>
                <SelectContent>
                  {modulosDisponibles.map((k) => (
                    <SelectItem key={k} value={k}>
                      {MODULOS_CATALOGO[k].nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {nuevoModuloKey && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {MODULOS_CATALOGO[nuevoModuloKey as ModuloKey]?.descripcion}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Fecha límite (opcional)</Label>
              <div className="mt-1">
                <DatePickerHabil
                  value={nuevoModuloFecha}
                  onChange={setNuevoModuloFecha}
                  min={hoyStr}
                  bloquearNoHabiles={parametros.bloquear_fines_semana_festivos}
                />
              </div>
              {nuevoModuloFecha && nuevoModuloFecha < hoyStr && (
                <p className="mt-1 text-xs text-red-600">
                  La fecha no puede ser anterior a hoy.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Al vencer</Label>
              <Select value={nuevoModuloComp} onValueChange={setNuevoModuloComp}>
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
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDlgAgregarModulo(false)}
              disabled={agregandoModulo}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAgregarModulo}
              disabled={
                agregandoModulo ||
                !nuevoModuloKey ||
                (!!nuevoModuloFecha && nuevoModuloFecha < hoyStr)
              }
            >
              {agregandoModulo ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Agregar módulo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function Paginador({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const desde = (page - 1) * PAGE_SIZE + 1;
  const hasta = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">
        {desde}–{hasta} de {total} · Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onPrev}
          disabled={page <= 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={page >= totalPages}
        >
          Siguiente
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Campos de `detalle` que se renderizan de forma amigable arriba y se
// excluyen del bloque JSON de respaldo. Se ocultan ids crudos e internos.
const DETALLE_OCULTOS = new Set([
  "actor_id",
  "proyecto_id",
  "modulo_id",
  "proyecto_modulo_id",
  "invitacion_id",
  "acta_id",
  "user_id",
  "entidad_id",
]);

function esEstadoOk(v: unknown): boolean {
  const s = String(v).toLowerCase();
  return ["ok", "enviado", "sent", "success", "200", "true"].includes(s);
}

function AuditoriaFila({
  row,
  actor,
}: {
  row: AuditoriaRow;
  actor: ActorAudit | undefined;
}) {
  const [abierto, setAbierto] = useState(false);
  const detalle = (row.detalle ?? {}) as Record<string, unknown>;
  const moduloKey =
    typeof detalle.modulo_key === "string" ? detalle.modulo_key : null;
  const moduloNombre = moduloKey ? moduloCatalogo(moduloKey).nombre : null;
  const nombreActor = row.actor_id
    ? (actor?.nombre ?? "Usuario")
    : "Sistema";
  const rolActor = row.actor_id ? (actor?.rol ?? null) : null;
  const hayDetalle = Object.keys(detalle).length > 0;

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              {accionLegible(row.accion)}
            </span>
            {moduloNombre && (
              <span className="text-xs text-muted-foreground">
                · {moduloNombre}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{nombreActor}</span>
            {rolActor && (
              <Badge variant={rolBadgeVariant(rolActor)} className="text-[10px]">
                {ROL_LABELS[rolActor]}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatoFechaHoraCO(row.created_at)}
          </span>
          {hayDetalle && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setAbierto((v) => !v)}
            >
              <ChevronDown
                className={`mr-1 h-4 w-4 transition-transform ${
                  abierto ? "rotate-180" : ""
                }`}
              />
              Ver detalle
            </Button>
          )}
        </div>
      </div>
      {abierto && hayDetalle && (
        <DetalleAuditoria detalle={detalle} />
      )}
    </li>
  );
}

function DetalleAuditoria({
  detalle,
}: {
  detalle: Record<string, unknown>;
}) {
  const usados = new Set<string>();
  const marcar = (...keys: string[]) => keys.forEach((k) => usados.add(k));

  const campos = Array.isArray(detalle.campos_modificados)
    ? (detalle.campos_modificados as unknown[]).map(String)
    : null;
  if (campos) marcar("campos_modificados");

  const nombreArchivo =
    (typeof detalle.nombre_original === "string" && detalle.nombre_original) ||
    (typeof detalle.nombre === "string" && detalle.nombre) ||
    (typeof detalle.archivo === "string" && detalle.archivo) ||
    null;
  if (nombreArchivo) marcar("nombre_original", "nombre", "archivo");

  const version =
    detalle.version != null ? String(detalle.version) : null;
  if (version) marcar("version");

  const estadoCorreo: unknown =
    detalle.edge_status != null
      ? detalle.edge_status
      : detalle.estado != null
        ? detalle.estado
        : null;
  if (estadoCorreo !== null) marcar("edge_status", "estado");

  const destinatarios = Array.isArray(detalle.destinatarios)
    ? (detalle.destinatarios as unknown[]).map(String)
    : typeof detalle.destinatarios === "string"
      ? [detalle.destinatarios]
      : null;
  if (destinatarios) marcar("destinatarios");

  const motivo =
    typeof detalle.motivo === "string" ? detalle.motivo : null;
  if (motivo) marcar("motivo");

  // Resto de campos como bloque JSON legible (key: value), sin ids crudos.
  const resto = Object.entries(detalle).filter(
    ([k]) => !usados.has(k) && !DETALLE_OCULTOS.has(k) && k !== "modulo_key",
  );

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
      {campos && campos.length > 0 && (
        <div>
          <div className="mb-1 font-medium text-foreground">
            Campos modificados
          </div>
          <div className="flex flex-wrap gap-1">
            {campos.map((c, i) => (
              <span
                key={i}
                className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {nombreArchivo && (
        <div>
          <span className="font-medium text-foreground">Archivo: </span>
          <span className="text-muted-foreground">{nombreArchivo}</span>
        </div>
      )}
      {version && (
        <div>
          <span className="font-medium text-foreground">Versión: </span>
          <span className="text-muted-foreground">v{version}</span>
        </div>
      )}
      {estadoCorreo !== null && (
        <div>
          <span className="font-medium text-foreground">Estado: </span>
          <span
            className={
              esEstadoOk(estadoCorreo)
                ? "font-medium text-emerald-600"
                : "font-medium text-red-600"
            }
          >
            {String(estadoCorreo)}
          </span>
        </div>
      )}
      {destinatarios && destinatarios.length > 0 && (
        <div>
          <span className="font-medium text-foreground">Destinatarios: </span>
          <span className="text-muted-foreground">
            {destinatarios.join(", ")}
          </span>
        </div>
      )}
      {motivo && (
        <div>
          <span className="font-medium text-foreground">Motivo: </span>
          <span className="text-muted-foreground">{motivo}</span>
        </div>
      )}
      {resto.length > 0 && (
        <div className="space-y-0.5 border-t border-border pt-2">
          {resto.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="font-medium text-foreground">
                {k.replace(/_/g, " ")}:
              </span>
              <span className="break-all text-muted-foreground">
                {typeof v === "object" && v !== null
                  ? JSON.stringify(v)
                  : String(v)}
              </span>
            </div>
          ))}
        </div>
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