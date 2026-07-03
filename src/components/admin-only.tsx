import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";

/**
 * Guard cliente: sólo permite renderizar los hijos si el usuario autenticado
 * tiene rol `admin`. Si es implementador (u otro rol interno con acceso al
 * área `/app/*`) redirige a `/app` y muestra un toast. Mientras se resuelve
 * la sesión muestra un loader — así evitamos el "flash" del contenido.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { loading, profile } = useAuth();

  useEffect(() => {
    if (loading || !profile) return;
    if (profile.rol !== "admin") {
      toast.error("Esta sección es sólo para administradores.");
      navigate({ to: "/app", replace: true });
    }
  }, [loading, profile, navigate]);

  if (loading || !profile || profile.rol !== "admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}