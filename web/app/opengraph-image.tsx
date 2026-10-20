import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'VitalOS - Software de gestión para consultorios de salud'
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
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F3FBF9 55%, #E6F8F1 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Decorative mint circles */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,196,188,0.18) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            left: '-100px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,196,188,0.14) 0%, transparent 70%)',
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
          {/* VitalOS brand mark (favicon) */}
          <div
            style={{
              display: 'flex',
              borderRadius: '18px',
              boxShadow: '0 12px 40px rgba(0,196,188,0.28)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 100 100"
              width="84"
              height="84"
            >
              {/* Fondo blanco redondeado (tile tipo app icon) */}
              <rect width="100" height="100" rx="22" fill="#FFFFFF" />
              {/* V (brand-ink) */}
              <path d="M14,28 L30,28 L41,61 L52,28 L68,28 L47,83 L35,83 Z" fill="#0F1720" />
              {/* Cruz médica (brand-teal) */}
              <rect x="75" y="22" width="11" height="33" rx="4" fill="#00C4BC" />
              <rect x="64" y="33" width="33" height="11" rx="4" fill="#00C4BC" />
            </svg>
          </div>

          {/* Brand name */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: '68px',
                fontWeight: '800',
                color: '#0F1720',
                letterSpacing: '-2px',
                lineHeight: 1,
              }}
            >
              Vital
              <span style={{ color: '#00C4BC' }}>OS</span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '120px',
            height: '4px',
            background: 'linear-gradient(90deg, #00C4BC, #00aaa3)',
            borderRadius: '2px',
            marginBottom: '28px',
            display: 'flex',
          }}
        />

        {/* Tagline */}
        <p
          style={{
            fontSize: '30px',
            color: '#4B5563',
            margin: 0,
            textAlign: 'center',
            maxWidth: '760px',
            lineHeight: 1.4,
          }}
        >
          La gestión de tu consultorio, simplificada
        </p>

        {/* Bottom badges */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '48px',
          }}
        >
          {['Agenda', 'Pacientes', 'Pagos', 'Historias clínicas'].map((label) => (
            <div
              key={label}
              style={{
                padding: '10px 22px',
                borderRadius: '999px',
                background: '#E6F8F1',
                border: '1px solid rgba(0,196,188,0.35)',
                color: '#00897F',
                fontSize: '17px',
                fontWeight: '600',
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
