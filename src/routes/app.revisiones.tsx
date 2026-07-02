import { createFileRoute } from "@tanstack/react-router";

import { RevisionesPendientes } from "@/components/revisiones-pendientes";

export const Route = createFileRoute("/app/revisiones")({
  component: RevisionesPendientes,
});