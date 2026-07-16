DROP POLICY IF EXISTS cs_select_todos_autenticados ON public.configuracion_sistema;

CREATE POLICY cs_select_parametros_o_interno
ON public.configuracion_sistema
FOR SELECT
TO authenticated
USING (
  clave = 'parametros'
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'implementador'::public.app_role)
);