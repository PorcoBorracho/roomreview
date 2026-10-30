import "server-only";

/**
 * Entrada de streamers con Twitch (OAuth 2.0, flujo "authorization code").
 * No se pide ningún permiso (scope vacío): solo se lee la identidad pública (id, login, nombre e imagen)
 * y el token se revoca en cuanto se ha usado. No se guarda ningún token de Twitch.
 *
 * Variables: TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET (https://dev.twitch.tv/console/apps).
 * URL de redirección que hay que registrar en Twitch: https://TU-DOMINIO/api/auth/twitch/callback
 */
const ID_URL = "https://id.twitch.tv/oauth2";
const API_URL = "https://api.twitch.tv/helix";

export function twitchConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const twitchEnabled = () => twitchConfig() !== null;

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const u = new URL(`${ID_URL}/authorize`);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "");
  u.searchParams.set("state", state);
  return u.toString();
}

export type TwitchUser = { id: string; login: string; displayName: string; avatarUrl: string | null };

const AVATAR_PREFIX = "https://static-cdn.jtvnw.net/";

/** Cambia el código por un token, lee la identidad y revoca el token. null si algo no cuadra. */
export async function fetchTwitchUser(code: string, redirectUri: string): Promise<TwitchUser | null> {
  const cfg = twitchConfig();
  if (!cfg) return null;
  const tokenRes = await fetch(`${ID_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenRes.ok) {
    console.warn("twitch token exchange failed", tokenRes.status);
    return null;
  }
  const { access_token: token } = (await tokenRes.json()) as { access_token?: string };
  if (typeof token !== "string" || !token) return null;

  try {
    const userRes = await fetch(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}`, "Client-Id": cfg.clientId },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!userRes.ok) return null;
    const body = (await userRes.json()) as { data?: { id?: unknown; login?: unknown; display_name?: unknown; profile_image_url?: unknown }[] };
    const u = body.data?.[0];
    if (!u || typeof u.id !== "string" || !/^\d{1,20}$/.test(u.id)) return null;
    const login = typeof u.login === "string" ? u.login.toLowerCase() : "";
    if (!/^[a-z0-9_]{1,25}$/.test(login)) return null;
    const display = typeof u.display_name === "string" ? u.display_name.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 64) : "";
    const avatar = typeof u.profile_image_url === "string" && u.profile_image_url.startsWith(AVATAR_PREFIX) && u.profile_image_url.length <= 300
      ? u.profile_image_url
      : null;
    return { id: u.id, login, displayName: display || login, avatarUrl: avatar };
  } finally {
    // El token ya no hace falta: se revoca (sin esperar a la respuesta para no retrasar la entrada)
    void fetch(`${ID_URL}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: cfg.clientId, token }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
}
