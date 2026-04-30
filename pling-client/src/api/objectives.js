import client from './client'

export const createObjective = (achievementId, data) =>
  client.post(`/objectives/achievement/${achievementId}`, data)
export const updateObjective = (id, data) =>
  client.patch(`/objectives/${id}`, data)
export const deleteObjective = (id) =>
  client.delete(`/objectives/${id}`)
export const updateObjectiveProgress = (id, data) =>
  client.patch(`/objectives/${id}/progress`, data)
export const reorderObjectives = (achievementId, orderedIds) =>
  client.post(`/objectives/achievement/${achievementId}/reorder`, orderedIds)