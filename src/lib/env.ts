export function hasSupabaseConfig(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function supabaseUrl(): string {
  const u = import.meta.env.VITE_SUPABASE_URL;
  if (!u) throw new Error("Missing VITE_SUPABASE_URL");
  return u.replace(/\/$/, "");
}

export function supabaseAnonKey(): string {
  const k = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!k) throw new Error("Missing VITE_SUPABASE_ANON_KEY");
  return k;
}

export function functionsUrl(): string {
  return `${supabaseUrl()}/functions/v1/mentor-backend`;
}
