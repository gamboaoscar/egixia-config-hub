import type { ModuloDefinicion } from "../tipos";

/**
 * Módulo General — Verificación y Cumplimiento (key: 'verificacion_cumplimiento').
 *
 * Configura el motor de verificación de proveedores contra listas
 * restrictivas (LAFT/SAGRILAFT): proveedor del servicio, entidades que se
 * validan, reglas de filtro y alcance de alertas. Los parámetros técnicos
 * (URL del webservice, correo del oficial de cumplimiento, ambiente y
 * manual) suelen definirse por cliente durante la implementación.
 */
export const MODULO_VERIFICACION_CUMPLIMIENTO: ModuloDefinicion = {
  key: "verificacion_cumplimiento",
  nombre: "Verificación y Cumplimiento",
  descripcion:
    "Configura el motor de verificación de proveedores contra listas restrictivas (LAFT/SAGRILAFT) y sus reglas de alerta.",
  secciones: [
    // -------- 1. Servicio de verificación --------
    {
      key: "servicio",
      titulo: "Servicio de verificación",
      campos: [
        {
          key: "proveedor_servicio",
          label: "Proveedor del servicio",
          tipo: "select",
          requerido: true,
          opciones: [
            { valor: "inspektor", etiqueta: "Inspektor" },
            { valor: "risk_compliance", etiqueta: "Risk & Compliance" },
            { valor: "informa_datalaft", etiqueta: "Informa (DATALAFT)" },
            { valor: "otro", etiqueta: "Otro" },
          ],
          guia: {
            que: "Empresa que presta el servicio de verificación contra listas restrictivas.",
            formato: "Selecciona una opción. Usa 'Otro' si no aparece.",
          },
        },
      ],
    },
    // -------- 2. Entidades a verificar --------
    {
      key: "entidades",
      titulo: "Entidades a verificar",
      descripcion: "Actores del proceso que se validan contra listas.",
      campos: [
        {
          key: "entidades_verificar",
          label: "Entidades a verificar",
          tipo: "checkbox_multiple",
          requerido: true,
          opciones: [
            { valor: "proveedor_tercero", etiqueta: "Proveedor / tercero" },
            { valor: "representante_legal", etiqueta: "Representante legal" },
            { valor: "accionistas", etiqueta: "Accionistas" },
            { valor: "beneficiarios_finales", etiqueta: "Beneficiarios finales" },
          ],
          guia: {
            que: "Marca cada actor que el motor validará contra las listas restrictivas.",
          },
        },
      ],
    },
    // -------- 3. Reglas y alertas --------
    {
      key: "reglas",
      titulo: "Reglas y alertas",
      campos: [
        {
          key: "criterios_filtro",
          label: "Criterios de filtro",
          tipo: "textarea",
          placeholder:
            "Ej.: verificar solo proveedores con contratos activos o compras superiores a cierto monto.",
          guia: {
            que: "Reglas que determinan qué registros se envían a verificación.",
          },
        },
        {
          key: "alcance_alertas",
          label: "Alcance de alertas",
          tipo: "radio_tarjetas",
          opciones: [
            {
              valor: "riesgo_real",
              etiqueta: "Solo listas que generan riesgo real",
              descripcion:
                "El portal solo notifica coincidencias en listas que implican un riesgo relevante de cumplimiento.",
            },
            {
              valor: "todas",
              etiqueta: "Todas las coincidencias",
              descripcion:
                "El portal notifica cualquier coincidencia detectada, sin importar la lista.",
            },
          ],
          guia: {
            que: "Qué coincidencias generarán alerta para el equipo de cumplimiento.",
          },
        },
      ],
    },
    // -------- 4. Parámetros técnicos (por proyecto) --------
    {
      key: "tecnico",
      titulo: "Parámetros técnicos (por proyecto — opcional)",
      descripcion:
        "Estos datos suelen definirse por cliente durante la implementación; déjalos vacíos si aún no aplican.",
      campos: [
        {
          key: "tecnico_info",
          label: "Sobre estos parámetros",
          tipo: "info",
          aviso:
            "Estos valores no son estándar: se definen por proyecto durante la implementación con el equipo de EGIXIA. Si aún no los tienes, deja los campos vacíos.",
        },
        {
          key: "url_webservice",
          label: "URL del webservice",
          tipo: "url",
          placeholder: "https://api.proveedor-verificacion.com/...",
          guia: {
            que: "Endpoint del servicio de verificación que se integrará con el portal.",
            formato: "URL que comienza con https://",
          },
        },
        {
          key: "correo_laft",
          label: "Correo del oficial de cumplimiento (LAFT)",
          tipo: "email",
          placeholder: "cumplimiento@tuempresa.com",
          guia: {
            que: "Correo del oficial de cumplimiento que recibirá las alertas.",
            formato: "Correo corporativo válido.",
          },
        },
        {
          key: "ambiente_inicial",
          label: "Ambiente inicial",
          tipo: "select",
          opciones: [
            { valor: "pruebas", etiqueta: "Pruebas" },
            { valor: "produccion", etiqueta: "Producción" },
          ],
          guia: {
            que: "Ambiente en el que se habilitará inicialmente la verificación.",
          },
        },
        {
          key: "manual_tecnico",
          label: "Manual técnico",
          tipo: "archivo",
          archivo: {
            bucket: "documentos",
            formatosPermitidos: ["application/pdf", ".pdf"],
            tamanoMaxMB: 10,
          },
          guia: {
            que: "Manual técnico del servicio de verificación, si lo tienes.",
            formato: "PDF.",
          },
        },
      ],
    },
  ],
};
