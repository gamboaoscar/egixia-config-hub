import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminOnly } from "@/components/admin-only";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Search, ShieldAlert, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ControlesPaginacion, usePaginacion,
} from "@/components/ui/paginacion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  cambiarEstadoUsuario,
  cambiarRolUsuario,
  eliminarUsuario,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/app/usuarios")({ component: UsuariosGuarded });

function UsuariosGuarded() {
  return (
    <AdminOnly>
      <UsuariosPage />
    </AdminOnly>
  );
}

interface Perfil {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: "admin" | "implementador" | "cliente";
  estado: "activo" | "inhabilitado";
  empresa: string | null;
  cargo: string | null;
  created_at: string;
}

function UsuariosPage() {
  const { profile: yo } = useAuth();
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [rolFiltro, setRolFiltro] = useState<string>("todos");
  const [busy, setBusy] = useState<string | null>(null);
  const changeEstado = useServerFn(cambiarEstadoUsuario);
  const changeRol = useServerFn(cambiarRolUsuario);
  const remove = useServerFn(eliminarUsuario);

  const esAdmin = yo?.rol === "admin";

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre, apellido, email, rol, estado, empresa, cargo, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("No se pudieron cargar los usuarios.");
    setPerfiles((data ?? []) as Perfil[]);
    setLoading(false);
  };

  useEffect(() => { void cargar(); }, []);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return perfiles.filter((p) => {
      if (rolFiltro !== "todos" && p.rol !== rolFiltro) return false;
      if (!term) return true;
      return (
        p.email.toLowerCase().includes(term) ||
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(term) ||
        (p.empresa ?? "").toLowerCase().includes(term)
      );
    });
  }, [perfiles, q, rolFiltro]);

  const pag = usePaginacion(filtrados, "usuarios");

  const handleEstado = async (p: Perfil, estado: "activo" | "inhabilitado") => {
    setBusy(p.id);
    try {
      await changeEstado({ data: { profileId: p.id, estado } });
      toast.success(estado === "activo" ? "Cuenta activada." : "Cuenta inhabilitada.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally { setBusy(null); }
  };

  const handleRol = async (p: Perfil, rol: Perfil["rol"]) => {
    if (rol === p.rol) return;
    if (!confirm(`¿Cambiar el rol de ${p.email} a "${rol}"?`)) return;
    setBusy(p.id);
    try {
      await changeRol({ data: { profileId: p.id, rol } });
      toast.success("Rol actualizado.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el rol.");
    } finally { setBusy(null); }
  };

  const handleEliminar = async (p: Perfil) => {
    if (!confirm(`Eliminar definitivamente la cuenta ${p.email}? Esta acción no se puede deshacer.`)) return;
    setBusy(p.id);
    try {
      await remove({ data: { profileId: p.id } });
      toast.success("Cuenta eliminada.");
      await cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Usuarios</h2>
            <p className="text-sm text-muted-foreground">
              Gestiona cuentas internas y clientes/invitados. Sólo el administrador
              puede eliminar cuentas o cambiar roles.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/invitaciones">
              <Mail className="mr-1 h-4 w-4" />
              Invitar usuario
            </Link>
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, correo o empresa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={rolFiltro} onValueChange={setRolFiltro}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los roles</SelectItem>
              <SelectItem value="admin">Administradores</SelectItem>
              <SelectItem value="implementador">Implementadores</SelectItem>
              <SelectItem value="cliente">Clientes / invitados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No hay usuarios que coincidan con la búsqueda.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pag.itemsPagina.map((p) => {
              const nombre = `${p.nombre} ${p.apellido}`.trim() || p.email;
              const esYo = p.id === yo?.id;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{nombre}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        p.estado === "activo"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}>
                        {p.estado}
                      </span>
                      {esYo && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                          Tú
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p.email}
                      {p.empresa ? ` · ${p.empresa}` : ""}
                      {p.cargo ? ` · ${p.cargo}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={p.rol}
                      onValueChange={(v) => handleRol(p, v as Perfil["rol"])}
                      disabled={!esAdmin || esYo || busy === p.id}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="implementador">Implementador</SelectItem>
                        <SelectItem value="cliente">Cliente / invitado</SelectItem>
                      </SelectContent>
                    </Select>

                    {esAdmin && !esYo && (
                      <>
                        {p.estado === "activo" ? (
                          <Button size="sm" variant="outline" onClick={() => handleEstado(p, "inhabilitado")} disabled={busy === p.id}>
                            <UserX className="mr-1 h-4 w-4" />Inhabilitar
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleEstado(p, "activo")} disabled={busy === p.id}>
                            <UserCheck className="mr-1 h-4 w-4" />Activar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => handleEliminar(p)}
                          disabled={busy === p.id}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && filtrados.length > 0 && (
          <div className="border-t border-border p-4">
            <ControlesPaginacion {...pag} className="mt-0" />
          </div>
        )}
      </section>

      {!esAdmin && (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          Como implementador puedes consultar el listado. Solo un administrador
          puede cambiar roles, inhabilitar o eliminar cuentas.
        </p>
      )}
    </div>
  );
}
