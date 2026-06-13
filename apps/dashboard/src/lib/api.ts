import axios from 'axios'

export const api = axios.create({
  baseURL: typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api',
  headers: { 'Content-Type': 'application/json' },
  // Auth via cookie HttpOnly (tako_session): il browser lo allega da solo.
  withCredentials: true,
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
