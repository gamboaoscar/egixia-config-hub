import { createFileRoute } from "@tanstack/react-router";

import { MiPerfil } from "@/components/mi-perfil";

export const Route = createFileRoute("/app/mi-perfil")({
  component: MiPerfil,
});