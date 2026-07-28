// Browser requests must stay on the website origin so Vercel owns the session cookie.
// The server-only /api proxy forwards them to BACKEND_URL.
export const API_URL = "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      error?: { code?: string; message?: string; details?: unknown; fields?: unknown; requestId?: string };
    } | null;
    const error = new Error(body?.error?.message ?? `Request failed with status ${response.status}.`) as Error & {
      code?: string;
      status?: number;
      details?: unknown;
      fields?: unknown;
      requestId?: string;
    };
    error.code = body?.error?.code;
    error.status = response.status;
    error.details = body?.error?.details;
    error.fields = body?.error?.fields;
    error.requestId = body?.error?.requestId;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
