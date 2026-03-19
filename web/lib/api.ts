const API_URL = process.env.NEXT_PUBLIC_API_URL!

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {}
) {
  const { token, ...fetchOptions } = options

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error ?? 'API error')
  }

  return data
}