import type { Metadata } from 'next'
import { Providers } from './providers'
import { PHProvider } from './providers/posthog'
import { PostHogPageview } from './providers/pageview'
import { Suspense } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'DentalOS',
  description: 'Sistema de gestión dental',
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