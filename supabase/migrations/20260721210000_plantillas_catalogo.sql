-- Plantillas de parametrización del catálogo + parámetro de recordatorios
-- (2026-07-21)

-- 1) Tabla `plantillas_catalogo`: snapshot reutilizable de la
--    parametrización (overrides de campos y secciones) de un proyecto.
CREATE TABLE IF NOT EXISTS public.plantillas_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text NULL,
  contenido jsonb NOT NULL,
  creado_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plantillas_catalogo TO authenticated;
GRANT ALL ON public.plantillas_catalogo TO service_role;

ALTER TABLE public.plantillas_catalogo ENABLE ROW LEVEL SECURITY;

-- Solo el equipo interno (admin/implementador) lee las plantillas.
-- Sin políticas de INSERT/UPDATE/DELETE a propósito: toda mutación pasa
-- por server functions con service role (guardar/aplicar/eliminar).
DROP POLICY IF EXISTS pc_select_internos ON public.plantillas_catalogo;
CREATE POLICY pc_select_internos
  ON public.plantillas_catalogo FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'implementador')
  );

-- 2) Parámetro `dias_recordatorio_inactividad` (default 5) para los
--    recordatorios a clientes con módulos sin avance. Solo se añade si
--    la clave no existe todavía.
UPDATE public.configuracion_sistema
SET valor = jsonb_set(valor, '{dias_recordatorio_inactividad}', '5'::jsonb, true)
WHERE clave = 'parametros'
  AND NOT (valor ? 'dias_recordatorio_inactividad');
