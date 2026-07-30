import type { ModuloDefinicion } from "../tipos";

/**
 * Módulo General — Matriz documental de proveedores.
 *
 * Define qué documentos exigirá el portal a los proveedores según su
 * tipo (clasificación definida por el cliente), con obligatoriedad,
 * vigencia y políticas de renovación. La relación documento → tipos se
 * captura en texto libre (columna `aplica_a`) usando los nombres
 * definidos en la sección "Tipos de proveedor".
 */
export const MODULO_MATRIZ_DOCUMENTAL: ModuloDefinicion = {
  key: "matriz_documental",
  nombre: "Registro de Proveedores",
  descripcion:
    "Define cómo se registran tus proveedores en el portal: formularios por tipo, documentos exigidos, preguntas PEP y responsables.",
  secciones: [
    // -------- 1. Tipos de proveedor --------
    {
      key: "tipos_proveedor",
      titulo: "Tipos de proveedor",
      descripcion:
        "Cómo clasificas a tus proveedores. Cada documento de la matriz aplicará a uno o varios de estos tipos.",
      campos: [
        {
          key: "tipos_info",
          label: "Ejemplos de tipos de proveedor",
          tipo: "info",
          aviso:
            "Ejemplos habituales: Nacional de bienes, Nacional de servicios, Proveedor del exterior, Persona natural.",
        },
        {
          key: "tabla_tipos",
          label: "Tipos de proveedor",
          tipo: "tabla",
          requerido: true,
          columnas: [
            {
              key: "nombre",
              label: "Nombre",
              tipo: "texto",
              requerido: true,
              placeholder: "Ej.: Nacional — bienes",
              guia: {
                que: "Nombre corto del tipo de proveedor. Lo usarás en la matriz para indicar a quién aplica cada documento.",
              },
            },
            {
              key: "descripcion",
              label: "Descripción",
              tipo: "texto",
              guia: {
                que: "Cuándo aplica esta clasificación.",
              },
            },
          ],
          guia: {
            que: "Una fila por cada tipo de proveedor que maneja tu organización.",
            formato: "Añade al menos un tipo.",
          },
        },
      ],
    },
    // -------- 2. Plantilla de proveedores --------
    {
      key: "plantilla",
      titulo: "Plantilla de proveedores",
      descripcion: "Plantilla oficial para la carga de datos de proveedores.",
      campos: [
        {
          key: "plantilla_info",
          label: "Plantillas oficiales de proveedores",
          tipo: "info",
          aviso:
            "Descarga la plantilla oficial, diligénciala y luego cárgala en el campo de abajo.",
          descargas: [
            {
              etiqueta: "Plantilla de creación de proveedores (V8.0)",
              url: "/plantillas/PlantillaCreacionProveedoresV8.0.xlsx",
            },
            {
              etiqueta: "Plantilla de actualización de proveedores (V6.0)",
              url: "/plantillas/PlantillaActualizacionProveedorV6.0.xlsx",
            },
          ],
        },
        {
          key: "plantilla_proveedores",
          label: "Plantilla de proveedores",
          tipo: "archivo",
          requerido: true,
          archivo: {
            bucket: "documentos",
            formatosPermitidos: [
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ".xlsx",
              ".xls",
            ],
            tamanoMaxMB: 10,
          },
          guia: {
            que: "Archivo base para la carga de datos del proveedor.",
            formato: "Excel (.xlsx o .xls).",
          },
        },
      ],
    },
    // -------- 3. Documentos exigidos --------
    {
      key: "documentos",
      titulo: "Documentos exigidos",
      descripcion:
        "La matriz de documentos que el proveedor deberá cargar al registrarse en el portal.",
      campos: [
        {
          key: "documentos_info",
          label: "Documentos frecuentes",
          tipo: "info",
          aviso:
            "Documentos frecuentes en Colombia: RUT, Certificado de Cámara de Comercio (no mayor a 90 días), certificación bancaria, estados financieros, certificado SG-SST, certificaciones de calidad (ISO).",
        },
        {
          key: "tabla_documentos",
          label: "Documentos de la matriz",
          tipo: "tabla",
          requerido: true,
          columnas: [
            {
              key: "documento",
              label: "Documento",
              tipo: "texto",
              requerido: true,
              placeholder: "Ej.: RUT actualizado",
              guia: {
                que: "Nombre del documento que el proveedor deberá cargar en el portal.",
              },
            },
            {
              key: "aplica_a",
              label: "Aplica a",
              tipo: "texto",
              requerido: true,
              guia: {
                que: "Tipos de proveedor a los que aplica, separados por coma. Usa los nombres definidos en la sección anterior. Escribe 'Todos' si aplica a todos.",
              },
            },
            {
              key: "obligatorio",
              label: "Obligatoriedad",
              tipo: "select",
              requerido: true,
              opciones: [
                {
                  valor: "obligatorio",
                  etiqueta: "Obligatorio para activar al proveedor",
                },
                { valor: "opcional", etiqueta: "Opcional" },
              ],
              guia: {
                que: "Si el documento es indispensable para activar al proveedor en el portal o solo complementario.",
              },
            },
            {
              key: "vigencia",
              label: "Vigencia",
              tipo: "select",
              requerido: true,
              opciones: [
                { valor: "no_vence", etiqueta: "No vence" },
                { valor: "seis_meses", etiqueta: "6 meses" },
                { valor: "un_ano", etiqueta: "1 año" },
                { valor: "dos_anos", etiqueta: "2 años" },
                {
                  valor: "personalizada",
                  etiqueta: "Otra (indícala en notas)",
                },
              ],
              guia: {
                que: "Cada cuánto vence el documento y el proveedor debe renovarlo en el portal.",
              },
            },
            {
              key: "notas",
              label: "Notas",
              tipo: "texto",
              guia: {
                que: "Aclaraciones del documento: vigencias especiales, condiciones o excepciones.",
              },
            },
          ],
          guia: {
            que: "Una fila por cada documento que exigirás a los proveedores.",
            formato: "Añade al menos un documento.",
          },
        },
      ],
    },
    // -------- 4. Tipos de formulario --------
    {
      key: "tipos_formulario",
      titulo: "Tipos de formulario",
      descripcion:
        "Variantes del formulario de registro según la categoría del proveedor.",
      campos: [
        {
          key: "tipos_formulario",
          label: "Formularios habilitados",
          tipo: "checkbox_multiple",
          requerido: true,
          opciones: [
            { valor: "juridica_nacional", etiqueta: "Persona Jurídica Nacional" },
            { valor: "natural_nacional", etiqueta: "Persona Natural Nacional" },
            {
              valor: "juridica_internacional",
              etiqueta: "Persona Jurídica Internacional",
            },
            {
              valor: "natural_internacional",
              etiqueta: "Persona Natural Internacional",
            },
          ],
          guia: {
            que: "Marca las variantes del formulario de registro que habilitarás en el portal.",
          },
        },
      ],
    },
    // -------- 5. Tipo de acceso --------
    {
      key: "tipo_acceso",
      titulo: "Tipo de acceso",
      descripcion: "Cómo pueden registrarse los proveedores.",
      campos: [
        {
          key: "tipo_acceso",
          label: "Modalidades de registro habilitadas",
          tipo: "checkbox_multiple",
          requerido: true,
          opciones: [
            {
              valor: "landing_publica",
              etiqueta: "Landing pública (registro abierto)",
            },
            {
              valor: "por_invitacion",
              etiqueta: "Registro por invitación (correo con paquete de documentos)",
            },
          ],
          guia: {
            que: "Marca las formas en que un proveedor podrá iniciar su registro en el portal.",
          },
        },
      ],
    },
    // -------- 6. Preguntas PEP --------
    {
      key: "pep",
      titulo: "Preguntas PEP",
      descripcion:
        "Cuestionario de Persona Expuesta Políticamente que verá el proveedor (si aplica).",
      campos: [
        {
          key: "pep_info",
          label: "Sobre las preguntas PEP",
          tipo: "info",
          aviso:
            "Las preguntas PEP (Persona Expuesta Políticamente) son obligatorias para ciertos proveedores según la normativa de conocimiento del tercero. Define aquí las preguntas que verá el proveedor durante el registro.",
        },
        {
          key: "tabla_pep",
          label: "Preguntas PEP",
          tipo: "tabla",
          columnas: [
            {
              key: "pregunta",
              label: "Pregunta",
              tipo: "texto",
              requerido: true,
              guia: {
                que: "Texto de la pregunta PEP que verá el proveedor.",
              },
            },
            {
              key: "texto_observacion",
              label: "Texto de observación",
              tipo: "texto",
              guia: {
                que: "Aclaración o ayuda que acompaña a la pregunta (opcional).",
              },
            },
            {
              key: "obligatoria",
              label: "Obligatoria",
              tipo: "select",
              requerido: true,
              opciones: [
                { valor: "si", etiqueta: "Sí" },
                { valor: "no", etiqueta: "No" },
              ],
              guia: {
                que: "Si el proveedor está obligado a responder la pregunta para completar el registro.",
              },
            },
          ],
          guia: {
            que: "Una fila por cada pregunta PEP del cuestionario.",
          },
        },
      ],
    },
    // -------- 7. Términos de registro --------
    {
      key: "terminos_registro",
      titulo: "Términos de registro",
      descripcion: "Documento que el proveedor acepta al registrarse.",
      campos: [
        {
          key: "terminos_registro",
          label: "Términos y condiciones de registro",
          tipo: "archivo",
          archivo: {
            bucket: "documentos",
            formatosPermitidos: ["application/pdf", ".pdf"],
            tamanoMaxMB: 10,
          },
          guia: {
            que: "Documento de términos y condiciones que el proveedor acepta al registrarse.",
            formato: "PDF.",
          },
        },
      ],
    },
    // -------- 8. Correos responsables --------
    {
      key: "responsables_registro",
      titulo: "Correos responsables",
      descripcion:
        "Buzones internos que reciben notificación de cada nuevo registro.",
      campos: [
        {
          key: "tabla_responsables",
          label: "Responsables de registro",
          tipo: "tabla",
          columnas: [
            {
              key: "correo",
              label: "Correo",
              tipo: "email",
              requerido: true,
              placeholder: "responsable@tuempresa.com",
              guia: {
                que: "Buzón interno que recibirá la notificación de nuevos registros.",
                formato: "Correo corporativo válido.",
              },
            },
            {
              key: "notifica",
              label: "Qué recibe",
              tipo: "texto",
              guia: {
                que: "Qué tipo de registros o notificaciones recibe este buzón.",
              },
            },
          ],
          guia: {
            que: "Una fila por cada buzón que recibirá notificación de nuevos registros.",
          },
        },
      ],
    },
    // -------- 9. Políticas de la matriz --------
    {
      key: "politicas",
      titulo: "Políticas de la matriz",
      campos: [
        {
          key: "aviso_renovacion_dias",
          label: "Días de aviso antes del vencimiento",
          tipo: "numero",
          requerido: true,
          placeholder: "30",
          validacion: { min: 1 },
          guia: {
            que: "Con cuántos días de anticipación se avisará al proveedor que un documento está por vencer.",
            formato: "Número entero mayor o igual a 1.",
          },
        },
        {
          key: "bloquear_vencidos",
          label: "Documentos vencidos",
          tipo: "radio_tarjetas",
          requerido: true,
          opciones: [
            {
              valor: "bloquear",
              etiqueta: "Bloquear al proveedor con documentos vencidos",
              descripcion:
                "El proveedor no podrá participar en procesos hasta renovar los documentos vencidos.",
            },
            {
              valor: "avisar",
              etiqueta: "Solo avisar sin bloquear",
              descripcion:
                "El proveedor recibe recordatorios pero sigue operando con normalidad.",
            },
          ],
          guia: {
            que: "Qué hará el portal cuando un proveedor tenga documentos vencidos.",
          },
        },
        {
          key: "responsable_correo",
          label: "Correo del responsable de validación",
          tipo: "email",
          requerido: true,
          placeholder: "responsable@tuempresa.com",
          guia: {
            que: "Correo del responsable en tu equipo de validar los documentos que carguen los proveedores.",
            formato: "Correo corporativo válido.",
          },
        },
      ],
    },
  ],
};