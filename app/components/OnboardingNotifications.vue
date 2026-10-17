<!--
  The notifications step of onboarding: turns notifications on for the device
  in use, or says what stands in the way.
-->
<script setup lang="ts">
import { BellRing } from '@lucide/vue'

defineProps<{
  /** A device of the traveller already receives notifications. */
  notified: boolean
}>()

const emit = defineEmits<{
  /** Notifications were turned on for this device. */
  enabled: []
}>()

const { state, thisDevice, turnOn } = await usePushNotifications()

const blocker = computed(() => notificationsBlocker(state.value, thisDevice.value))
const enabling = ref(false)
const failed = ref(false)

async function enable() {
  enabling.value = true
  failed.value = false
  try {
    // Straight from the tap: iOS only asks for permission inside a user gesture.
    await turnOn()
    if (state.value === 'on') emit('enabled')
  }
  catch (error) {
    console.error('Notifications could not be turned on', error)
    failed.value = true
  }
  finally {
    enabling.value = false
  }
}
</script>

<template>
  <div>
    <p
      v-if="notified"
      role="status"
      class="rounded-card bg-booked-soft px-5 py-4 text-sm font-bold text-booked-ink"
    >
      Notifications activées
    </p>

    <div
      v-if="state !== 'on'"
      class="rounded-card bg-surface p-5"
      :class="{ 'mt-4': notified }"
    >
      <span class="grid size-10 place-items-center rounded-control bg-accent-soft text-accent-ink">
        <BellRing
          :size="18"
          :stroke-width="2"
          aria-hidden="true"
        />
      </span>
      <p class="mt-3 text-sm font-bold">
        Nouveaux trains, chaque matin
      </p>
      <p class="mt-0.5 text-[13px] leading-snug font-medium text-ink-muted">
        Une notification dès qu’un meilleur train sort, et un rappel la veille pour confirmer votre billet.
      </p>
      <p
        v-if="blocker"
        class="mt-3 text-[13px] leading-snug font-semibold text-accent-ink"
      >
        {{ blocker }}
      </p>
      <button
        type="button"
        :disabled="enabling || state !== 'off'"
        class="mt-4 h-12 w-full rounded-control bg-inverse text-sm font-bold text-on-inverse transition-opacity hover:opacity-90 disabled:opacity-60"
        @click="enable"
      >
        Activer les notifications sur {{ thisDevice }}
      </button>
      <p
        v-if="failed"
        role="alert"
        class="mt-2 text-[13px] leading-snug font-semibold text-accent-ink"
      >
        Impossible d’activer les notifications pour l’instant. Réessayez dans un moment.
      </p>
    </div>
  </div>
</template>
