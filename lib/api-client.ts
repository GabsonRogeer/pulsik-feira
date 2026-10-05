export type LoginUser = {
  id: string;
  email: string;
  name?: string | null;
  guest?: boolean;
};
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || "server_error"), {
      status: response.status,
    });
  return result as T;
}
