
-- Prevent role escalation via profiles UPDATE policy
DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND rol = (SELECT p.rol FROM public.profiles p WHERE p.id = auth.uid())
    AND estado = (SELECT p.estado FROM public.profiles p WHERE p.id = auth.uid())
    AND email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
-- They are used inside RLS policies and triggers (called via the SQL planner),
-- and from trusted server code via the service role, so no direct client access is needed.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.puede_editar_modulo(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.destinatarios_notificacion(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.registrar_auditoria(text, text, text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.autocompletar_proyecto() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.profiles_guard_privileged_fields() FROM anon, authenticated, public;

-- validar_invitacion remains callable by anon/authenticated by design:
-- the public /invitacion/:token page must look up invitation metadata before signup.
