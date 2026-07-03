import { createFileRoute, Link } from "@tanstack/react-router";
import { LogIn, ArrowLeft, CheckCircle2, ClipboardList, Users, ShieldCheck, FileText, Rocket } from "lucide-react";

const URL = "https://egixia-config-hub.lovable.app/guias/portal-de-proveedores";
const TITLE = "Cómo implementar un Portal de Proveedores — Guía EGIXIA";
const DESCRIPTION =
  "Guía práctica para grandes empresas de LATAM: pasos, roles, entregables y buenas prácticas para implementar un Portal de Proveedores (procure-to-pay) sin correos ni archivos Excel.";

export const Route = createFileRoute("/guias/portal-de-proveedores")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Cómo implementar un Portal de Proveedores",
          description: DESCRIPTION,
          author: { "@type": "Organization", name: "EGIXIA" },
          publisher: { "@type": "Organization", name: "EGIXIA" },
          mainEntityOfPage: URL,
          inLanguage: "es-419",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: "https://egixia-config-hub.lovable.app/" },
            { "@type": "ListItem", position: 2, name: "Guías", item: "https://egixia-config-hub.lovable.app/guias/portal-de-proveedores" },
            { "@type": "ListItem", position: 3, name: "Portal de Proveedores", item: URL },
          ],
        }),
      },
    ],
  }),
  component: GuiaPortalProveedores,
});

const fases = [
  {
    icon: ClipboardList,
    titulo: "1. Diagnóstico y alcance",
    texto:
      "Levanta el proceso actual de proveedores (registro, actualización, facturación, pagos), identifica cuellos de botella —correos, Excels, reprocesos— y define el alcance del portal: sociedades, países, tipos de proveedor y módulos a habilitar.",
  },
  {
    icon: Users,
    titulo: "2. Roles y gobierno",
    texto:
      "Define quién administra, quién implementa y quién diligencia. Un modelo típico incluye Administrador (control total), Implementador (acompaña y revisa) y Cliente/Proveedor invitado (diligencia sus datos). Documenta responsables por módulo.",
  },
  {
    icon: FileText,
    titulo: "3. Catálogo de información",
    texto:
      "Estandariza los formularios: imagen corporativa (branding, SMTP), sociedades (RUT/NIT, direcciones, contactos), seguridad (políticas y controles), y anexos legales. Cada campo debe tener ayuda contextual y reglas de validación claras.",
  },
  {
    icon: ShieldCheck,
    titulo: "4. Seguridad y trazabilidad",
    texto:
      "Implementa control por roles a nivel de fila (RLS), auditoría de cambios, almacenamiento privado con URLs firmadas y separación estricta entre datos de proyectos. La confidencialidad entre proveedores es innegociable.",
  },
  {
    icon: CheckCircle2,
    titulo: "5. Flujo de revisión y actas",
    texto:
      "Cada módulo pasa por estados —borrador, en revisión, aprobado— con notificaciones y un acta en PDF que deja constancia de la conformidad. Esto elimina la ambigüedad y acelera el go-live.",
  },
  {
    icon: Rocket,
    titulo: "6. Onboarding e invitaciones",
    texto:
      "Invita a los proveedores por token único, con vencimiento y validación server-side. Autoguardado, progreso visible y guía por campo bajan la fricción y elevan la tasa de finalización.",
  },
];

function GuiaPortalProveedores() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
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

      <main className="flex-1">
        <section
          className="relative"
          style={{
            background:
              "linear-gradient(180deg, var(--primary-soft) 0%, var(--background) 100%)",
          }}
        >
          <div className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-24">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Link>
            <span className="mt-6 inline-flex items-center rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-medium text-primary shadow-sm">
              Guía práctica
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              Cómo implementar un Portal de Proveedores
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Reemplazar correos y archivos Excel por un Portal de Proveedores
              (procure-to-pay) reduce reprocesos, acelera el onboarding y da
              trazabilidad al equipo de compras. Esta es la ruta que
              recomendamos en EGIXIA para grandes empresas de LATAM.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Las 6 fases de una implementación exitosa
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {fases.map((f) => (
              <article
                key={f.titulo}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <f.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  {f.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.texto}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-6 pb-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Errores frecuentes que debes evitar
          </h2>
          <ul className="mt-6 space-y-3 text-muted-foreground">
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span><strong className="text-foreground">Formularios sin ayuda contextual:</strong> cada campo debe explicar qué se espera y por qué se pide.</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span><strong className="text-foreground">Un solo estado para todo el proyecto:</strong> el flujo debe ser por módulo, con revisión y aprobación independientes.</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span><strong className="text-foreground">Compartir credenciales:</strong> cada proveedor debe entrar por invitación única, nunca por un usuario compartido.</span>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
              <span><strong className="text-foreground">No dejar acta:</strong> sin acta en PDF, la conformidad queda en un correo y se pierde.</span>
            </li>
          </ul>
        </section>

        <section className="border-t border-border bg-primary-soft">
          <div className="mx-auto w-full max-w-4xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              ¿Vas a implementar tu Portal de Proveedores con EGIXIA?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Si ya recibiste una invitación, ingresa con tu correo para diligenciar tu proyecto.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-dark"
            >
              <LogIn className="h-4 w-4" />
              Acceder al portal
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#0b1e62] text-white/90">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 text-sm">
          © {new Date().getFullYear()} EGIXIA · Portal de Configuración
        </div>
      </footer>
    </div>
  );
}