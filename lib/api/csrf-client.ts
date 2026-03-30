export async function fetchCsrfToken() {
  const response = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to refresh CSRF token.");
  }

  const payload = (await response.json()) as {
    csrfToken?: string;
  };

  if (!payload.csrfToken) {
    throw new Error("CSRF token was missing from the response.");
  }

  return payload.csrfToken;
}

export async function fetchWithCsrf(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const csrfToken = await fetchCsrfToken();
  const headers = new Headers(init.headers);
  headers.set("X-CSRF-Token", csrfToken);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "same-origin"
  });
}
