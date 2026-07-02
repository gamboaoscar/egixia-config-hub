import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn, ClipboardList, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EGIXIA · Portal de Configuración de tu Implementación" },
      {
        name: "description",
        content:
          "Diligencia la información de tu Portal de Proveedores de forma guiada, a tu ritmo. Sin correos, sin archivos Excel.",
      },
      { property: "og:title", content: "EGIXIA · Portal de Configuración" },
      {
        property: "og:description",
        content:
          "Portal de onboarding de EGIXIA para configurar tu Portal de Proveedores.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Topbar */}
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link to="/" className="text-xl font-bold tracking-tight text-primary">
            EGIXIA
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
          >
            <LogIn className="h-4 w-4" />
            Ingresar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative"
        style={{
          background:
            "linear-gradient(180deg, var(--primary-soft) 0%, var(--background) 100%)",
        }}
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-24 text-center sm:py-32">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-medium text-primary shadow-sm">
            EGIXIA Configurator
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Portal de Configuración de tu Implementación
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Diligencia la información de tu Portal de Proveedores de forma
            guiada, a tu ritmo. Sin correos, sin archivos Excel.
          </p>
          <div className="mt-10">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary-dark"
            >
              Acceder con mi invitación
            </Link>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            ¿Cómo funciona?
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Tres pasos simples para poner en marcha tu Portal de Proveedores.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: LogIn,
              step: "1",
              title: "Ingresa",
              desc: "Accede con la invitación que EGIXIA te envió.",
            },
            {
              icon: ClipboardList,
              step: "2",
              title: "Diligencia",
              desc: "Completa los módulos a tu ritmo. Guardamos tu avance automáticamente.",
            },
            {
              icon: CheckCircle2,
              step: "3",
              title: "Confirma",
              desc: "Cuando termines, confirma y EGIXIA continúa con tu implementación.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-2xl border border-border bg-card p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Paso {s.step}
                </span>
              </div>
              <h3 className="mt-1 text-lg font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-primary-dark text-primary-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium">
            EGIXIA · Portal de Proveedores
          </div>
          <div className="text-xs text-primary-foreground/70">
            © 2026 EGIXIA. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
