import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">
        <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          Bienvenido
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          EGIXIA Configurator
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Aquí configurarás, paso a paso, todo lo necesario para poner en marcha
          tu Portal de Proveedores: identidad visual, sociedades, dominios,
          políticas y más. Guarda cuando quieras y continúa después: nada se pierde.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark">
            Comenzar
          </button>
          <button className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
            Ver guía
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { t: "Simple", d: "Un módulo a la vez, sin distracciones." },
          { t: "Guiado", d: "Ayuda contextual en cada campo." },
          { t: "Sin prisa", d: "Guarda y continúa cuando quieras." },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold text-foreground">{c.t}</div>
            <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
