import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'DentalOS - Sistema de gestión dental'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #111827 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(77,168,240,0.15) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-80px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(43,143,214,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo + Name row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          {/* Tooth icon */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #1e1e1e, #111)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(77,168,240,0.3)',
              border: '1px solid rgba(77,168,240,0.2)',
            }}
          >
            {/* Simplified tooth SVG as text representation */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              width="50"
              height="50"
            >
              <defs>
                <linearGradient id="tg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#d8e8f5" />
                </linearGradient>
                <linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#4da8f0" />
                  <stop offset="100%" stopColor="#2b8fd6" />
                </linearGradient>
              </defs>
              <path
                d="M10,8 C10,7 11,6 12.5,6 C13.5,6 14.5,6.8 16,6.8 C17.5,6.8 18.5,6 19.5,6 C21,6 22,7 22,8 C22,10 21.5,12 21,14 C20.5,16.5 20,19 19.5,21 C19.2,22.5 18.5,23 18,23 C17.5,23 17,22 16.8,21 C16.5,19.5 16,18 16,18 C16,18 15.5,19.5 15.2,21 C15,22 14.5,23 14,23 C13.5,23 12.8,22.5 12.5,21 C12,19 11.5,16.5 11,14 C10.5,12 10,10 10,8 Z"
                fill="url(#tg)"
              />
              <rect x="10" y="13" width="12" height="2" rx="1" fill="url(#ag)" opacity="0.7" />
              <circle cx="23.5" cy="8.5" r="3" fill="url(#ag)" />
            </svg>
          </div>

          {/* Brand name */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: '64px',
                fontWeight: '800',
                color: '#ffffff',
                letterSpacing: '-2px',
                lineHeight: 1,
              }}
            >
              Dental
              <span style={{ color: '#4da8f0' }}>OS</span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '120px',
            height: '3px',
            background: 'linear-gradient(90deg, #4da8f0, #2b8fd6)',
            borderRadius: '2px',
            marginBottom: '28px',
            display: 'flex',
          }}
        />

        {/* Tagline */}
        <p
          style={{
            fontSize: '28px',
            color: 'rgba(255,255,255,0.75)',
            margin: 0,
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.4,
          }}
        >
          Sistema de gestión para clínicas dentales
        </p>

        {/* Bottom badges */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '48px',
          }}
        >
          {['Agenda', 'Pacientes', 'Pagos', 'Radiografías'].map((label) => (
            <div
              key={label}
              style={{
                padding: '8px 20px',
                borderRadius: '999px',
                background: 'rgba(77,168,240,0.1)',
                border: '1px solid rgba(77,168,240,0.25)',
                color: '#4da8f0',
                fontSize: '16px',
                fontWeight: '500',
                display: 'flex',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
