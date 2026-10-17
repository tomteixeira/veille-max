import type { ThisDeviceState } from '~/composables/usePushNotifications'

/**
 * Why notifications cannot be turned on on the device in use, for the
 * traveller to read; `null` when nothing stands in the way.
 */
export function notificationsBlocker(state: ThisDeviceState, thisDevice: string): string | null {
  switch (state) {
    case 'install':
      return 'Ajoutez d’abord Veille MAX à l’écran d’accueil : touchez Partager, puis « Sur l’écran d’accueil ».'
    case 'unsupported':
      return 'Ce navigateur ne peut pas recevoir de notifications.'
    case 'unavailable':
      return 'Les notifications ne sont pas encore disponibles.'
    case 'denied':
      return `Notifications refusées. Autorisez-les pour Veille MAX dans les réglages de ${thisDevice}.`
    default:
      return null
  }
}
