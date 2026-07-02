import { type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth, type Rol } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  title: string;
  /** Roles con acceso permitido a esta sección. Vacío = cualquier autenticado. */
  allow?: Rol[];
  children: ReactNode;
}

export function PrivateShell({ title, allow, children }: Props) {
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
    // Redirect by role to their home area
    if (profile.rol === "cliente" && !pathname.startsWith("/mi-proyecto")) {
      navigate({ to: "/mi-proyecto" });
      return;
    }
    if (profile.rol !== "cliente" && pathname.startsWith("/mi-proyecto")) {
      navigate({ to: "/app" });
      return;
    }
    if (allow && !allow.includes(profile.rol)) {
      toast.error("No tienes permiso para acceder a esta sección.");
      navigate({ to: profile.rol === "cliente" ? "/mi-proyecto" : "/app" });
    }
  }, [loading, session, profile, allow, pathname, navigate]);

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-6 shadow-sm">
            <SidebarTrigger className="-ml-2" />
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          </header>
          <main className="flex-1 overflow-y-auto p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}