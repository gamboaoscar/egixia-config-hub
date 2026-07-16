import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Ingresar · EGIXIA Configurator" },
      {
        name: "description",
        content:
          "Accede a EGIXIA Configurator con tu cuenta para continuar la configuración de tu Portal de Proveedores.",
      },
      { property: "og:title", content: "Ingresar · EGIXIA Configurator" },
      {
        property: "og:description",
        content: "Accede a EGIXIA Configurator con tu cuenta.",
      },
      { property: "og:url", content: "https://egixia-config-hub.lovable.app/login" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://egixia-config-hub.lovable.app/login" }],
  }),
  component: LoginPage,
});

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Credenciales inválidas. Verifica tu correo y contraseña.";
  if (m.includes("email not confirmed")) return "Debes confirmar tu correo antes de ingresar.";
  if (m.includes("too many")) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  return msg;
}

function LoginPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/login" });
  const { session, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openReset, setOpenReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (session && profile) {
      if (profile.estado === "inhabilitado") return;
      // Ruta relativa segura (misma origin, sin protocol-relative //).
      const isSafeNext =
        typeof next === "string" && next.startsWith("/") && !next.startsWith("//");
      const target = isSafeNext
        ? next!
        : profile.rol === "cliente"
          ? "/mi-proyecto"
          : "/app";
      navigate({ to: target });
    }
  }, [session, profile, loading, next, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { data, error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signErr) {
      setSubmitting(false);
      setError(translateAuthError(signErr.message));
      return;
    }
    // Check profile estado
    const { data: prof } = await supabase
      .from("profiles")
      .select("estado")
      .eq("id", data.user!.id)
      .maybeSingle();
    if (prof?.estado === "inhabilitado") {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError("Tu cuenta está inhabilitada. Contacta a un administrador.");
      return;
    }
    // Redirect handled by effect once profile loads
  };

  const handleReset = async () => {
    if (!resetEmail.trim()) {
      toast.error("Ingresa tu correo");
      return;
    }
    setSendingReset(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Si el correo existe, te enviamos un enlace de recuperación.");
    setOpenReset(false);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary-soft via-background to-background p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            E
          </div>
          <span className="text-lg font-semibold text-primary">EGIXIA Configurator</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <h1 className="text-xl font-semibold text-foreground">Ingresa a tu cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Usa el correo con el que fuiste invitado.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ingresar
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setOpenReset(true);
                }}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          El acceso al Configurator es únicamente por invitación.
        </p>
      </div>

      <Dialog open={openReset} onOpenChange={setOpenReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu correo y te enviaremos un enlace para restablecerla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Correo electrónico</Label>
            <Input
              id="reset-email"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenReset(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReset} disabled={sendingReset}>
              {sendingReset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}