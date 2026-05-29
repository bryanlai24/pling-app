import client from './client'

export const getFeaturedGame = () => client.get('/public/featured-game')
export const getGameTrophySets = (gameId) => client.get(`/public/games/${gameId}/trophy-sets`)

export const listGames = (platform) =>
  client.get('/games', { params: { platform } })
export const getGame = (id) => client.get(`/games/${id}`)
export const createGame = (data) => client.post('/games', data)
export const updateGame = (id, data) => client.patch(`/games/${id}`, data)
export const deleteGame = (id) => client.delete(`/games/${id}`)

export const getLibrary = (status) =>
  client.get('/games/library/me', { params: { status } })
export const addToLibrary = (gameId) =>
  client.post('/games/library', { game_id: gameId })
export const updateLibraryEntry = (gameId, data) =>
  client.patch(`/games/library/${gameId}`, data)
export const removeFromLibrary = (gameId) =>
  client.delete(`/games/library/${gameId}`)

export const resetGameProgress = (gameId) =>
  client.post(`/games/library/${gameId}/reset-progress`)

export const syncPsnGame = (gameId) =>
  client.post(`/users/me/psn/sync/${gameId}`)

export const syncSteamGame = (gameId) =>
  client.post(`/users/me/steam/sync/${gameId}`)

export const syncXboxGame = (gameId) =>
  client.post(`/users/me/xbox/sync/${gameId}`)

export const getXboxAuthUrl = () =>
  client.get('/users/me/xbox/auth-url')

export const connectXbox = (code) =>
  client.post('/users/me/xbox/connect', { code })

export const disconnectXbox = () =>
  client.delete('/users/me/xbox/disconnect')