
-- 1) Revoke EXECUTE from anon/authenticated on validar_invitacion (moves the call server-side).
REVOKE EXECUTE ON FUNCTION public.validar_invitacion(text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_invitacion(text) TO service_role;

-- 2) Restrict invitation token visibility to admins only.
DROP POLICY IF EXISTS inv_select ON public.invitaciones;
CREATE POLICY inv_select ON public.invitaciones
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Attach the profiles privileged-fields guard trigger (defense-in-depth against role escalation).
DROP TRIGGER IF EXISTS profiles_guard_privileged_fields_trg ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_privileged_fields();

-- 4) Restrict storage UPDATE on egixia buckets to admin/implementador (was permissive to any project member).
DROP POLICY IF EXISTS storage_egixia_update ON storage.objects;
CREATE POLICY storage_egixia_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = ANY (ARRAY['logos-clientes'::text, 'documentos'::text, 'actas'::text])
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'implementador'::app_role)
    )
  );
