import { useEffect, type ReactNode } from "react";
import {
  useMatches,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  CloudUpload,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { MiProyectoProvider, useMiProyecto } from "@/hooks/use-mi-proyecto";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { diasHasta } from "@/lib/modulo-estado";

interface Props {
  children: ReactNode;
}

export function ClienteShell({ children }: Props) {
  const navigate = useNavigate();
  const { loading, session, profile } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", search: { next: pathname } });
      return;
    }
    if (!profile) return;
    if (profile.estado === "inhabilitado") {
      toast.error("Tu cuenta está inhabilitada. Contacta a un administrador.");
      supabase.auth.signOut();
      navigate({ to: "/login" });
      return;
    }
    if (profile.rol !== "cliente") {
      navigate({ to: "/app" });
    }
  }, [loading, session, profile, pathname, navigate]);

  if (loading || !session || !profile || profile.rol !== "cliente") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <MiProyectoProvider>
      <SidebarProvider>
        <div className="flex min-h-dvh w-full bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <ClienteTopbar />
            <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </MiProyectoProvider>
  );
}

function ClienteTopbar() {
  const {
    proyectos,
    modulos,
    proyectoById,
    modulosDeProyecto,
    moduloById,
    saveStatus,
    lastSavedAt,
    loading,
  } = useMiProyecto();
  const matches = useMatches();

  // Derivamos el "proyecto activo" desde la ruta actual.
  let proyectoActivoId: string | null = null;
  for (const m of matches) {
    const params = m.params as Record<string, string | undefined>;
    if (params?.id) {
      proyectoActivoId = params.id;
      break;
    }
    if (params?.moduloId) {
      proyectoActivoId = moduloById(params.moduloId)?.proyecto_id ?? null;
      if (proyectoActivoId) break;
    }
  }
  const proyecto = proyectoActivoId ? proyectoById(proyectoActivoId) ?? null : null;
  const modulosContexto = proyectoActivoId
    ? modulosDeProyecto(proyectoActivoId)
    : modulos;

  // Fecha límite más próxima entre los módulos no aprobados.
  const proximaFecha = modulosContexto
    .filter((m) => m.fecha_limite && m.estado !== "aprobado")
    .map((m) => m.fecha_limite as string)
    .sort()[0];

  const dias = diasHasta(proximaFecha);
  const vencido = dias !== null && dias < 0;
  const proximo = dias !== null && dias >= 0 && dias <= 3;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-4 shadow-sm lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {loading
              ? "Cargando…"
              : proyecto?.nombre ??
                (proyectos.length === 0
                  ? "Sin proyectos asignados"
                  : "Portal del proveedor")}
          </h1>
          {proyecto?.empresa && (
            <div className="truncate text-xs text-muted-foreground">
              {proyecto.empresa}
            </div>
          )}
          {!proyecto && proyectos.length > 0 && (
            <div className="truncate text-xs text-muted-foreground">
              {proyectos.length} proyecto{proyectos.length === 1 ? "" : "s"}
            </div>
          )}
        </div>

        {proximaFecha && (
          <span
            className={cn(
              "hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex",
              vencido
                ? "border-red-200 bg-red-50 text-red-700"
                : proximo
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-slate-50 text-slate-700",
            )}
            title="Fecha límite más próxima"
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {new Date(proximaFecha + "T00:00:00").toLocaleDateString("es", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        )}
      </div>

      <SaveIndicator saveStatus={saveStatus} lastSavedAt={lastSavedAt} />
    </header>
  );
}

function SaveIndicator({
  saveStatus,
  lastSavedAt,
}: {
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
}) {
  if (saveStatus === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        Guardando…
      </span>
    );
  }
  if (saveStatus === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-700">
        <CircleAlert className="h-3.5 w-3.5" />
        No se pudo guardar
      </span>
    );
  }
  if (saveStatus === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Guardado {formatoHoraCO(lastSavedAt)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Al día
    </span>
  );
}