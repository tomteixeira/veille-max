/**
 * Tells the server the signed-in traveller just changed settings that rank
 * their legs: each leg's reference becomes its current best candidate, so the
 * change itself never notifies (spec, "Settings writes").
 */
export function resetLegReferences(): Promise<void> {
  return $fetch('/api/references/reset', { method: 'POST' })
}
