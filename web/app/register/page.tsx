'use client'

import { ArrowRight } from "lucide-react"
import { useState } from "react"
import { apiFetch } from "@/lib/api"

export default function RegisterPage() {
  const [form, setForm] = useState({
    clinic_name: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          clinic_name: form.clinic_name,
          email: form.email,
          password: form.password,
          first_name: form.first_name,
          last_name: form.last_name,
        }),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-app">
            Dental<span className="text-emerald-400">OS</span>
          </h1>
          <p className="text-app2 mt-1 text-sm">Comenzá tu prueba gratis</p>
          <p className="text-app2 mt-2 text-xs">
            10 días de acceso completo. Sin tarjeta, sin compromiso.
          </p>
        </div>

        {submitted ? (
          <div className="bg-surface rounded-2xl p-8 border border-app text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <h2 className="text-xl font-semibold text-app">¡Registro exitoso!</h2>
            <p className="text-app2 text-sm">
              Ingresá con tu email <span className="font-medium text-app">{form.email}</span> y la contraseña que elegiste para empezar a ordernar tu consultorio.
            </p>
            <a
              href="https://dentalos.pro/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Ir a DentalOS <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-8 border border-app space-y-4">
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="clinic_name" className="block text-sm font-medium text-app2 mb-2">
                Nombre de la Clínica
              </label>
              <input
                id="clinic_name"
                name="clinic_name"
                placeholder="Consultorios Bovril"
                required
                value={form.clinic_name}
                onChange={handleChange}
                className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-app2 mb-2">
                  Nombre
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  placeholder="Juan"
                  required
                  value={form.first_name}
                  onChange={handleChange}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-app2 mb-2">
                  Apellido
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  placeholder="Pérez"
                  required
                  value={form.last_name}
                  onChange={handleChange}
                  className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-app2 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="dr@consultorio.com"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-app2 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                value={form.password}
                onChange={handleChange}
                className="w-full bg-surface2 border border-app rounded-lg px-4 py-3 text-app placeholder-app2 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
              {!loading && <ArrowRight className="h-5 w-5" />}
            </button>

            <p className="text-center text-xs text-app2">
              Al registrarte aceptás nuestros términos y condiciones.
            </p>
          </form>
        )}

        <div className="text-center mt-8">
          <a href="/" className="text-sm text-emerald-400 hover:underline">
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
