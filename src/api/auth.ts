import { API_BASE } from './base';

// Production: WSB platform launches the game as /?token=<jwt>.
// Dev/staging: the server exposes GET /api/dev-token which mints a random player.
let cached: string | null = null;

export async function getToken(): Promise<string> {
  if (cached) return cached;

  const fromUrl = new URLSearchParams(window.location.search).get('token');
  if (fromUrl) {
    cached = fromUrl;
    return fromUrl;
  }

  const res = await fetch(`${API_BASE}/api/dev-token`);
  if (!res.ok) {
    throw new Error('No session token. Launch with ?token=<jwt> or run the API in Development mode.');
  }
  const body = (await res.json()) as { token: string };
  cached = body.token;
  return cached;
}
