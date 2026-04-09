import type { Metadata } from 'next'
import { Providers } from './providers'
import { PHProvider } from './providers/posthog'
import { PostHogPageview } from './providers/pageview'
import { Suspense } from 'react'
import './globals.css'

const siteUrl = 'https://dentalos.pro'

export const metadata: Metadata = {
  title: 'DentalOS',
  description: 'Sistema de gestión para clínicas dentales. Agenda, pacientes, pagos y más en un solo lugar.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'DentalOS',
    description: 'Sistema de gestión para clínicas dentales. Agenda, pacientes, pagos y más en un solo lugar.',
    url: siteUrl,
    siteName: 'DentalOS',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'DentalOS - Sistema de gestión dental',
      },
    ],
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DentalOS',
    description: 'Sistema de gestión para clínicas dentales. Agenda, pacientes, pagos y más en un solo lugar.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body>
        <PHProvider>
          <Suspense>
            <PostHogPageview />
          </Suspense>
          <Providers>
            {children}
          </Providers>
        </PHProvider>
      </body>
    </html>
  )
}