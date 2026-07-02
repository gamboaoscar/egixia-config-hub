import { createFileRoute } from "@tanstack/react-router";

import { MiPerfil } from "@/components/mi-perfil";

export const Route = createFileRoute("/mi-proyecto/mi-perfil")({
  component: MiPerfil,
});