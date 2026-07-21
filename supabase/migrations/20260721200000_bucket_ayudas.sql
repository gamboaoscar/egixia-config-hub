-- ============================================================
-- Bucket privado `ayudas` — imágenes de guía por campo
-- (funcionalidad "Ayuda enriquecida por campo").
--
-- Convención de ruta:
--   {proyecto_id}/{modulo_key}/{campo_key}/{timestamp}-{archivo}
--
-- Reglas (mismo patrón que los buckets logos-clientes/documentos/actas):
--   - INSERT/UPDATE/DELETE: solo usuarios internos (admin/implementador).
--   - SELECT: internos, o miembros activos del proyecto cuyo uuid es el
--     primer segmento del path (`storage_proyecto_from_path` / split_part).
-- ============================================================

insert into storage.buckets (id, name, public)
select 'ayudas', 'ayudas', false
where not exists (select 1 from storage.buckets where id = 'ayudas');

drop policy if exists ayudas_select on storage.objects;
create policy ayudas_select on storage.objects for select to authenticated
  using (
    bucket_id = 'ayudas'
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'implementador')
      or public.is_project_member(auth.uid(), public.storage_proyecto_from_path(name))
    )
  );

drop policy if exists ayudas_insert on storage.objects;
create policy ayudas_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ayudas'
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'implementador')
    )
  );

drop policy if exists ayudas_update on storage.objects;
create policy ayudas_update on storage.objects for update to authenticated
  using (
    bucket_id = 'ayudas'
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'implementador')
    )
  );

drop policy if exists ayudas_delete on storage.objects;
create policy ayudas_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'ayudas'
    and (
      public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'implementador')
    )
  );
