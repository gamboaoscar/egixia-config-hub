-- Admins e implementadores necesitan ver todos los perfiles (pantalla de Usuarios).
DROP POLICY IF EXISTS profiles_select_internal ON public.profiles;
CREATE POLICY profiles_select_internal ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'implementador'::public.app_role)
  );