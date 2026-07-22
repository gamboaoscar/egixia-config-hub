export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actas: {
        Row: {
          archivo_url: string
          generada_at: string
          generada_por: string | null
          id: string
          proyecto_modulo_id: string
          version: number
        }
        Insert: {
          archivo_url: string
          generada_at?: string
          generada_por?: string | null
          id?: string
          proyecto_modulo_id: string
          version?: number
        }
        Update: {
          archivo_url?: string
          generada_at?: string
          generada_por?: string | null
          id?: string
          proyecto_modulo_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "actas_generada_por_fkey"
            columns: ["generada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actas_proyecto_modulo_id_fkey"
            columns: ["proyecto_modulo_id"]
            isOneToOne: false
            referencedRelation: "proyecto_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      archivos: {
        Row: {
          campo_key: string | null
          created_at: string
          created_by: string | null
          dimensiones: string | null
          id: string
          nombre_original: string
          proyecto_modulo_id: string | null
          storage_path: string
          tamano: number | null
          tipo: string | null
        }
        Insert: {
          campo_key?: string | null
          created_at?: string
          created_by?: string | null
          dimensiones?: string | null
          id?: string
          nombre_original: string
          proyecto_modulo_id?: string | null
          storage_path: string
          tamano?: number | null
          tipo?: string | null
        }
        Update: {
          campo_key?: string | null
          created_at?: string
          created_by?: string | null
          dimensiones?: string | null
          id?: string
          nombre_original?: string
          proyecto_modulo_id?: string | null
          storage_path?: string
          tamano?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archivos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archivos_proyecto_modulo_id_fkey"
            columns: ["proyecto_modulo_id"]
            isOneToOne: false
            referencedRelation: "proyecto_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          actor_id: string | null
          created_at: string
          detalle: Json | null
          entidad: string
          entidad_id: string | null
          id: string
        }
        Insert: {
          accion: string
          actor_id?: string | null
          created_at?: string
          detalle?: Json | null
          entidad: string
          entidad_id?: string | null
          id?: string
        }
        Update: {
          accion?: string
          actor_id?: string | null
          created_at?: string
          detalle?: Json | null
          entidad?: string
          entidad_id?: string | null
          id?: string
        }
        Relationships: []
      }
      catalogo_overrides: {
        Row: {
          activo: boolean
          campo_key: string
          created_at: string
          guia: Json | null
          id: string
          label: string | null
          modulo_key: string
          opciones_permitidas: string[] | null
          proyecto_id: string
          requerido: boolean | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activo?: boolean
          campo_key: string
          created_at?: string
          guia?: Json | null
          id?: string
          label?: string | null
          modulo_key: string
          opciones_permitidas?: string[] | null
          proyecto_id: string
          requerido?: boolean | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activo?: boolean
          campo_key?: string
          created_at?: string
          guia?: Json | null
          id?: string
          label?: string | null
          modulo_key?: string
          opciones_permitidas?: string[] | null
          proyecto_id?: string
          requerido?: boolean | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_overrides_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_overrides_seccion: {
        Row: {
          created_at: string
          habilitada: boolean
          id: string
          modulo_key: string
          obligatoria: boolean | null
          proyecto_id: string
          seccion_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          habilitada?: boolean
          id?: string
          modulo_key: string
          obligatoria?: boolean | null
          proyecto_id: string
          seccion_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          habilitada?: boolean
          id?: string
          modulo_key?: string
          obligatoria?: boolean | null
          proyecto_id?: string
          seccion_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_overrides_seccion_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_overrides_seccion_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_sistema: {
        Row: {
          clave: string
          updated_at: string
          updated_by: string | null
          valor: Json
        }
        Insert: {
          clave: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Update: {
          clave?: string
          updated_at?: string
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      invitaciones: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          estado: Database["public"]["Enums"]["invitacion_estado"]
          expira_at: string
          id: string
          invited_by: string | null
          proyecto_id: string | null
          rol_invitado: Database["public"]["Enums"]["invitacion_rol"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          estado?: Database["public"]["Enums"]["invitacion_estado"]
          expira_at: string
          id?: string
          invited_by?: string | null
          proyecto_id?: string | null
          rol_invitado: Database["public"]["Enums"]["invitacion_rol"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          estado?: Database["public"]["Enums"]["invitacion_estado"]
          expira_at?: string
          id?: string
          invited_by?: string | null
          proyecto_id?: string | null
          rol_invitado?: Database["public"]["Enums"]["invitacion_rol"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      observacion_respuestas: {
        Row: {
          autor_id: string | null
          created_at: string
          id: string
          mensaje: string
          observacion_id: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          id?: string
          mensaje: string
          observacion_id: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          id?: string
          mensaje?: string
          observacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observacion_respuestas_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacion_respuestas_observacion_id_fkey"
            columns: ["observacion_id"]
            isOneToOne: false
            referencedRelation: "observaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      observaciones: {
        Row: {
          campo_key: string
          comentario: string
          created_at: string
          created_by: string | null
          estado: Database["public"]["Enums"]["observacion_estado"]
          id: string
          proyecto_modulo_id: string
          resuelta_at: string | null
        }
        Insert: {
          campo_key: string
          comentario: string
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["observacion_estado"]
          id?: string
          proyecto_modulo_id: string
          resuelta_at?: string | null
        }
        Update: {
          campo_key?: string
          comentario?: string
          created_at?: string
          created_by?: string | null
          estado?: Database["public"]["Enums"]["observacion_estado"]
          id?: string
          proyecto_modulo_id?: string
          resuelta_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "observaciones_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observaciones_proyecto_modulo_id_fkey"
            columns: ["proyecto_modulo_id"]
            isOneToOne: false
            referencedRelation: "proyecto_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_catalogo: {
        Row: {
          contenido: Json
          creado_por: string | null
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          contenido: Json
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          contenido?: Json
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_catalogo_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellido: string
          cargo: string | null
          created_at: string
          email: string
          empresa: string | null
          estado: Database["public"]["Enums"]["user_estado"]
          foto_perfil: string | null
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          apellido?: string
          cargo?: string | null
          created_at?: string
          email: string
          empresa?: string | null
          estado?: Database["public"]["Enums"]["user_estado"]
          foto_perfil?: string | null
          id: string
          nombre?: string
          rol?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          apellido?: string
          cargo?: string | null
          created_at?: string
          email?: string
          empresa?: string | null
          estado?: Database["public"]["Enums"]["user_estado"]
          foto_perfil?: string | null
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      proyecto_miembros: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["miembro_estado"]
          id: string
          profile_id: string
          proyecto_id: string
          rol_en_proyecto: Database["public"]["Enums"]["miembro_rol"]
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["miembro_estado"]
          id?: string
          profile_id: string
          proyecto_id: string
          rol_en_proyecto: Database["public"]["Enums"]["miembro_rol"]
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["miembro_estado"]
          id?: string
          profile_id?: string
          proyecto_id?: string
          rol_en_proyecto?: Database["public"]["Enums"]["miembro_rol"]
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_miembros_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_miembros_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_modulos: {
        Row: {
          comportamiento_vencimiento:
            | Database["public"]["Enums"]["comportamiento_vencimiento"]
            | null
          created_at: string
          datos: Json
          enviado_at: string | null
          enviado_por: string | null
          estado: Database["public"]["Enums"]["modulo_estado"]
          extension_solicitada_at: string | null
          extension_solicitada_por: string | null
          fecha_limite: string | null
          id: string
          modulo_key: string
          progreso: number
          proyecto_id: string
          revisado_at: string | null
          revisado_por: string | null
          updated_at: string
          updated_por: string | null
        }
        Insert: {
          comportamiento_vencimiento?:
            | Database["public"]["Enums"]["comportamiento_vencimiento"]
            | null
          created_at?: string
          datos?: Json
          enviado_at?: string | null
          enviado_por?: string | null
          estado?: Database["public"]["Enums"]["modulo_estado"]
          extension_solicitada_at?: string | null
          extension_solicitada_por?: string | null
          fecha_limite?: string | null
          id?: string
          modulo_key: string
          progreso?: number
          proyecto_id: string
          revisado_at?: string | null
          revisado_por?: string | null
          updated_at?: string
          updated_por?: string | null
        }
        Update: {
          comportamiento_vencimiento?:
            | Database["public"]["Enums"]["comportamiento_vencimiento"]
            | null
          created_at?: string
          datos?: Json
          enviado_at?: string | null
          enviado_por?: string | null
          estado?: Database["public"]["Enums"]["modulo_estado"]
          extension_solicitada_at?: string | null
          extension_solicitada_por?: string | null
          fecha_limite?: string | null
          id?: string
          modulo_key?: string
          progreso?: number
          proyecto_id?: string
          revisado_at?: string | null
          revisado_por?: string | null
          updated_at?: string
          updated_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_modulos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_modulos_extension_solicitada_por_fkey"
            columns: ["extension_solicitada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_modulos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_modulos_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_modulos_updated_por_fkey"
            columns: ["updated_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa: string
          estado: Database["public"]["Enums"]["proyecto_estado"]
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa: string
          estado?: Database["public"]["Enums"]["proyecto_estado"]
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa?: string
          estado?: Database["public"]["Enums"]["proyecto_estado"]
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      comparten_proyecto: { Args: { _a: string; _b: string }; Returns: boolean }
      destinatarios_notificacion: {
        Args: { _proyecto_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _proyecto_id: string; _uid: string }
        Returns: boolean
      }
      puede_editar_modulo: {
        Args: { _modulo_id: string; _uid: string }
        Returns: boolean
      }
      registrar_auditoria:
        | {
            Args: {
              _accion: string
              _detalle: Json
              _entidad: string
              _entidad_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _accion: string
              _actor_id?: string
              _detalle: Json
              _entidad: string
              _entidad_id: string
            }
            Returns: string
          }
      storage_proyecto_from_path: { Args: { _name: string }; Returns: string }
      validar_invitacion: {
        Args: { _token: string }
        Returns: {
          email: string
          expira_at: string
          proyecto_id: string
          proyecto_nombre: string
          rol_invitado: Database["public"]["Enums"]["invitacion_rol"]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "implementador" | "cliente"
      comportamiento_vencimiento:
        | "bloquear"
        | "editable_avisar"
        | "solo_avisar"
        | "extension_implementador"
      invitacion_estado: "pendiente" | "aceptada" | "revocada" | "expirada"
      invitacion_rol: "implementador" | "invitado"
      miembro_estado: "activo" | "inhabilitado"
      miembro_rol: "implementador" | "invitado"
      modulo_estado:
        | "sin_iniciar"
        | "en_diligenciamiento"
        | "en_revision"
        | "con_observaciones"
        | "aprobado"
      observacion_estado: "abierta" | "resuelta"
      proyecto_estado:
        | "nuevo"
        | "en_proceso"
        | "en_revision"
        | "completado"
        | "cerrado"
      user_estado: "activo" | "inhabilitado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "implementador", "cliente"],
      comportamiento_vencimiento: [
        "bloquear",
        "editable_avisar",
        "solo_avisar",
        "extension_implementador",
      ],
      invitacion_estado: ["pendiente", "aceptada", "revocada", "expirada"],
      invitacion_rol: ["implementador", "invitado"],
      miembro_estado: ["activo", "inhabilitado"],
      miembro_rol: ["implementador", "invitado"],
      modulo_estado: [
        "sin_iniciar",
        "en_diligenciamiento",
        "en_revision",
        "con_observaciones",
        "aprobado",
      ],
      observacion_estado: ["abierta", "resuelta"],
      proyecto_estado: [
        "nuevo",
        "en_proceso",
        "en_revision",
        "completado",
        "cerrado",
      ],
      user_estado: ["activo", "inhabilitado"],
    },
  },
} as const
