<!--
  Onboarding (ticket 12): the three steps a new traveller goes through after
  their first sign-in, each of which they may skip. Reopened at one step, from
  the home banner or Réglages, with `?step=`.
-->
<script setup lang="ts">
import { isOnboardingStep, isOnboardingStepDone, ONBOARDING_STEPS, onboardingStepAfter, type OnboardingStep } from '#shared/domain/onboarding'

// No tab bar: the traveller goes through the steps, or skips them.
definePageMeta({ layout: 'signed-out' })

useHead({ title: 'Bienvenue' })

const route = useRoute()
const { progress, refresh, moveTo } = await useOnboarding()

/** A single step reopened once the traveller left the flow; mid-flow, the flow's own step shows instead. */
const reopened = computed(() => progress.value?.current === 'done' && isOnboardingStep(route.query.step) ? route.query.step : null)
const step = computed((): OnboardingStep | null => {
  if (reopened.value) return reopened.value
  const current = progress.value?.current ?? 'configuration'
  return current === 'done' ? null : current
})

// The traveller left the flow, and reopened no step.
if (!step.value) await navigateTo('/', { replace: true })

const STEP_TEXTS: Record<OnboardingStep, { title: string, text: string }> = {
  configuration: {
    title: 'Votre week-end type',
    text: 'Ajoutez au moins une route à l’aller ou au retour. Chaque week-end des 30 prochains jours partira de ce billet.',
  },
  installation: {
    title: 'Ajoutez Veille MAX à l’écran d’accueil',
    text: 'Sur iPhone, Veille MAX ne peut vous envoyer de notifications qu’une fois installée.',
  },
  notifications: {
    title: 'Activez les notifications',
    text: 'Pour réserver avant que la place ne parte.',
  },
}

const done = computed(() => !!step.value && !!progress.value && isOnboardingStepDone(progress.value, step.value))
const last = computed(() => !!reopened.value || (!!step.value && onboardingStepAfter(step.value) === 'done'))

const interactive = useInteractive()
const moving = ref(false)
const moveFailed = ref(false)

/** Moves on from the current step, whether the traveller completed or skipped it. */
async function next() {
  if (!step.value) return
  // Read before moving on: leaving the last step leaves no step to show.
  const leaving = last.value
  moving.value = true
  moveFailed.value = false
  try {
    // A reopened step only takes the traveller back home: they left the flow already.
    if (!reopened.value) await moveTo(onboardingStepAfter(step.value))
    if (leaving) await navigateTo('/')
  }
  catch (error) {
    console.error('The onboarding step could not be saved', error)
    moveFailed.value = true
  }
  finally {
    moving.value = false
  }
}
</script>

<template>
  <div v-if="step">
    <PageHeader
      :eyebrow="reopened ? 'Bienvenue' : `Étape ${ONBOARDING_STEPS.indexOf(step) + 1} sur ${ONBOARDING_STEPS.length}`"
      :title="STEP_TEXTS[step].title"
    >
      <p class="mt-2 text-[13px] leading-snug font-medium text-ink-muted">
        {{ STEP_TEXTS[step].text }}
      </p>
      <ol
        v-if="!reopened"
        class="mt-4 flex gap-1.5"
        aria-hidden="true"
      >
        <li
          v-for="(each, index) in ONBOARDING_STEPS"
          :key="each"
          class="h-1.5 flex-1 rounded-full"
          :class="index <= ONBOARDING_STEPS.indexOf(step) ? 'bg-accent' : 'bg-surface-muted'"
        />
      </ol>
    </PageHeader>

    <div class="mt-6 px-6">
      <template v-if="step === 'configuration'">
        <p
          v-if="done"
          role="status"
          class="mb-4 rounded-card bg-booked-soft px-5 py-4 text-sm font-bold text-booked-ink"
        >
          Week-end type configuré
        </p>
        <TripTemplateEditor @saved="refresh()" />
      </template>
      <OnboardingInstallation
        v-else-if="step === 'installation'"
        :installed="progress?.installed ?? false"
      />
      <OnboardingNotifications
        v-else
        :notified="progress?.notified ?? false"
        @enabled="refresh()"
      />

      <button
        type="button"
        :disabled="!interactive || moving"
        class="mt-6 h-12 w-full rounded-control text-sm font-bold transition-opacity disabled:opacity-60"
        :class="done ? 'bg-inverse text-on-inverse hover:opacity-90' : 'bg-surface-muted hover:opacity-80'"
        @click="next"
      >
        {{ done ? (last ? 'Terminer' : 'Continuer') : (reopened ? 'Plus tard' : 'Passer cette étape') }}
      </button>
      <p
        v-if="moveFailed"
        role="alert"
        class="mt-2 text-[13px] leading-snug font-semibold text-accent-ink"
      >
        Impossible d’enregistrer votre progression pour l’instant. Réessayez dans un moment.
      </p>
    </div>
  </div>
</template>
