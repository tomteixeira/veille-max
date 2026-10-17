<script setup lang="ts">
useHead({ title: 'Réglages' })

const [{ routeWeight, save: saveRouteWeight }, { progress }] = await Promise.all([useRouteWeight(), useOnboarding()])

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
        Chaque week-end des 30 prochains jours partira de ce billet. Touchez l’aller ou le retour pour le modifier.
      </p>
    </PageHeader>

    <TripTemplateEditor class="mx-6 mt-5" />

    <section
      class="mt-7 space-y-4 px-6"
      aria-label="Autres réglages"
    >
      <RouteWeightCard
        :route-weight="routeWeight"
        :save="saveRouteWeight"
        :disabled="!interactive"
      />

      <NotificationsCard />

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
            <dd
              v-if="progress?.installed"
              class="text-[13px] font-semibold text-booked-ink"
            >
              Installée sur l’écran d’accueil
            </dd>
            <dd v-else>
              <NuxtLink
                to="/onboarding?step=installation"
                class="text-[13px] font-bold text-accent-ink hover:underline"
              >
                Installer sur l’écran d’accueil
              </NuxtLink>
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
