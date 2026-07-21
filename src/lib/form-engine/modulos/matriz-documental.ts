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
  nombre: "Matriz documental de proveedores",
  descripcion:
    "Define qué documentos exigirá tu portal a los proveedores, según su tipo, con obligatoriedad y vigencia.",
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
    // -------- 2. Documentos exigidos --------
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
    // -------- 3. Políticas de la matriz --------
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
