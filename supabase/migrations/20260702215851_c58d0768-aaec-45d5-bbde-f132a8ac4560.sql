
-- catalogo_overrides: overrides por proyecto+modulo+campo
CREATE TABLE public.catalogo_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  modulo_key text NOT NULL,
  campo_key text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  label text,
  guia jsonb,
  requerido boolean,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, modulo_key, campo_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_overrides TO authenticated;
GRANT ALL ON public.catalogo_overrides TO service_role;
ALTER TABLE public.catalogo_overrides ENABLE ROW LEVEL SECURITY;

-- Los invitados leen (solo) los overrides de sus proyectos para que la UI oculte campos.
CREATE POLICY "co_select_miembros_o_internos"
  ON public.catalogo_overrides FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'implementador')
    OR public.is_project_member(auth.uid(), proyecto_id)
  );

CREATE POLICY "co_ins_internos"
  ON public.catalogo_overrides FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'implementador')
  );

CREATE POLICY "co_upd_internos"
  ON public.catalogo_overrides FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'implementador')
  );

CREATE POLICY "co_del_admin"
  ON public.catalogo_overrides FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_co_updated
  BEFORE UPDATE ON public.catalogo_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- configuracion_sistema: clave-valor singleton
CREATE TABLE public.configuracion_sistema (
  clave text PRIMARY KEY,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracion_sistema TO authenticated;
GRANT ALL ON public.configuracion_sistema TO service_role;
ALTER TABLE public.configuracion_sistema ENABLE ROW LEVEL SECURITY;

-- Branding es leído por todos los autenticados (para pintar el logo en cualquier vista).
CREATE POLICY "cs_select_todos_autenticados"
  ON public.configuracion_sistema FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cs_upsert_admin"
  ON public.configuracion_sistema FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cs_update_admin"
  ON public.configuracion_sistema FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cs_delete_admin"
  ON public.configuracion_sistema FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_cs_updated
  BEFORE UPDATE ON public.configuracion_sistema
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.configuracion_sistema (clave, valor) VALUES
  ('branding', '{"logo_url": null, "nombre_app": "EGIXIA Configurator"}'::jsonb),
  ('correo',   '{"proveedor": "resend", "from_email": "no-reply@egixia.com", "from_nombre": "EGIXIA"}'::jsonb),
  ('parametros', '{"dias_validez_invitacion": 14, "site_url": "https://portal.egixia.com"}'::jsonb)
  ON CONFLICT (clave) DO NOTHING;
