import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  user: { id: string; name: string; email: string; role: string } | null
  restaurant: { id: string; name: string; slug: string } | null
  _hasHydrated: boolean
  setAuth: (token: string, user: AuthState['user'], restaurant: AuthState['restaurant']) => void
  clearAuth: () => void
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      restaurant: null,
      _hasHydrated: false,
      setAuth: (token, user, restaurant) => {
        localStorage.setItem('tako_token', token)
        set({ token, user, restaurant })
      },
      clearAuth: () => {
        localStorage.removeItem('tako_token')
        set({ token: null, user: null, restaurant: null })
      },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'tako-auth',
      partialize: (s) => ({ token: s.token, user: s.user, restaurant: s.restaurant }),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true) },
    }
  )
)

interface ThemeState {
  theme: 'tako' | 'premium'
  setTheme: (t: 'tako' | 'premium') => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'premium',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'tako-theme-v2' }
  )
)

interface OrdersState {
  pendingCount: number
  setPendingCount: (n: number) => void
  increment: () => void
}

export const useOrdersStore = create<OrdersState>((set) => ({
  pendingCount: 0,
  setPendingCount: (n) => set({ pendingCount: n }),
  increment: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
}))

interface OnboardingState {
  completedSteps: string[]
  completeStep: (id: string) => void
  isStepComplete: (id: string) => boolean
  resetOnboarding: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completedSteps: [],
      completeStep: (id) => set(s => ({ completedSteps: [...new Set([...s.completedSteps, id])] })),
      isStepComplete: (id) => get().completedSteps.includes(id),
      resetOnboarding: () => set({ completedSteps: [] }),
    }),
    { name: 'tako-onboarding' }
  )
)
