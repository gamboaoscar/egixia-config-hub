import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { PrivateShell } from "@/components/private-shell";
import { exigirEquipoInterno } from "@/lib/rbac.functions";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Área privada · EGIXIA Configurator" }],
  }),
  beforeLoad: async () => {
    try {
      await exigirEquipoInterno();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "forbidden") {
        throw redirect({ to: "/mi-proyecto" });
      }
      throw redirect({ to: "/login", search: { next: "/app" } });
    }
  },
  component: AppLayout,
});

const titles: Record<string, string> = {
  "/app": "Inicio",
  "/app/proyectos": "Proyectos",
  "/app/proyectos/nuevo": "Nuevo proyecto",
  "/app/revisiones": "Revisiones pendientes",
  "/app/invitaciones": "Invitaciones",
  "/app/usuarios": "Usuarios",
  "/app/catalogo": "Catálogo de módulos",
  "/app/auditoria": "Auditoría",
  "/app/configuracion": "Configuración",
  "/app/mi-perfil": "Mi perfil",
};

function AppLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  let title = titles[pathname] ?? "EGIXIA Configurator";
  if (pathname.startsWith("/app/modulo/")) title = "Revisión de módulo";
  if (pathname.startsWith("/app/proyectos/") && pathname !== "/app/proyectos/nuevo")
    title = "Detalle del proyecto";

  return (
    <PrivateShell title={title} allow={["admin", "implementador"]}>
      <Outlet />
    </PrivateShell>
  );
}