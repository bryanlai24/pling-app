import client from './client'

export const listGameRequests = () =>
  client.get('/game-requests')

export const createGameRequest = (data) =>
  client.post('/game-requests', data)

export const voteGameRequest = (id) =>
  client.post(`/game-requests/${id}/vote`)

export const unvoteGameRequest = (id) =>
  client.delete(`/game-requests/${id}/vote`)

export const fulfillGameRequest = (id, gameId) =>
  client.patch(`/game-requests/${id}/fulfill`, null, { params: { game_id: gameId } })
