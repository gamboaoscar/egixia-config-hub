import type { ConfigArchivo, ModuloDefinicion } from "../tipos";

/**
 * Módulo General – Imagen Corporativa (key: 'imagen').
 *
 * Definición declarativa consumida por el motor de formularios
 * (`FormularioModulo`). Incluye guía por campo (qué / formato / tamaño),
 * requeridos, visibilidad condicional (SMTP) y validaciones básicas.
 */

const IMG_RASTER = [
  "image/png",
  "image/jpeg",
  "image/webp",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];
const IMG_LOGO = ["image/png", "image/svg+xml", ".png", ".svg"];
const IMG_FAVICON = [
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/png",
  ".ico",
  ".png",
];
const PDF_ONLY = ["application/pdf", ".pdf"];

function imgLogo(
  ancho: number,
  alto: number,
  formatos: string[] = IMG_LOGO,
): ConfigArchivo {
  return {
    bucket: "logos-clientes",
    formatosPermitidos: formatos,
    tamanoMaxMB: 5,
    dimensiones: { ancho, alto },
  };
}

function docPdf(): ConfigArchivo {
  return {
    bucket: "documentos",
    formatosPermitidos: PDF_ONLY,
    tamanoMaxMB: 10,
  };
}

export const MODULO_IMAGEN: ModuloDefinicion = {
  key: "imagen",
  nombre: "Imagen corporativa",
  descripcion:
    "Define la identidad visual, documentos legales y correo de salida del portal.",
  secciones: [
    // -------- 1. Color corporativo --------
    {
      key: "color",
      titulo: "Color corporativo",
      descripcion:
        "Color institucional del portal. Azul Rey es el recomendado.",
      campos: [
        {
          key: "color_principal",
          label: "Color principal",
          tipo: "color",
          requerido: true,
          opciones: [
            { valor: "#0F2B8E", etiqueta: "Azul Rey", hex: "#0F2B8E" },
            { valor: "#000000", etiqueta: "Negro", hex: "#000000" },
            { valor: "#ED1B2E", etiqueta: "Rojo", hex: "#ED1B2E" },
            { valor: "#00ab4f", etiqueta: "Verde", hex: "#00ab4f" },
            { valor: "#008361", etiqueta: "Verde Marino", hex: "#008361" },
          ],
          guia: {
            que: "Color institucional del portal; Azul Rey es el recomendado.",
          },
        },
      ],
    },

    // -------- 2. Logotipos --------
    {
      key: "logotipos",
      titulo: "Logotipos",
      descripcion:
        "Usa PNG o SVG con fondo transparente salvo indicación contraria.",
      campos: [
        {
          key: "logo_login",
          label: "Logo — Pantalla de acceso",
          tipo: "archivo",
          requerido: true,
          archivo: imgLogo(400, 110),
          guia: {
            que: "Logotipo visible en la pantalla de acceso al portal.",
            formato: "PNG o SVG con fondo transparente.",
            tamano: "Se ajustará a 400×110 px. Máx. 5 MB.",
          },
        },
        {
          key: "logo_menu",
          label: "Logo — Barra del menú principal",
          tipo: "archivo",
          requerido: true,
          archivo: imgLogo(180, 50),
          guia: {
            que: "Logotipo que aparece en la barra del menú principal.",
            formato: "PNG o SVG con fondo transparente.",
            tamano: "Se ajustará a 180×50 px. Máx. 5 MB.",
          },
        },
        {
          key: "logo_favicon",
          label: "Favicon — Ícono del navegador",
          tipo: "archivo",
          requerido: true,
          archivo: imgLogo(60, 60, IMG_FAVICON),
          guia: {
            que: "Ícono que aparece en la pestaña del navegador.",
            formato: "ICO o PNG.",
            tamano: "Se ajustará a 60×60 px. Máx. 5 MB.",
          },
        },
        {
          key: "logo_cabecera",
          label: "Logo — Cabecera y pie del portal",
          tipo: "archivo",
          requerido: true,
          archivo: imgLogo(256, 66),
          guia: {
            que: "Logotipo mostrado en la cabecera y pie del portal.",
            formato: "PNG transparente, preferiblemente en color blanco.",
            tamano: "Se ajustará a 256×66 px. Máx. 5 MB.",
          },
        },
      ],
    },

    // -------- 3. Imagen de fondo --------
    {
      key: "fondo",
      titulo: "Imagen de fondo",
      campos: [
        {
          key: "img_fondo",
          label: "Fondo de la pantalla de acceso",
          tipo: "archivo",
          requerido: true,
          archivo: {
            bucket: "logos-clientes",
            formatosPermitidos: IMG_RASTER,
            tamanoMaxMB: 5,
            dimensiones: { ancho: 1360, alto: 635 },
          },
          guia: {
            que: "Cubre la mitad izquierda de la pantalla de inicio de sesión.",
            formato: "JPG, PNG o WEBP.",
            tamano: "Se ajustará a 1360×635 px. Máx. 5 MB.",
          },
        },
      ],
    },

    // -------- 4. Términos y documentos legales --------
    {
      key: "legales",
      titulo: "Términos y documentos legales",
      descripcion: "Documentos PDF que verán tus proveedores.",
      campos: [
        {
          key: "terminos",
          label: "Términos y condiciones",
          tipo: "archivo",
          requerido: true,
          archivo: docPdf(),
          guia: {
            que: "Términos y condiciones de aceptación obligatoria.",
            formato: "PDF.",
            tamano: "Máx. 10 MB.",
          },
        },
        {
          key: "politica_datos",
          label: "Política de tratamiento de datos",
          tipo: "archivo",
          archivo: docPdf(),
          guia: { que: "Documento PDF opcional.", formato: "PDF." },
        },
        {
          key: "linea_etica",
          label: "Línea ética",
          tipo: "archivo",
          archivo: docPdf(),
          guia: { que: "Documento PDF opcional.", formato: "PDF." },
        },
        {
          key: "otros_documentos_1",
          label: "Otro documento (1)",
          tipo: "archivo",
          archivo: docPdf(),
          guia: { que: "Documento adicional opcional.", formato: "PDF." },
        },
        {
          key: "otros_documentos_2",
          label: "Otro documento (2)",
          tipo: "archivo",
          archivo: docPdf(),
          guia: { que: "Documento adicional opcional.", formato: "PDF." },
        },
        {
          key: "otros_documentos_3",
          label: "Otro documento (3)",
          tipo: "archivo",
          archivo: docPdf(),
          guia: { que: "Documento adicional opcional.", formato: "PDF." },
        },
      ],
    },

    // -------- 5. Pie de página --------
    {
      key: "pie_branding",
      titulo: "Pie de página — Branding",
      descripcion: "Primera columna del pie del portal.",
      campos: [
        {
          key: "pie_logo",
          label: "Logo del pie",
          tipo: "archivo",
          archivo: imgLogo(256, 66),
          guia: {
            que: "Logotipo mostrado en la primera columna del pie.",
            formato: "PNG o SVG con fondo transparente.",
            tamano: "Se ajustará a 256×66 px.",
          },
        },
        {
          key: "pie_titulo",
          label: "Título",
          tipo: "texto",
          guia: { que: "Título corto que acompaña al logo del pie." },
        },
        {
          key: "pie_descripcion",
          label: "Descripción",
          tipo: "textarea",
          guia: {
            que: "Breve descripción de tu empresa mostrada en el pie.",
          },
        },
      ],
    },
    {
      key: "pie_enlaces",
      titulo: "Pie de página — Enlaces",
      descripcion: "Segunda columna: enlaces útiles del pie.",
      campos: [
        { key: "pie_url1", label: "Enlace 1", tipo: "url", guia: { que: "URL del primer enlace.", formato: "https://..." } },
        { key: "pie_url2", label: "Enlace 2", tipo: "url", guia: { que: "URL del segundo enlace.", formato: "https://..." } },
        { key: "pie_url3", label: "Enlace 3", tipo: "url", guia: { que: "URL del tercer enlace.", formato: "https://..." } },
        { key: "pie_url4", label: "Enlace 4", tipo: "url", guia: { que: "URL del cuarto enlace.", formato: "https://..." } },
      ],
    },
    {
      key: "pie_contacto",
      titulo: "Pie de página — Contacto",
      descripcion: "Tercera columna: información de contacto.",
      campos: [
        {
          key: "pie_direccion",
          label: "Dirección",
          tipo: "texto",
          guia: { que: "Dirección física principal." },
        },
        {
          key: "pie_celular",
          label: "Celular",
          tipo: "texto",
          placeholder: "+57 300 000 0000",
          guia: { que: "Número de contacto principal." },
        },
        {
          key: "pie_whatsapp",
          label: "WhatsApp",
          tipo: "texto",
          placeholder: "+57 300 000 0000",
          guia: { que: "Número de WhatsApp para atención." },
        },
        {
          key: "pie_email",
          label: "Correo",
          tipo: "email",
          guia: { que: "Correo de contacto público.", formato: "nombre@empresa.com" },
        },
      ],
    },
    {
      key: "pie_redes",
      titulo: "Pie de página — Redes sociales",
      descripcion: "Cuarta columna. Todos los enlaces son opcionales.",
      campos: [
        { key: "red_facebook", label: "Facebook", tipo: "url", guia: { que: "URL del perfil de Facebook.", formato: "https://..." } },
        { key: "red_x", label: "X (Twitter)", tipo: "url", guia: { que: "URL del perfil en X.", formato: "https://..." } },
        { key: "red_linkedin", label: "LinkedIn", tipo: "url", guia: { que: "URL del perfil en LinkedIn.", formato: "https://..." } },
        { key: "red_instagram", label: "Instagram", tipo: "url", guia: { que: "URL del perfil en Instagram.", formato: "https://..." } },
      ],
    },

    // -------- 6. Correo de salida --------
    {
      key: "correo_salida",
      titulo: "Correo de salida",
      descripcion: "Cuenta desde la que el portal envía notificaciones a proveedores.",
      campos: [
        {
          key: "correo_opcion",
          label: "Opción de correo",
          tipo: "radio_tarjetas",
          requerido: true,
          opciones: [
            {
              valor: "egixia",
              etiqueta: "Cuenta segura dominio EGIXIA (Recomendada)",
              descripcion:
                "Se define un buzón del tipo proveedores[cliente]@egixia.com.co administrado por EGIXIA.",
            },
            {
              valor: "smtp",
              etiqueta: "SMTP cuenta propia del cliente (No recomendada)",
              descripcion:
                "Usar un servidor SMTP del cliente. Requiere datos técnicos y aumenta el riesgo de SPAM.",
            },
            {
              valor: "sendgrid",
              etiqueta: "Nuevo dominio con SendGrid",
              descripcion:
                "Se configura un dominio dedicado con SendGrid. Servicios adicionales con costo.",
            },
          ],
          guia: {
            que: "Selecciona cómo saldrán los correos del portal hacia tus proveedores.",
          },
        },
        {
          key: "egixia_buzon",
          label: "Nombre del buzón EGIXIA",
          tipo: "texto",
          placeholder: "proveedorescliente@egixia.com.co",
          mostrarSi: { campo: "correo_opcion", igualA: "egixia" },
          guia: {
            que: "Buzón que EGIXIA aprovisionará para el envío de correos.",
            formato: "proveedores[cliente]@egixia.com.co",
          },
        },
        // --- SMTP subfields (condicionales) ---
        {
          key: "smtp_cuenta",
          label: "Cuenta de correo",
          tipo: "email",
          mostrarSi: { campo: "correo_opcion", igualA: "smtp" },
          guia: { que: "Cuenta usada para enviar los correos.", formato: "nombre@empresa.com" },
          aviso:
            "Usar un SMTP propio puede aumentar el riesgo de que los correos lleguen a SPAM o sean bloqueados.",
        },
        {
          key: "smtp_usuario",
          label: "Usuario (si aplica relay)",
          tipo: "texto",
          mostrarSi: { campo: "correo_opcion", igualA: "smtp" },
          guia: {
            que: "Usuario de autenticación cuando el servidor SMTP actúa como relay.",
          },
        },
        {
          key: "smtp_password",
          label: "Contraseña (sin vencimiento)",
          tipo: "texto",
          mostrarSi: { campo: "correo_opcion", igualA: "smtp" },
          guia: {
            que: "Contraseña del buzón. Debe estar configurada sin vencimiento para evitar caídas.",
          },
        },
        {
          key: "smtp_puerto",
          label: "Puerto",
          tipo: "numero",
          mostrarSi: { campo: "correo_opcion", igualA: "smtp" },
          validacion: { min: 1, max: 65535 },
          guia: {
            que: "Puerto del servidor SMTP.",
            formato: "Números enteros. El puerto 25 no se admite.",
          },
          aviso: "El puerto 25 no se admite. Usa 465 (TLS) o 587 (STARTTLS).",
        },
        {
          key: "smtp_autenticacion",
          label: "Autenticación con servidor",
          tipo: "radio_tarjetas",
          mostrarSi: { campo: "correo_opcion", igualA: "smtp" },
          opciones: [
            { valor: "si", etiqueta: "Sí", descripcion: "El servidor requiere usuario y contraseña." },
            { valor: "no", etiqueta: "No", descripcion: "El servidor acepta envíos sin autenticación." },
          ],
        },
        {
          key: "smtp_protocolo",
          label: "Protocolo",
          tipo: "radio_tarjetas",
          mostrarSi: { campo: "correo_opcion", igualA: "smtp" },
          opciones: [
            { valor: "starttls", etiqueta: "STARTTLS", descripcion: "Actualiza la conexión a TLS (normalmente puerto 587)." },
            { valor: "tls", etiqueta: "TLS", descripcion: "Conexión cifrada desde el inicio (normalmente puerto 465)." },
          ],
        },
      ],
    },

    // -------- 7. URLs del portal --------
    {
      key: "urls",
      titulo: "URLs del portal",
      descripcion:
        "Direcciones donde se publicará el portal en producción y en calidad.",
      campos: [
        {
          key: "url_produccion",
          label: "URL de producción",
          tipo: "url",
          requerido: true,
          validacion: { url_https: true },
          placeholder: "https://NombrePortalCliente-Pais.egixia.app",
          guia: {
            que: "Dirección pública del portal en producción.",
            formato: "https://[NombrePortalCliente-País].egixia.app",
          },
        },
        {
          key: "url_calidad",
          label: "URL de calidad",
          tipo: "url",
          validacion: { url_https: true },
          placeholder: "https://www.egixia.net/NombrePortalCliente-Pais",
          guia: {
            que: "Dirección del ambiente de calidad para pruebas antes de salir a producción.",
            formato: "https://www.egixia.net/[NombrePortalCliente-País]",
          },
        },
      ],
    },
  ],
};