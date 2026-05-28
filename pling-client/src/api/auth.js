import client from './client'

export const register = (data) => client.post('/users/register', data)
export const login = (data) => client.post('/users/login', data)
export const getMe = () => client.get('/users/me')
export const updateMe = (data) => client.patch('/users/me', data)
export const getMyStats = () => client.get('/users/me/stats')
export const getPublicProfile = (username) => client.get(`/public/users/${username}`)

// Email verification
export const sendVerification = () => client.post('/users/send-verification')

// Social auth
export const googleAuth = (accessToken) => client.post('/auth/google', { access_token: accessToken })
export const appleAuth = (data) => client.post('/auth/apple', data)
export const confirmMerge = (token) => client.get(`/auth/confirm-merge?token=${token}`)
export const completeSocialSignup = (setup_token, username) =>
  client.post('/auth/complete-social-signup', { setup_token, username })

// Discord OAuth
export const getDiscordAuthUrl = () => client.get('/auth/discord/url')