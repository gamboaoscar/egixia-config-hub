import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const MAX_MB = 2;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export function MiPerfil() {
  const { profile, avatarUrl, refreshProfile } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [cargo, setCargo] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre ?? "");
      setApellido(profile.apellido ?? "");
      setCargo(profile.cargo ?? "");
      setEmpresa(profile.empresa ?? "");
    }
  }, [profile]);

  if (!profile) return null;

  const handleGuardar = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nombre, apellido, cargo: cargo || null, empresa: empresa || null })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(`No se pudo guardar: ${error.message}`);
      return;
    }
    toast.success("Perfil actualizado");
    await refreshProfile();
  };

  const handleAvatar = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato no permitido. Usa PNG, JPG o WEBP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo excede ${MAX_MB} MB.`);
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatares")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error(`No se pudo subir la imagen: ${upErr.message}`);
      return;
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ foto_perfil: path })
      .eq("id", profile.id);
    setUploading(false);
    if (updErr) {
      toast.error(`No se pudo actualizar el perfil: ${updErr.message}`);
      return;
    }
    toast.success("Foto actualizada");
    await refreshProfile();
  };

  const handleReset = async () => {
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error(`No se pudo enviar el correo: ${error.message}`);
      return;
    }
    toast.success("Te enviamos un correo para cambiar tu contraseña.");
  };

  const initials = `${(profile.nombre?.[0] ?? "").toUpperCase()}${
    (profile.apellido?.[0] ?? "").toUpperCase()
  }` || profile.email[0]?.toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Mi perfil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Actualiza tu información personal y tu foto.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="Foto de perfil" /> : null}
              <AvatarFallback className="bg-primary-soft text-primary text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-card transition-colors hover:bg-primary-dark disabled:opacity-50"
              disabled={uploading}
              aria-label="Cambiar foto"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ALLOWED.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatar(f);
                e.target.value = "";
              }}
            />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              PNG, JPG o WEBP. Máximo {MAX_MB} MB.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Información personal</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellido">Apellido</Label>
            <Input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input id="cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa</Label>
            <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" /> Correo (no editable)
            </Label>
            <Input id="email" value={profile.email} readOnly disabled />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleGuardar} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground">Contraseña</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Por seguridad, la contraseña se cambia mediante un enlace que enviamos a tu
          correo <strong>{profile.email}</strong>.
        </p>
        <div className="mt-6">
          <Button variant="outline" onClick={handleReset} disabled={sendingReset}>
            {sendingReset ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Enviarme correo para cambiar contraseña
          </Button>
        </div>
      </section>
    </div>
  );
}