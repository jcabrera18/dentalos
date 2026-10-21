// Fecha de negocio, independiente de la zona horaria del navegador o servidor.
export function todayArgDate(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}
