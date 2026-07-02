import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Ingresar · EGIXIA Configurator" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
          E
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
          Inicio de sesión
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Se construye en el siguiente paso.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <Link
            to="/app"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
          >
            Ir al área privada (demo)
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}