/**
 * Whether the app runs from the home screen (the manifest's standalone display
 * mode) rather than in a browser tab. Browser only: call it once mounted.
 */
export function runsFromHomeScreen(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
}
