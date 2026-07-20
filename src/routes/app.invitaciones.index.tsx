import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  crearInvitacion,
  listarInvitaciones,
  reenviarInvitacion,
  revocarInvitacion,
} from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { formatoFechaHoraCO } from "@/lib/fechas";

export const Route = createFileRoute("/app/invitaciones/")({
  component: Invitaciones,
});

interface Inv {
  id: string;
  email: string;
  rol_invitado: "implementador" | "invitado";
  proyecto_id: string | null;
  estado: "pendiente" | "aceptada" | "revocada" | "expirada";
  expira_at: string;
  created_at: string;
  proyectos: { nombre: string } | null;
}

interface Proy {
  id: string;
  nombre: string;
  empresa: string;
}

function Invitaciones() {
  const { profile } = useAuth();
  const esAdmin = profile?.rol === "admin";
  const crear = useServerFn(crearInvitacion);
  const listar = useServerFn(listarInvitaciones);
  const reenviar = useServerFn(reenviarInvitacion);
  const revocar = useServerFn(revocarInvitacion);
  const [rows, setRows] = useState<Inv[]>([]);
  const [proyectos, setProyectos] = useState<Proy[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"implementador" | "invitado">("invitado");
  const [proyectoId, setProyectoId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [action, setAction] = useState<string | null>(null);

  const cargar = async () => {
    // El listado va por server function (supabaseAdmin) porque la RLS de
    // `invitaciones` es solo-admin: así el implementador también puede
    // hacer seguimiento. El token nunca viaja al cliente.
    const [i, p] = await Promise.all([
      listar().catch((e) => {
        toast.error(
          e instanceof Error ? e.message : "No se pudieron cargar las invitaciones.",
        );
        return [];
      }),
      supabase.from("proyectos").select("id, nombre, empresa").order("nombre"),
    ]);
    setRows((i ?? []) as unknown as Inv[]);
    setProyectos((p.data ?? []) as Proy[]);
    setLoading(false);
  };

  useEffect(() => {
    void cargar();
  }, []);

  const enviar = async () => {
    if (!email || !email.includes("@")) return toast.error("Email inválido.");
    if (rol === "invitado" && !proyectoId)
      return toast.error("Selecciona el proyecto para el invitado.");
    setSending(true);
    try {
      await crear({
        data: {
          email,
          rol_invitado: rol,
          proyecto_id: rol === "invitado" ? proyectoId : null,
          dias_validez: 14,
        },
      });
      toast.success("Invitación enviada.");
      setEmail("");
      setProyectoId("");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setSending(false);
    }
  };

  const doReenviar = async (id: string) => {
    setAction(id);
    try {
      await reenviar({ data: { id } });
      toast.success("Invitación reenviada.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reenviar.");
    } finally {
      setAction(null);
    }
  };

  const doRevocar = async (id: string) => {
    if (!confirm("¿Revocar esta invitación?")) return;
    setAction(id);
    try {
      await revocar({ data: { id } });
      toast.success("Invitación revocada.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo revocar.");
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Enviar invitación</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Los invitados llegan por correo con un enlace único de un solo uso.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
          <div>
            <Label className="text-xs">Correo</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@empresa.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Rol</Label>
            <Select
              value={rol}
              onValueChange={(v) => setRol(v as "implementador" | "invitado")}
              disabled={!esAdmin}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invitado">Invitado (cliente)</SelectItem>
                {esAdmin && (
                  <SelectItem value="implementador">Implementador EGIXIA</SelectItem>
                )}
              </SelectContent>
            </Select>
            {!esAdmin && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sólo un administrador puede invitar implementadores.
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">Proyecto</Label>
            <Select
              value={proyectoId}
              onValueChange={setProyectoId}
              disabled={rol === "implementador"}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={rol === "implementador" ? "Opcional" : "Requerido"} />
              </SelectTrigger>
              <SelectContent>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} — {p.empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={enviar} disabled={sending}>
              {sending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-1 h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Invitaciones ({rows.length})
        </h3>

        {loading ? (
          <div className="mt-4 h-24 animate-pulse rounded-lg bg-muted" />
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Aún no hay invitaciones.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {rows.map((r) => {
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
                      {r.rol_invitado}
                      {r.proyectos?.nombre ? ` · ${r.proyectos.nombre}` : ""} ·
                      expira{" "}
                      {formatoFechaHoraCO(r.expira_at)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Invitada el {formatoFechaHoraCO(r.created_at)}
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
                          onClick={() => doReenviar(r.id)}
                          disabled={action === r.id}
                        >
                          {action === r.id ? (
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
                          onClick={() => doRevocar(r.id)}
                          disabled={action === r.id}
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
    </div>
  );
}