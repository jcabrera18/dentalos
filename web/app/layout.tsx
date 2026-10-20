import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Providers } from './providers'
import { QueryProvider } from '@/lib/queryClient'
import { PHProvider } from './providers/posthog'
import { PostHogPageview } from './providers/pageview'
import { Suspense } from 'react'
import './globals.css'

const siteUrl = 'https://vitalos.com.ar'

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'VitalOS',
  description: 'Software de gestión para consultorios de salud. Agenda, pacientes, pagos y más en un solo lugar.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'VitalOS',
    description: 'Software de gestión para consultorios de salud. Agenda, pacientes, pagos y más en un solo lugar.',
    url: siteUrl,
    siteName: 'VitalOS',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'VitalOS - Software de gestión para consultorios de salud',
      },
    ],
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalOS',
    description: 'Software de gestión para consultorios de salud. Agenda, pacientes, pagos y más en un solo lugar.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning className="light">
      <head>
        {/* Aplica el tema guardado antes del paint (default: claro) para evitar parpadeo */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var theme = saved === 'dark' ? 'dark' : 'light';
                  var el = document.documentElement;
                  el.classList.toggle('dark', theme === 'dark');
                  el.classList.toggle('light', theme === 'light');
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Google Ads Conversion Tracking */}
        <Script 
          src="https://www.googletagmanager.com/gtag/js?id=AW-18082738848" 
          strategy="afterInteractive"
        />
        <Script 
          id="google-ads-config" 
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-18082738848');
            `,
          }}
        />
      </head>
      <body>
        <PHProvider>
          <Suspense>
            <PostHogPageview />
          </Suspense>
          <QueryProvider>
            <Providers>
              {children}
            </Providers>
          </QueryProvider>
        </PHProvider>
      </body>
    </html>
  )
}