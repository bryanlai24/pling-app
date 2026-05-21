import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pling_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('pling_token')
      localStorage.removeItem('pling_token')
      // Only redirect to login if the user had an active session that expired.
      // If there was no token, they're an unauthenticated visitor — let the
      // page handle it (public routes render fine without auth).
      if (hadToken) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client