import { createFileRoute, useParams } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/mi-proyecto/$section")({
  component: StubSection,
});

const nombres: Record<string, string> = {
  modulos: "Mis módulos",
};

function StubSection() {
  const { section } = useParams({ from: "/mi-proyecto/$section" });
  const nombre = nombres[section] ?? section;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
        <Construction className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-xl font-semibold text-foreground">{nombre}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta sección se habilitará cuando tu proyecto esté listo.
        </p>
      </div>
    </div>
  );
}