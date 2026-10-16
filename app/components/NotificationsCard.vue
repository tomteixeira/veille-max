<!--
  « Notifications » in Réglages: notifications on the device in use, the
  Confirmation Reminders, the traveller's devices, and a test notification
  that proves the whole chain works (tickets 09 and 11).
-->
<script setup lang="ts">
import { Laptop, Monitor, Smartphone, Tablet } from '@lucide/vue'

const [{ devices, state, isThisDevice, thisDevice, turnOn, turnOff, sendTest }, reminders] = await Promise.all([
  usePushNotifications(),
  useConfirmationReminders(),
])
const interactive = useInteractive()

const titleId = useId()

const switching = ref(false)
const switchFailed = ref(false)

async function toggle() {
  switching.value = true
  switchFailed.value = false
  try {
    // Straight from the tap: iOS only asks for permission inside a user gesture.
    await (state.value === 'on' ? turnOff() : turnOn())
  }
  catch (error) {
    console.error('Notifications could not be switched', error)
    switchFailed.value = true
  }
  finally {
    switching.value = false
  }
}

/** What the switch explains under its label, for each state of the device in use. */
const hint = computed(() => {
  switch (state.value) {
    case 'install':
      return 'Ajoutez d’abord Veille MAX à l’écran d’accueil : touchez Partager, puis « Sur l’écran d’accueil ».'
    case 'unsupported':
      return 'Ce navigateur ne peut pas recevoir de notifications.'
    case 'unavailable':
      return 'Les notifications ne sont pas encore disponibles.'
    case 'denied':
      return `Notifications refusées. Autorisez-les pour Veille MAX dans les réglages de ${thisDevice.value}.`
    default:
      return 'Nouveaux trains, chaque matin.'
  }
})

const savingReminders = ref(false)
const remindersFailed = ref(false)

async function toggleReminders(enabled: boolean) {
  savingReminders.value = true
  remindersFailed.value = false
  try {
    await reminders.save(enabled)
  }
  catch (error) {
    console.error('Confirmation reminders could not be switched', error)
    remindersFailed.value = true
  }
  finally {
    savingReminders.value = false
  }
}

const testState = ref<'idle' | 'sending' | 'failed' | 'unreachable'>('idle')
const delivered = ref<number | null>(null)

async function test() {
  testState.value = 'sending'
  delivered.value = null
  try {
    delivered.value = (await sendTest()).delivered
    testState.value = 'idle'
  }
  catch (error) {
    testState.value = (error as { statusCode?: number }).statusCode === 502 ? 'unreachable' : 'failed'
  }
}

/** « Notification envoyée à 2 appareils »: the outcome of the last test. */
const testOutcome = computed(() => {
  if (delivered.value === null) return ''
  if (delivered.value === 0) return 'Aucun appareil n’a reçu la notification.'
  return delivered.value === 1 ? 'Notification envoyée à 1 appareil.' : `Notification envoyée à ${delivered.value} appareils.`
})

const DEVICE_ICONS: Record<DeviceLabel, typeof Smartphone> = {
  'iPhone': Smartphone,
  'Android': Smartphone,
  'iPad': Tablet,
  'Mac': Laptop,
  'Chromebook': Laptop,
  'PC Windows': Monitor,
  'Linux': Monitor,
  'Appareil': Smartphone,
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })
</script>

<template>
  <SurfaceCard
    as="section"
    :aria-labelledby="titleId"
  >
    <h2
      :id="titleId"
      class="text-[15px] font-extrabold"
    >
      Notifications
    </h2>

    <AppSwitch
      class="mt-3"
      :model-value="state === 'on'"
      :label="`Notifications sur ${thisDevice}`"
      :hint="hint"
      :disabled="switching || (state !== 'on' && state !== 'off')"
      @update:model-value="toggle"
    />
    <p
      v-if="switchFailed"
      role="alert"
      class="mt-2 text-[13px] leading-snug font-semibold text-accent-ink"
    >
      Impossible de changer les notifications de {{ thisDevice }} pour l’instant. Réessayez dans un moment.
    </p>

    <AppSwitch
      class="mt-4"
      :model-value="reminders.enabled.value"
      label="Rappel de confirmation"
      hint="À midi la veille de chaque trajet réservé : confirmez-le sur MAX JEUNE avant 17:00, sinon SNCF l’annule."
      :disabled="!interactive || savingReminders"
      @update:model-value="toggleReminders"
    />
    <p
      v-if="remindersFailed"
      role="alert"
      class="mt-2 text-[13px] leading-snug font-semibold text-accent-ink"
    >
      Impossible de changer le rappel de confirmation pour l’instant. Réessayez dans un moment.
    </p>

    <h3 class="mt-5 text-sm font-bold">
      Appareils
    </h3>
    <ul
      v-if="devices.length > 0"
      class="mt-1"
      aria-label="Appareils"
    >
      <li
        v-for="device in devices"
        :key="device.endpoint"
        class="flex items-center gap-3 py-1.5 text-[13px] font-semibold"
      >
        <component
          :is="DEVICE_ICONS[device.deviceLabel as DeviceLabel] ?? Smartphone"
          :size="18"
          class="shrink-0 text-ink-faint"
          aria-hidden="true"
        />
        <span class="flex-1">
          {{ device.deviceLabel }}
          <span class="block text-[11px] font-medium text-ink-muted">
            Depuis le {{ dateFormat.format(new Date(device.createdAt)) }}
          </span>
        </span>
        <AppChip v-if="isThisDevice(device.endpoint)">
          Cet appareil
        </AppChip>
      </li>
    </ul>
    <p
      v-else
      class="mt-1 text-[13px] font-medium text-ink-muted"
    >
      Aucun appareil ne reçoit les notifications pour l’instant.
    </p>

    <button
      type="button"
      :disabled="devices.length === 0 || testState === 'sending'"
      class="mt-4 h-11 w-full rounded-control bg-surface-muted text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
      @click="test"
    >
      Envoyer une notification de test
    </button>
    <p
      v-if="testState === 'failed' || testState === 'unreachable'"
      role="alert"
      class="mt-2 text-[13px] leading-snug font-semibold text-accent-ink"
    >
      {{ testState === 'unreachable'
        ? 'Aucun appareil n’a pu être joint. Réessayez dans un moment.'
        : 'Envoi impossible pour l’instant. Réessayez dans un moment.' }}
    </p>
    <p
      v-else
      role="status"
      class="mt-2 min-h-5 text-[13px] font-semibold text-ink-muted"
    >
      {{ testOutcome }}
    </p>
  </SurfaceCard>
</template>
