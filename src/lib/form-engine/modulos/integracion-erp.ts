import type { ModuloDefinicion } from "../tipos";

/**
 * Módulo General — Integración ERP / SAP.
 *
 * Recoge los datos técnicos necesarios para conectar el Portal de
 * Proveedores con el ERP del cliente (SAP u otro). Está pensado para
 * ser diligenciado por el equipo de TI del cliente y puede ocultarse
 * por proyecto (parametrización M8) cuando el alcance contratado no
 * incluye integración con ERP.
 *
 * Nota de seguridad: el formulario NO solicita contraseñas, tokens ni
 * llaves privadas; esos secretos se coordinan con EGIXIA por canal
 * cifrado (ver aviso en la sección "Ambientes y conexión").
 */
export const MODULO_INTEGRACION_ERP: ModuloDefinicion = {
  key: "integracion_erp",
  nombre: "Integración ERP / SAP",
  descripcion:
    "Datos técnicos para conectar tu Portal de Proveedores con tu ERP (SAP u otro). Sección para tu equipo de TI.",
  secciones: [
    // -------- 1. Tu ERP -------------------------------------------------
    {
      key: "erp",
      titulo: "Tu ERP",
      descripcion: "Con qué sistema integraremos el portal.",
      campos: [
        {
          key: "tiene_integracion",
          label: "¿Requiere integración con ERP?",
          tipo: "radio_tarjetas",
          requerido: true,
          opciones: [
            {
              valor: "si",
              etiqueta: "Sí, requiere integración con ERP",
            },
            {
              valor: "no",
              etiqueta: "No, sin integración por ahora",
            },
          ],
          guia: {
            que: "Indica si el portal debe integrarse con tu ERP.",
            formato: "Si eliges No, el resto de la sección es opcional.",
          },
        },
        {
          key: "sistema",
          label: "Sistema ERP",
          tipo: "select",
          mostrarSi: { campo: "tiene_integracion", igualA: "si" },
          opciones: [
            { valor: "sap_ecc", etiqueta: "SAP ECC" },
            { valor: "sap_s4", etiqueta: "SAP S/4HANA" },
            { valor: "oracle", etiqueta: "Oracle" },
            { valor: "dynamics", etiqueta: "Microsoft Dynamics" },
            { valor: "siesa", etiqueta: "Siesa" },
            { valor: "world_office", etiqueta: "World Office" },
            { valor: "otro", etiqueta: "Otro" },
          ],
          guia: {
            que: "Sistema ERP con el que se integrará el portal.",
          },
        },
        {
          key: "version",
          label: "Versión",
          tipo: "texto",
          mostrarSi: { campo: "tiene_integracion", igualA: "si" },
          placeholder: "Ej.: S/4HANA 2022 · ECC 6.0 EhP8",
          guia: {
            que: "Versión y release si aplica.",
          },
        },
      ],
    },
    // -------- 2. Alcance de la integración ------------------------------
    {
      key: "alcance",
      titulo: "Alcance de la integración",
      descripcion: "Qué información fluirá entre el portal y el ERP.",
      campos: [
        {
          key: "interfaces",
          label: "Interfaces a habilitar",
          tipo: "checkbox_multiple",
          mostrarSi: { campo: "tiene_integracion", igualA: "si" },
          opciones: [
            { valor: "proveedores", etiqueta: "Maestro de proveedores" },
            { valor: "ordenes", etiqueta: "Órdenes de compra" },
            { valor: "entradas", etiqueta: "Entradas de mercancía" },
            { valor: "facturas", etiqueta: "Facturas" },
            { valor: "pagos", etiqueta: "Estado de pagos" },
            { valor: "contratos", etiqueta: "Contratos" },
          ],
          guia: {
            que: "Marca los flujos que deben sincronizarse.",
          },
        },
        {
          key: "alcance_info",
          label: "Confirmación del alcance",
          tipo: "info",
          aviso:
            "El alcance definitivo se confirma en el levantamiento técnico con EGIXIA.",
        },
      ],
    },
    // -------- 3. Ambientes y conexión -----------------------------------
    {
      key: "ambientes",
      titulo: "Ambientes y conexión",
      descripcion:
        "Datos técnicos de conexión (los completa tu equipo de TI). No incluyas contraseñas aquí; se gestionan por canal seguro.",
      campos: [
        {
          key: "seguridad_info",
          label: "IMPORTANTE — Manejo de credenciales",
          tipo: "info",
          aviso:
            "IMPORTANTE: por seguridad, NO escribas contraseñas, tokens ni llaves privadas en este formulario. EGIXIA los solicitará por un canal cifrado.",
        },
        {
          key: "tabla_ambientes",
          label: "Ambientes",
          tipo: "tabla",
          mostrarSi: { campo: "tiene_integracion", igualA: "si" },
          columnas: [
            {
              key: "ambiente",
              label: "Ambiente",
              tipo: "select",
              requerido: true,
              opciones: [
                { valor: "qa", etiqueta: "QA / Pruebas" },
                { valor: "prod", etiqueta: "Producción" },
              ],
              guia: {
                que: "Ambiente al que corresponde esta conexión.",
              },
            },
            {
              key: "tipo_conexion",
              label: "Tipo de conexión",
              tipo: "select",
              requerido: true,
              opciones: [
                { valor: "api", etiqueta: "API REST" },
                { valor: "odata", etiqueta: "OData" },
                { valor: "rfc", etiqueta: "RFC/BAPI" },
                { valor: "sftp", etiqueta: "SFTP" },
                { valor: "archivo", etiqueta: "Archivo plano" },
              ],
              guia: {
                que: "Mecanismo técnico de conexión con el ERP.",
              },
            },
            {
              key: "host",
              label: "Host / endpoint",
              tipo: "texto",
              placeholder: "Ej.: https://erp.tuempresa.com/api",
              guia: {
                que: "Host o endpoint base, sin credenciales.",
              },
            },
            {
              key: "notas",
              label: "Notas",
              tipo: "texto",
            },
          ],
          guia: {
            que: "Una fila por cada ambiente que expondrás a EGIXIA para la integración.",
          },
        },
        {
          key: "contacto_ti_nombre",
          label: "Contacto TI — Nombre",
          tipo: "texto",
          mostrarSi: { campo: "tiene_integracion", igualA: "si" },
          placeholder: "Nombre y apellido",
          guia: {
            que: "Responsable técnico de la integración en tu organización.",
          },
        },
        {
          key: "contacto_ti_correo",
          label: "Contacto TI — Correo",
          tipo: "email",
          mostrarSi: { campo: "tiene_integracion", igualA: "si" },
          placeholder: "ti@tuempresa.com",
          guia: {
            que: "Responsable técnico de la integración en tu organización.",
            formato: "Correo corporativo válido.",
          },
        },
      ],
    },
  ],
};