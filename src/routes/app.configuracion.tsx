import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/admin-only";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { guardarConfiguracion, enviarCorreosPrueba } from "@/lib/admin.functions";

export const Route = createFileRoute("/app/configuracion")({ component: ConfiguracionGuarded });

function ConfiguracionGuarded() {
  return (
    <AdminOnly>
      <ConfiguracionPage />
    </AdminOnly>
  );
}

interface ConfigRow { clave: string; valor: Record<string, unknown> }

function ConfiguracionPage() {
  const { profile } = useAuth();
  const guardar = useServerFn(guardarConfiguracion);
  const enviarPrueba = useServerFn(enviarCorreosPrueba);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [branding, setBranding] = useState({
    nombre_app: "EGIXIA Configurator",
    logo_url: "",
    color_primario: "#0F2B8E",
    mensaje_bienvenida: "",
  });
  const [correo, setCorreo] = useState({
    from_nombre: "EGIXIA",
    from_email: "no-reply@egixia.com",
  });
  const [parametros, setParametros] = useState({
    dias_alerta_vencimiento: 3,
    autoguardado_debounce_ms: 800,
    bloquear_fines_semana_festivos: false,
    dias_recordatorio_inactividad: 5,
  });

  const esAdmin = profile?.rol === "admin";

  useEffect(() => {
    supabase
      .from("configuracion_sistema")
      .select("clave, valor")
      .then(({ data }) => {
        const rows = (data ?? []) as ConfigRow[];
        for (const r of rows) {
          if (r.clave === "branding") setBranding((b) => ({ ...b, ...(r.valor as any) }));
          if (r.clave === "correo") setCorreo((c) => ({ ...c, ...(r.valor as any) }));
          if (r.clave === "parametros") setParametros((p) => ({ ...p, ...(r.valor as any) }));
        }
        setLoading(false);
      });
  }, []);

  const submit = async (clave: "branding" | "correo" | "parametros", valor: unknown) => {
    setBusy(clave);
    try {
      await guardar({ data: { clave, valor: valor as Record<string, unknown> } });
      toast.success("Configuración guardada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally { setBusy(null); }
  };

  if (loading) {
    return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-muted" />;
  }

  const disabled = !esAdmin;

  const probarCorreos = async () => {
    setBusy("prueba");
    try {
      const r = await enviarPrueba();
      const okCount = r.resultados.filter((x) => x.ok).length;
      const failCount = r.resultados.length - okCount;
      if (failCount === 0) {
        toast.success(`Enviados ${okCount} correos a ${r.destinatario}.`);
      } else {
        const primerError = r.resultados.find((x) => !x.ok);
        toast.error(
          `Enviados ${okCount}/${r.resultados.length}. Error: ${primerError?.error ?? "desconocido"}`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la prueba.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {!esAdmin && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Solo un administrador puede modificar estas configuraciones.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Branding</h2>
        <p className="text-xs text-muted-foreground">
          Identidad visual global de la aplicación.
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Nombre de la aplicación">
            <Input value={branding.nombre_app} disabled={disabled}
              onChange={(e) => setBranding({ ...branding, nombre_app: e.target.value })} />
          </Field>
          <Field label="Logo (URL pública)">
            <Input value={branding.logo_url} disabled={disabled} placeholder="https://…"
              onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} />
          </Field>
          <Field label="Color primario">
            <Input type="color" className="h-10 w-24 p-1" value={branding.color_primario} disabled={disabled}
              onChange={(e) => setBranding({ ...branding, color_primario: e.target.value })} />
          </Field>
          <Field label="Mensaje de bienvenida">
            <Textarea rows={2} value={branding.mensaje_bienvenida} disabled={disabled}
              onChange={(e) => setBranding({ ...branding, mensaje_bienvenida: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => submit("branding", branding)} disabled={disabled || busy === "branding"}>
            {busy === "branding" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Guardar branding
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Integración de correo</h2>
        <p className="text-xs text-muted-foreground">
          Las llaves de API se configuran como secretos de la Edge Function
          <code className="mx-1 rounded bg-muted px-1 py-0.5">enviar-correo</code>
          y nunca se exponen al frontend.
        </p>
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Proveedor: Resend (configurado por el secreto <code className="rounded bg-muted px-1 py-0.5">RESEND_API_KEY</code>).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del remitente">
              <Input value={correo.from_nombre} disabled={disabled}
                onChange={(e) => setCorreo({ ...correo, from_nombre: e.target.value })} />
            </Field>
            <Field label="Correo del remitente">
              <Input type="email" value={correo.from_email} disabled={disabled}
                onChange={(e) => setCorreo({ ...correo, from_email: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => submit("correo", correo)} disabled={disabled || busy === "correo"}>
            {busy === "correo" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Guardar correo
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-sm text-foreground">Enviar correos de prueba</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Envía las 4 plantillas del portal (invitación, acta enviada,
                devolución con observaciones y aprobación) a tu correo de
                administrador usando Resend.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={probarCorreos} disabled={disabled || busy === "prueba"}>
              {busy === "prueba" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Enviar prueba
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Parámetros generales</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Días de alerta antes del vencimiento">
            <Input type="number" min={1} max={30} value={parametros.dias_alerta_vencimiento} disabled={disabled}
              onChange={(e) => setParametros({ ...parametros, dias_alerta_vencimiento: Number(e.target.value) })} />
          </Field>
          <Field label="Debounce de autoguardado (ms)">
            <Input type="number" min={200} max={5000} step={100}
              value={parametros.autoguardado_debounce_ms} disabled={disabled}
              onChange={(e) => setParametros({ ...parametros, autoguardado_debounce_ms: Number(e.target.value) })} />
          </Field>
          <Field label="Días de inactividad para recordatorio">
            <Input type="number" min={1} max={60} value={parametros.dias_recordatorio_inactividad} disabled={disabled}
              onChange={(e) => setParametros({ ...parametros, dias_recordatorio_inactividad: Number(e.target.value) })} />
            <p className="text-[11px] text-muted-foreground">
              Días sin avance en un módulo para incluir al proyecto en los
              recordatorios por correo a los invitados.
            </p>
          </Field>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-sm text-foreground">
                Bloquear fines de semana y festivos
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cuando está activado, el implementador y el administrador
                no podrán seleccionar sábados, domingos ni festivos de
                Colombia como fecha de vencimiento de un módulo.
              </p>
            </div>
            <Switch
              checked={parametros.bloquear_fines_semana_festivos}
              disabled={disabled}
              onCheckedChange={(v) =>
                setParametros({ ...parametros, bloquear_fines_semana_festivos: v })
              }
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => submit("parametros", parametros)} disabled={disabled || busy === "parametros"}>
            {busy === "parametros" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Guardar parámetros
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
