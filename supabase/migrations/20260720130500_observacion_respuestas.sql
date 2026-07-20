-- Respuestas a observaciones: canal bidireccional entre el cliente y el
-- equipo EGIXIA bajo cada observación de un módulo.
--
-- Mutaciones SOLO vía server function con service role: no hay políticas
-- INSERT/UPDATE/DELETE para `authenticated` (RLS niega por defecto).
CREATE TABLE public.observacion_respuestas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observacion_id uuid NOT NULL REFERENCES public.observaciones(id) ON DELETE CASCADE,
  autor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  mensaje text NOT NULL CHECK (char_length(mensaje) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_obs_respuestas_observacion
  ON public.observacion_respuestas(observacion_id);

GRANT SELECT ON public.observacion_respuestas TO authenticated;
GRANT ALL ON public.observacion_respuestas TO service_role;

ALTER TABLE public.observacion_respuestas ENABLE ROW LEVEL SECURITY;

-- Lectura: internos (admin/implementador) o miembros del proyecto al que
-- pertenece la observación.
CREATE POLICY obs_respuestas_select ON public.observacion_respuestas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'implementador')
    OR EXISTS (
      SELECT 1
      FROM public.observaciones o
      JOIN public.proyecto_modulos m ON m.id = o.proyecto_modulo_id
      WHERE o.id = observacion_id
        AND public.is_project_member(auth.uid(), m.proyecto_id)
    )
  );
