export const setCookieHeader = {
  value: "",
};

export function getSessionCookie(): string {
  return setCookieHeader ? setCookieHeader.value.split(";")[0] : "";
}

export function createForm(fields: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.append(key, value);
  }
  return params.toString();
}

export async function sendAuthReq(
  url: string,
  method: string,
  sessionCookie: string,
  data?: string,
): Promise<Response> {
  const headers: Record<string, string> = {};

  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
  }
  if (data) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  return fetch(url, {
    method,
    headers,
    body: data,
  });
}
