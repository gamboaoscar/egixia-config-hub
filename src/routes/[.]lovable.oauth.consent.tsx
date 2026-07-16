import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Wrapper tipado sobre la API beta supabase.auth.oauth.
type OAuthDetails = {
  client?: { name?: string; redirect_uri?: string; client_uri?: string } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { data: OAuthDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
function oauth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/login", search: { next } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-semibold text-destructive">
          No se pudo cargar esta solicitud de autorización
        </p>
        <p className="mt-2 text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "una aplicación externa";
  const redirectUri = details?.client?.redirect_uri;

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("El servidor de autorización no devolvió URL de retorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary-soft via-background to-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            E
          </div>
          <span className="text-sm font-semibold text-primary">EGIXIA Configurator</span>
        </div>

        <h1 className="mt-6 text-xl font-semibold text-foreground">
          Conectar {clientName} a tu cuenta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} podrá usar las herramientas de EGIXIA Configurator actuando como tú.
          Las políticas de acceso del portal siguen aplicando: sólo verá los proyectos y
          módulos que tu rol permite consultar.
        </p>

        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          <li>• Consultar tus proyectos y su estado.</li>
          <li>• Ver módulos, avance y fechas límite.</li>
          <li>• Listar revisiones pendientes (según tu rol).</li>
        </ul>

        {redirectUri && (
          <p className="mt-4 break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Redirige a: {redirectUri}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Cancelar
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Autorizar
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Esto no anula los permisos de tu cuenta ni las políticas de seguridad del portal.
        </p>
      </div>
    </main>
  );
}