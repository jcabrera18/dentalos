const API_URL = process.env.NEXT_PUBLIC_API_URL!

function getFriendlyApiError(message?: string, status?: number) {
  if (
    status === 409 &&
    message === 'Professional has an overlapping appointment at that time'
  ) {
    return 'Ese profesional ya tiene un turno en ese horario. Elegí otro horario o seleccioná otro profesional.'
  }

  return message ?? 'API error'
}

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

  const text = await res.text()
  const data = text ? JSON.parse(text) : {}

  if (!res.ok) {
    throw new Error(getFriendlyApiError(data.error, res.status))
  }

  return data
}
