/**
 * Tells the server the signed-in traveller just changed settings that rank
 * their legs: the reference of each changed leg becomes its current best
 * candidate, so the change itself never notifies (spec, "Settings writes").
 *
 * Best effort: the settings are saved by then, and should the reset fail, the
 * next snapshot replaces the changed legs' references without notifying.
 */
export async function resetLegReferences(): Promise<void> {
  try {
    await $fetch('/api/references/reset', { method: 'POST' })
  }
  catch (error) {
    console.error('Resetting the leg references failed', error)
  }
}
