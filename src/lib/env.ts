import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Falta la variable de entorno ${name}`);
  return v.trim();
}

export const serverEnv = {
  get supabaseUrl() { return req("NEXT_PUBLIC_SUPABASE_URL"); },
  get supabaseSecretKey() { return req("SUPABASE_SECRET_KEY"); },
  get adminPasswordHash() { return req("ADMIN_PASSWORD_HASH"); },
  get sessionSecret() {
    const s = req("SESSION_SECRET");
    if (s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
    return s;
  },
  get turnstileSecret() { return req("TURNSTILE_SECRET_KEY"); },
  get cronSecret() { return process.env.CRON_SECRET?.trim() || ""; },
};

