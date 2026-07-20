import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type Rol = "admin" | "implementador" | "cliente";
export type Estado = "activo" | "inhabilitado";

export interface Profile {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  foto_perfil: string | null;
  cargo: string | null;
  empresa: string | null;
  rol: Rol;
  estado: Estado;
  created_at: string;
}

interface AuthContextValue {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  avatarUrl: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("avatares")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserId = useRef<string | null>(null);

  const fetchProfileFor = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    // Carrera de cambio de sesión: si mientras esperábamos la consulta
    // el usuario activo cambió, descartamos este resultado para no pisar
    // el perfil de la nueva sesión con datos de la anterior.
    if (currentUserId.current !== userId) return;
    if (error) {
      console.error("[auth] error cargando perfil", error);
      setProfile(null);
      setAvatarUrl(null);
      return;
    }
    const p = data as Profile | null;
    setProfile(p);
    // El avatar no debe bloquear la carga del portal: se resuelve aparte.
    setAvatarUrl(null);
    if (p?.foto_perfil) {
      loadAvatarUrl(p.foto_perfil)
        .then((url) => {
          // Mismo guard tras el await del avatar.
          if (currentUserId.current === userId) setAvatarUrl(url);
        })
        .catch(() => {
          if (currentUserId.current === userId) setAvatarUrl(null);
        });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (currentUserId.current) {
      await fetchProfileFor(currentUserId.current);
    }
  }, [fetchProfileFor]);

  useEffect(() => {
    let mounted = true;

    // Subscribe FIRST, then load current session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSession(sess);
      const uid = sess?.user?.id ?? null;
      if (uid !== currentUserId.current) {
        currentUserId.current = uid;
        if (uid) {
          // Defer to avoid deadlock in callback
          setTimeout(() => {
            fetchProfileFor(uid);
          }, 0);
        } else {
          setProfile(null);
          setAvatarUrl(null);
        }
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      const uid = data.session?.user?.id ?? null;
      currentUserId.current = uid;
      if (uid) {
        fetchProfileFor(uid).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfileFor]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setAvatarUrl(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user: session?.user ?? null,
      session,
      profile,
      avatarUrl,
      refreshProfile,
      signOut,
    }),
    [loading, session, profile, avatarUrl, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}