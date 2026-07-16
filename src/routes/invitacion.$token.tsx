import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldAlert, Mail, Building2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { aceptarInvitacion, validarInvitacion } from "@/lib/invitaciones.functions";

type ValidacionOk = {
  email: string;
  rol_invitado: "implementador" | "invitado";
  proyecto_id: string | null;
  proyecto_nombre: string | null;
  expira_at: string;
};

export const Route = createFileRoute("/invitacion/$token")({
  head: () => ({
    meta: [
      { title: "Invitación · EGIXIA Configurator" },
      {
        name: "description",
        content: "Acepta tu invitación para acceder a EGIXIA Configurator.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InvitacionPage,
});

function InvitacionPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitacion, setInvitacion] = useState<ValidacionOk | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const row = await validarInvitacion({ data: { token } });
        if (!active) return;
        if (!row) {
          toast.error(
            "Esta invitación ya no es válida o expiró. Contacta a EGIXIA para recibir una nueva.",
          );
          setErrorMsg("Esta invitación no es válida, ya fue utilizada o expiró.");
          setTimeout(() => {
            if (active) navigate({ to: "/" });
          }, 1200);
        } else {
          setInvitacion(row as ValidacionOk);
        }
      } catch {
        if (active) {
          toast.error("No pudimos validar tu invitación. Inténtalo más tarde.");
          setErrorMsg("No pudimos validar tu invitación. Inténtalo más tarde.");
          setTimeout(() => {
            if (active) navigate({ to: "/" });
          }, 1200);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitacion) return;
    if (nombre.trim().length < 1 || apellido.trim().length < 1) {
      toast.error("Ingresa tu nombre y apellido.");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await aceptarInvitacion({
        data: {
          token,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          password,
        },
      });
      // Iniciar sesión automáticamente.
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: res.email,
        password,
      });
      if (signErr) {
        toast.success("Cuenta creada. Ingresa con tu correo y contraseña.");
        navigate({ to: "/login" });
        return;
      }
      toast.success("¡Bienvenido a EGIXIA Configurator!");
      navigate({ to: res.rol === "cliente" ? "/mi-proyecto" : "/app" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo aceptar la invitación.";
      toast.error(msg);
      // Si el token quedó revocado por la respuesta, refrescar estado.
      if (msg.toLowerCase().includes("expir") || msg.toLowerCase().includes("válida")) {
        setInvitacion(null);
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#f0f4f8] via-white to-[#e6ecf5] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-[#0F2B8E]">EGIXIA Configurator</h1>
          <p className="text-sm text-slate-600 mt-1">Portal de Configuración de tu Implementación</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#0F2B8E]" />
            </div>
          ) : errorMsg || !invitacion ? (
            <div className="text-center py-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Invitación no válida</h2>
              <p className="text-sm text-slate-600 mt-2">
                {errorMsg ?? "El enlace ya no está disponible."}
              </p>
              <p className="text-sm text-slate-500 mt-4">
                Si crees que es un error, contacta a la persona que te invitó.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/">Volver al inicio</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Completa tu registro</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Configura tu cuenta para empezar a colaborar.
                </p>
              </div>

              <div className="rounded-lg bg-[#f0f4f8] border border-slate-200 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="h-4 w-4 text-[#0F2B8E]" />
                  <span className="font-medium">{invitacion.email}</span>
                </div>
                {invitacion.proyecto_nombre && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Building2 className="h-4 w-4 text-[#0F2B8E]" />
                    <span>
                      Proyecto: <span className="font-medium">{invitacion.proyecto_nombre}</span>
                    </span>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Rol: {invitacion.rol_invitado === "implementador" ? "Implementador" : "Invitado"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input
                    id="apellido"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="text-xs text-slate-500">Mínimo 8 caracteres.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <PasswordInput
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#0F2B8E] hover:bg-[#0b1e62]"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando cuenta…
                  </>
                ) : (
                  "Crear cuenta e ingresar"
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center pt-2">
                Al continuar aceptas los términos del servicio de EGIXIA.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}