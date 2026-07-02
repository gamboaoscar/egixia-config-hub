import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          Área privada
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Área privada
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Se construye en los siguientes pasos.
        </p>
      </div>
    </div>
  );
}