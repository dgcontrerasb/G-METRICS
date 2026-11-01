import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
let configPromise: Promise<{ supabaseUrl: string | null; supabaseAnonKey: string | null }> | null = null;

export async function fetchSupabasePublicConfig(): Promise<{ supabaseUrl: string | null; supabaseAnonKey: string | null }> {
  if (configPromise) return configPromise;

  configPromise = (async () => {
    try {
      const res = await fetch('/api/auth/config');
      if (res.ok) {
        const data = await res.json();
        return {
          supabaseUrl: data.supabaseUrl || null,
          supabaseAnonKey: data.supabaseAnonKey || null,
        };
      }
    } catch {
      // fallback
    }
    return {
      supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string) || null,
      supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || null,
    };
  })();

  return configPromise;
}

export async function getBrowserSupabase(): Promise<SupabaseClient | null> {
  if (browserClient) return browserClient;

  const { supabaseUrl, supabaseAnonKey } = await fetchSupabasePublicConfig();

  if (supabaseUrl && supabaseAnonKey) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}

/**
 * Triggers the official Google OAuth Sign-In flow via Supabase.
 * Opens Google's official accounts popup or redirect.
 */
export async function signInWithGoogleOAuth(): Promise<{ error: Error | null }> {
  try {
    const supabase = await getBrowserSupabase();
    if (!supabase) {
      return { error: new Error('No se pudo inicializar el cliente de autenticación de Supabase.') };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    return { error };
  } catch (err: any) {
    return { error: err || new Error('Error al iniciar OAuth con Google') };
  }
}
