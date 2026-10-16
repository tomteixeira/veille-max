<script setup lang="ts">
useHead({ title: 'Réglages' })

// Defaults of a new traveller's trip template (ticket 03) and route weight (CONTEXT.md).
const legs = [
  { kind: 'Aller', weekday: 'Vendredi' },
  { kind: 'Retour', weekday: 'Dimanche' },
] as const
const DEFAULT_ROUTE_WEIGHT_MINUTES = 30

const upcomingCards = [
  { title: 'Notifications', text: 'Nouveaux trains chaque matin et rappel de confirmation la veille, sur chacun de vos appareils.' },
] as const

const supabase = useSupabaseClient()
const traveller = useSupabaseUser()
const interactive = useInteractive()
const signingOut = ref(false)
const signOutFailed = ref(false)

async function signOut() {
  signingOut.value = true
  signOutFailed.value = false
  // This device only: the traveller stays signed in on their other devices.
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) {
    signingOut.value = false
    signOutFailed.value = true
    return
  }
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Réglages"
      title="Votre week-end type"
    >
      <p class="mt-2 text-[13px] font-medium text-ink-muted">
        Chaque week-end des 30 prochains jours partira de ce billet.
      </p>
    </PageHeader>

    <TicketCard class="mx-6 mt-5">
      <template
        v-for="(leg, index) in legs"
        :key="leg.kind"
      >
        <TicketPerforation v-if="index > 0" />
        <div class="px-5 pt-5 pb-4">
          <div class="flex items-center justify-between">
            <span class="eyebrow">{{ leg.kind }} · {{ leg.weekday }}</span>
            <AppChip>À configurer</AppChip>
          </div>
          <p class="mt-3 text-[13px] font-bold text-ink-muted">
            Fenêtre optimale
          </p>
          <p class="text-[26px] leading-9 font-extrabold tracking-tight text-ink-faint">
            À définir
          </p>
          <p class="mt-3 text-[13px] font-medium text-ink-muted">
            Aucune route pour l’instant
          </p>
        </div>
      </template>
    </TicketCard>

    <section
      class="mt-7 space-y-4 px-6"
      aria-label="Autres réglages"
    >
      <SurfaceCard>
        <div class="flex items-baseline justify-between gap-4">
          <h2 class="text-[15px] font-extrabold">
            Pondération des gares
          </h2>
          <p class="tnum text-2xl font-extrabold">
            {{ DEFAULT_ROUTE_WEIGHT_MINUTES }} min
          </p>
        </div>
        <p class="mt-2 text-[13px] leading-snug font-medium text-ink-muted">
          Quand aucun train n’entre dans la fenêtre optimale, un rang de gare vaut {{ DEFAULT_ROUTE_WEIGHT_MINUTES }} minutes d’écart.
        </p>
      </SurfaceCard>

      <SurfaceCard
        v-for="card in upcomingCards"
        :key="card.title"
      >
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-[15px] font-extrabold">
            {{ card.title }}
          </h2>
          <AppChip>Bientôt</AppChip>
        </div>
        <p class="mt-2 text-[13px] leading-snug font-medium text-ink-muted">
          {{ card.text }}
        </p>
      </SurfaceCard>

      <SurfaceCard
        as="section"
        aria-labelledby="account-title"
      >
        <h2
          id="account-title"
          class="text-[15px] font-extrabold"
        >
          Compte et application
        </h2>
        <dl class="mt-2">
          <div class="flex items-center justify-between gap-4 py-2">
            <dt class="text-[13px] font-bold">
              Compte
            </dt>
            <dd class="truncate text-[13px] font-medium text-ink-muted">
              {{ traveller?.email }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-2">
            <dt class="text-[13px] font-bold">
              Application
            </dt>
            <dd>
              <AppChip>Bientôt</AppChip>
            </dd>
          </div>
        </dl>
        <p
          v-if="signOutFailed"
          role="alert"
          class="mt-2 text-[13px] leading-snug font-semibold text-accent-ink"
        >
          Déconnexion impossible pour l’instant. Réessayez dans un moment.
        </p>
        <button
          type="button"
          :disabled="!interactive || signingOut"
          class="mt-3 h-11 w-full rounded-control bg-surface-muted text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
          @click="signOut"
        >
          Se déconnecter
        </button>
      </SurfaceCard>
    </section>
  </div>
</template>
