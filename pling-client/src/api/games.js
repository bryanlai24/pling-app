import client from './client'

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

export const syncPsnGame = (gameId) =>
  client.post(`/users/me/psn/sync/${gameId}`)