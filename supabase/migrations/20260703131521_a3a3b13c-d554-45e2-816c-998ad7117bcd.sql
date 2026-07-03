
-- Helper SECURITY DEFINER para comparar campos privilegiados sin recursión de RLS
CREATE OR REPLACE FUNCTION public.profile_privileged_unchanged(
  _id uuid,
  _new_rol public.app_role,
  _new_estado public.user_estado,
  _new_email text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _id
      AND rol = _new_rol
      AND estado = _new_estado
      AND email = _new_email
  );
$$;

REVOKE ALL ON FUNCTION public.profile_privileged_unchanged(uuid, public.app_role, public.user_estado, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_privileged_unchanged(uuid, public.app_role, public.user_estado, text) TO authenticated;

-- Reemplaza profiles_update_self con column-level check
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.profile_privileged_unchanged(id, rol, estado, email)
    )
  );

-- Restringe storage_egixia_update a authenticated
DROP POLICY IF EXISTS storage_egixia_update ON storage.objects;
CREATE POLICY storage_egixia_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['logos-clientes'::text, 'documentos'::text, 'actas'::text])
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'implementador'::public.app_role)
    )
  );
