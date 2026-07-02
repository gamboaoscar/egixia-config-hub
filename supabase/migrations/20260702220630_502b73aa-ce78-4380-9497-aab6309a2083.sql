
-- Avatares: reemplazar SELECT abierto por uno acotado al dueño o al equipo interno
drop policy if exists "avatares_select_authenticated" on storage.objects;

create policy "avatares_select_own_o_equipo"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatares'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
  )
);

-- documentos/actas: al insertar, si no eres admin/implementador, el módulo
-- debe estar editable para ti (respeta el flujo de revisión).
drop policy if exists storage_egixia_insert on storage.objects;

create policy storage_egixia_insert on storage.objects for insert to authenticated
with check (
  bucket_id in ('logos-clientes','documentos','actas')
  and (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'implementador')
    or (
      public.is_project_member(auth.uid(), public.storage_proyecto_from_path(name))
      and (
        -- si el segundo segmento del path es un módulo, verificar edición
        (storage.foldername(name))[2] is null
        or public.puede_editar_modulo(
          auth.uid(),
          nullif((storage.foldername(name))[2], '')::uuid
        )
      )
    )
  )
);
