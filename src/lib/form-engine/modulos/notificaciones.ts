import type { ModuloDefinicion } from "../tipos";

/**
 * Módulo General — Notificaciones y comunicaciones.
 *
 * Define cómo el Portal de Proveedores se comunicará con los proveedores
 * del cliente: la identidad del remitente de los correos, los eventos del
 * portal que disparan una notificación automática y los textos
 * personalizados (saludo, firma y canal de soporte). Si el cliente no
 * personaliza los textos, el portal usa el copy estándar de EGIXIA.
 *
 * Nota: el dominio del correo remitente debe verificarse (SPF/DKIM) antes
 * de la salida en vivo; EGIXIA acompaña ese paso.
 */
export const MODULO_NOTIFICACIONES: ModuloDefinicion = {
  key: "notificaciones",
  nombre: "Notificaciones y comunicaciones",
  descripcion:
    "Cómo se comunicará el portal con tus proveedores: remitente, textos y recordatorios.",
  secciones: [
    // -------- 1. Remitente de los correos ------------------------------
    {
      key: "remitente",
      titulo: "Remitente de los correos",
      descripcion:
        "Con qué identidad llegarán los correos del portal a tus proveedores.",
      campos: [
        {
          key: "nombre_remitente",
          label: "Nombre del remitente",
          tipo: "texto",
          requerido: true,
          placeholder: "Ej.: Compras ACME",
          guia: {
            que: "Nombre visible en el 'De' de los correos",
          },
        },
        {
          key: "correo_remitente",
          label: "Correo del remitente",
          tipo: "email",
          requerido: true,
          guia: {
            que: "Correo desde el que se enviarán las notificaciones. Debe ser un dominio que puedas verificar.",
          },
        },
        {
          key: "remitente_info",
          label: "Verificación del dominio",
          tipo: "info",
          aviso:
            "El dominio del correo remitente debe verificarse (SPF/DKIM) antes de la salida en vivo. EGIXIA te guiará en ese paso.",
        },
      ],
    },
    // -------- 2. Eventos que notifican ---------------------------------
    {
      key: "eventos",
      titulo: "Eventos que notifican",
      descripcion:
        "Qué acciones del portal disparan un correo automático al proveedor.",
      campos: [
        {
          key: "eventos",
          label: "Eventos que envían correo",
          tipo: "checkbox_multiple",
          opciones: [
            { valor: "registro", etiqueta: "Registro / bienvenida" },
            { valor: "solicitud", etiqueta: "Nueva solicitud de cotización" },
            { valor: "orden", etiqueta: "Orden de compra emitida" },
            { valor: "doc_por_vencer", etiqueta: "Documento por vencer" },
            { valor: "doc_vencido", etiqueta: "Documento vencido" },
            { valor: "pago", etiqueta: "Notificación de pago" },
          ],
          guia: {
            que: "Marca los eventos que enviarán correo automático.",
          },
        },
        {
          key: "frecuencia_recordatorio",
          label: "Frecuencia de recordatorios (días)",
          tipo: "numero",
          placeholder: "7",
          validacion: { min: 0 },
          guia: {
            que: "Cada cuántos días recordar documentos o tareas pendientes. 0 = sin recordatorios.",
          },
        },
      ],
    },
    // -------- 3. Textos personalizados (opcional) ----------------------
    {
      key: "textos",
      titulo: "Textos personalizados (opcional)",
      descripcion:
        "Mensajes propios para los correos clave. Si lo dejas vacío, se usa el texto estándar de EGIXIA.",
      campos: [
        {
          key: "saludo",
          label: "Saludo",
          tipo: "textarea",
          guia: {
            que: "Encabezado/saludo para los correos a proveedores",
          },
        },
        {
          key: "firma",
          label: "Firma",
          tipo: "textarea",
          guia: {
            que: "Firma o pie de los correos (nombre del área, datos de contacto)",
          },
        },
        {
          key: "canal_soporte",
          label: "Canal de soporte",
          tipo: "texto",
          guia: {
            que: "Correo o canal donde el proveedor puede pedir ayuda",
          },
        },
      ],
    },
  ],
};
