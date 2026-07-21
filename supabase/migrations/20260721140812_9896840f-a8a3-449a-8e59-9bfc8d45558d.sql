
-- catalogo_overrides
DROP POLICY IF EXISTS co_del_admin ON public.catalogo_overrides;
CREATE POLICY co_del_admin ON public.catalogo_overrides
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS co_select_miembros_o_internos ON public.catalogo_overrides;
CREATE POLICY co_select_miembros_o_internos ON public.catalogo_overrides
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'implementador'::public.app_role)
    OR public.is_project_member(auth.uid(), proyecto_id)
  );

-- configuracion_sistema
DROP POLICY IF EXISTS cs_delete_admin ON public.configuracion_sistema;
CREATE POLICY cs_delete_admin ON public.configuracion_sistema
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS cs_update_admin ON public.configuracion_sistema;
CREATE POLICY cs_update_admin ON public.configuracion_sistema
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS cs_upsert_admin ON public.configuracion_sistema;
CREATE POLICY cs_upsert_admin ON public.configuracion_sistema
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
