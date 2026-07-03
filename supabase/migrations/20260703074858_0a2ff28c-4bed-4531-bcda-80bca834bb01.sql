
-- Permitir al invitado ver su propia invitación por token/email
DROP POLICY IF EXISTS inv_select ON public.invitaciones;

CREATE POLICY inv_select_admin
  ON public.invitaciones
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY inv_select_invitado
  ON public.invitaciones
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    AND estado = 'pendiente'
    AND expira_at > now()
  );

-- Permitir a miembros de un mismo proyecto ver los perfiles de sus pares
CREATE OR REPLACE FUNCTION public.comparten_proyecto(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.proyecto_miembros ma
      JOIN public.proyecto_miembros mb ON mb.proyecto_id = ma.proyecto_id
     WHERE ma.profile_id = _a
       AND mb.profile_id = _b
       AND ma.estado = 'activo'
       AND mb.estado = 'activo'
  );
$$;

REVOKE ALL ON FUNCTION public.comparten_proyecto(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comparten_proyecto(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS profiles_select_own_or_privileged ON public.profiles;

CREATE POLICY profiles_select_own_or_privileged
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'implementador'::app_role)
    OR public.comparten_proyecto(auth.uid(), id)
  );
