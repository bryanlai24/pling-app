import client from './client'

export const listGenres = () => client.get('/genres')
export const updateGameGenres = (gameId, genreIds) =>
  client.put(`/games/${gameId}/genres`, { genre_ids: genreIds })

