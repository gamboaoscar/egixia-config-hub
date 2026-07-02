import { createFileRoute, useParams } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/app/$section")({
  component: StubSection,
});

const nombres: Record<string, string> = {
  proyectos: "Proyectos",
  revisiones: "Revisiones pendientes",
  invitaciones: "Invitaciones",
  usuarios: "Usuarios",
  catalogo: "Catálogo de módulos",
  auditoria: "Auditoría",
  configuracion: "Configuración",
};

function StubSection() {
  const { section } = useParams({ from: "/app/$section" });
  const nombre = nombres[section] ?? section;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
        <Construction className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">{nombre}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta sección se construirá en un paso posterior.
        </p>
      </div>
    </div>
  );
}