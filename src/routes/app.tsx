import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "Área privada · EGIXIA Configurator" }],
  }),
  component: AppLayout,
});

const titles: Record<string, string> = {
  "/app": "Inicio",
  "/app/formularios": "Formularios",
  "/app/proyectos": "Proyectos",
  "/app/configuracion": "Configuración",
};

function AppLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const title = titles[pathname] ?? "EGIXIA Configurator";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-6 shadow-sm">
            <SidebarTrigger className="-ml-2" />
            <h1 className="text-sm font-semibold text-foreground">{title}</h1>
          </header>
          <main className="flex-1 overflow-y-auto p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}