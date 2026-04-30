import client from './client'

export const listAchievements = (gameId) =>
  client.get(`/achievements/game/${gameId}`)
export const getAchievement = (id) =>
  client.get(`/achievements/${id}`)
export const createAchievement = (data) =>
  client.post('/achievements', data)
export const updateAchievement = (id, data) =>
  client.patch(`/achievements/${id}`, data)
export const deleteAchievement = (id) =>
  client.delete(`/achievements/${id}`)
export const updateAchievementProgress = (id, data) =>
  client.patch(`/achievements/${id}/progress`, data)