-- Simplify profiles_update_self policy: the profiles_guard_privileged_fields
-- trigger already blocks changes to email/rol/estado for non-admins, so the
-- WITH CHECK does not need profile_privileged_unchanged. Removing the helper
-- function eliminates a SECURITY DEFINER surface exposed to anon/authenticated.

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP FUNCTION IF EXISTS public.profile_privileged_unchanged(uuid, public.app_role, public.user_estado, text);