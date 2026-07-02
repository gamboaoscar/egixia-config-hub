import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { PrivateShell } from "@/components/private-shell";

export const Route = createFileRoute("/mi-proyecto")({
  head: () => ({ meta: [{ title: "Mi proyecto · EGIXIA Configurator" }] }),
  component: ClienteLayout,
});

const titles: Record<string, string> = {
  "/mi-proyecto": "Mi proyecto",
  "/mi-proyecto/modulos": "Mis módulos",
  "/mi-proyecto/mi-perfil": "Mi perfil",
};

function ClienteLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const title = titles[pathname] ?? "Mi proyecto";
  return (
    <PrivateShell title={title} allow={["cliente"]}>
      <Outlet />
    </PrivateShell>
  );
}