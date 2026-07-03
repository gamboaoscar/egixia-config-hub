
-- Reemplaza el uso de comparten_proyecto en la política inlineando el EXISTS
DROP POLICY IF EXISTS profiles_select_own_or_privileged ON public.profiles;

CREATE POLICY profiles_select_own_or_privileged
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'implementador'::app_role)
    OR EXISTS (
      SELECT 1
        FROM public.proyecto_miembros ma
        JOIN public.proyecto_miembros mb ON mb.proyecto_id = ma.proyecto_id
       WHERE ma.profile_id = auth.uid()
         AND mb.profile_id = public.profiles.id
         AND ma.estado = 'activo'
         AND mb.estado = 'activo'
    )
  );

-- Revoca EXECUTE de la función SECURITY DEFINER para anon y authenticated
REVOKE EXECUTE ON FUNCTION public.comparten_proyecto(uuid, uuid) FROM PUBLIC, anon, authenticated;
