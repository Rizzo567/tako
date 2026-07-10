import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  // Invia il cookie HttpOnly del tavolo (tako_table) emesso al resolve del QR.
  withCredentials: true,
})
