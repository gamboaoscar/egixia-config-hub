import type { ModuloDefinicion } from "../tipos";
import { ROLES_INTERNOS } from "./seguridad";

/**
 * Módulo General — Usuarios internos.
 *
 * Registra a las personas del equipo del cliente que usarán el Portal
 * de Proveedores y el rol de cada una. La columna "Rol" reutiliza los
 * perfiles predefinidos del módulo Seguridad y, mediante
 * `opcionesDesde`, solo ofrece los roles que el cliente marcó en
 * `roles_internos_seleccion` de ese módulo (si aún no marcó ninguno,
 * se muestran los 16 completos).
 */
export const MODULO_USUARIOS_INTERNOS: ModuloDefinicion = {
  key: "usuarios_internos",
  nombre: "Usuarios internos",
  descripcion:
    "Personas de tu equipo que usarán el portal y el rol que tendrá cada una.",
  secciones: [
    {
      key: "usuarios",
      titulo: "Usuarios del portal",
      descripcion:
        "Registra a las personas de tu organización que ingresarán al Portal de Proveedores. EGIXIA creará sus cuentas con estos datos.",
      campos: [
        {
          key: "tabla_usuarios",
          label: "Usuarios internos",
          tipo: "tabla",
          requerido: true,
          columnas: [
            {
              key: "nombre",
              label: "Nombre",
              tipo: "texto",
              requerido: true,
              placeholder: "Ej. Ana María",
              guia: {
                que: "Nombre(s) de la persona tal como debe aparecer en su cuenta del portal.",
              },
            },
            {
              key: "apellido",
              label: "Apellido",
              tipo: "texto",
              requerido: true,
              placeholder: "Ej. Rodríguez",
              guia: {
                que: "Apellido(s) de la persona.",
              },
            },
            {
              key: "correo",
              label: "Correo",
              tipo: "email",
              requerido: true,
              placeholder: "nombre.apellido@tuempresa.com",
              guia: {
                que: "Correo con el que la persona iniciará sesión y recibirá las notificaciones del portal.",
                formato:
                  "Correo corporativo de tu organización (ej. nombre.apellido@tuempresa.com).",
              },
            },
            {
              key: "cargo",
              label: "Cargo",
              tipo: "texto",
              placeholder: "Ej. Analista de compras",
              guia: {
                que: "Cargo o posición de la persona dentro de tu organización.",
              },
            },
            {
              key: "sociedad",
              label: "Sociedad",
              tipo: "texto",
              placeholder: "Razón social",
              guia: {
                que: "Razón social a la que pertenece (de las registradas en el módulo Sociedades).",
              },
            },
            {
              key: "rol",
              label: "Rol",
              tipo: "select",
              requerido: true,
              opciones: ROLES_INTERNOS,
              opcionesDesde: {
                moduloKey: "seguridad",
                campoKey: "roles_internos_seleccion",
              },
              guia: {
                que: "Perfil que tendrá la persona en el portal. Solo se listan los roles habilitados en el módulo Seguridad.",
              },
            },
          ],
        },
      ],
    },
    {
      key: "responsable",
      titulo: "Responsable del portal",
      campos: [
        {
          key: "resp_nombre",
          label: "Nombre del responsable",
          tipo: "texto",
          requerido: true,
          placeholder: "Nombre y apellido",
          guia: {
            que: "Persona de tu equipo que será el punto de contacto principal con EGIXIA.",
          },
        },
        {
          key: "resp_correo",
          label: "Correo del responsable",
          tipo: "email",
          requerido: true,
          placeholder: "responsable@tuempresa.com",
          guia: {
            que: "Correo de la persona de tu equipo que será el punto de contacto principal con EGIXIA.",
            formato: "Correo corporativo válido.",
          },
        },
      ],
    },
  ],
};
