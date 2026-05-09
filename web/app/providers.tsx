'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
}>({
  theme: 'dark',
  setTheme: () => {}
})

export function useAppTheme() {
  return useContext(ThemeContext)
}

const PlansModalContext = createContext<{
  openPlansModal: () => void
}>({
  openPlansModal: () => {}
})

export function usePlansModal() {
  return useContext(PlansModalContext)
}

export function PlansModalProvider({ openPlansModal, children }: { openPlansModal: () => void; children: React.ReactNode }) {
  return (
    <PlansModalContext.Provider value={{ openPlansModal }}>
      {children}
    </PlansModalContext.Provider>
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme
    const initial = saved ?? 'dark'
    setThemeState(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
    document.documentElement.classList.toggle('light', initial === 'light')
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.classList.toggle('light', t === 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}