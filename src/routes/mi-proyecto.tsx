import { createFileRoute, Outlet } from "@tanstack/react-router";

import { ClienteShell } from "@/components/cliente-shell";

export const Route = createFileRoute("/mi-proyecto")({
  head: () => ({ meta: [{ title: "Mi proyecto · EGIXIA Configurator" }] }),
  component: ClienteLayout,
});

function ClienteLayout() {
  return (
    <ClienteShell>
      <Outlet />
    </ClienteShell>
  );
}