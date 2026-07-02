import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { PrivateShell } from "@/components/private-shell";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "Área privada · EGIXIA Configurator" }],
  }),
  component: AppLayout,
});

const titles: Record<string, string> = {
  "/app": "Inicio",
  "/app/proyectos": "Proyectos",
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
  const title = titles[pathname] ?? "EGIXIA Configurator";

  return (
    <PrivateShell title={title} allow={["admin", "implementador"]}>
      <Outlet />
    </PrivateShell>
  );
}