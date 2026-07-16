-- M7+M8: Parametrización por proyecto — overrides de sección y opciones permitidas

-- 1. Nueva columna en catalogo_overrides para restringir opciones de campos multi-select
ALTER TABLE public.catalogo_overrides
  ADD COLUMN IF NOT EXISTS opciones_permitidas text[] NULL;

-- 2. Tabla de overrides por sección
CREATE TABLE public.catalogo_overrides_seccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  modulo_key text NOT NULL,
  seccion_key text NOT NULL,
  habilitada boolean NOT NULL DEFAULT true,
  obligatoria boolean NULL,
  updated_by uuid NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proyecto_id, modulo_key, seccion_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_overrides_seccion TO authenticated;
GRANT ALL ON public.catalogo_overrides_seccion TO service_role;

ALTER TABLE public.catalogo_overrides_seccion ENABLE ROW LEVEL SECURITY;

-- SELECT: internos (admin/implementador) o miembros del proyecto
CREATE POLICY "cos_select_internos_o_miembro"
  ON public.catalogo_overrides_seccion
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'implementador'::public.app_role)
    OR public.is_project_member(auth.uid(), proyecto_id)
  );

-- INSERT: solo internos
CREATE POLICY "cos_insert_internos"
  ON public.catalogo_overrides_seccion
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'implementador'::public.app_role)
  );

-- UPDATE: solo internos
CREATE POLICY "cos_update_internos"
  ON public.catalogo_overrides_seccion
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'implementador'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'implementador'::public.app_role)
  );

-- DELETE: solo admin
CREATE POLICY "cos_delete_admin"
  ON public.catalogo_overrides_seccion
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger de updated_at
CREATE TRIGGER trg_cos_updated_at
  BEFORE UPDATE ON public.catalogo_overrides_seccion
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();