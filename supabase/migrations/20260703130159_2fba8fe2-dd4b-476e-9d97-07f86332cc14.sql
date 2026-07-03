-- Fix infinite recursion in profiles_update_self policy.
-- Los subqueries `SELECT ... FROM profiles` dentro del WITH CHECK re-entran a
-- las políticas RLS de la misma tabla y provocan recursión infinita al hacer
-- UPDATE. La protección de campos privilegiados (email, rol, estado) ya la
-- garantiza el trigger `profiles_guard_privileged_fields`, así que basta con
-- exigir que el usuario solo pueda actualizar su propia fila.

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;

CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
