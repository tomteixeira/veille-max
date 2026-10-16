<script setup lang="ts">
import type { LegKind } from '#shared/domain/trip-template'

useHead({ title: 'Réglages' })

const [{ template, stations, status, refresh, stationName, saveLeg }, { routeWeight, save: saveRouteWeight }] = await Promise.all([
  useTripTemplate(),
  useRouteWeight(),
])

/** The leg whose editor is open in the bottom sheet. */
const editing = ref<LegKind | null>(null)
const editorTitleId = useId()

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

    <TicketCard
      v-if="template"
      class="mx-6 mt-5"
    >
      <template
        v-for="(kind, index) in LEG_KINDS"
        :key="kind"
      >
        <TicketPerforation v-if="index > 0" />
        <TemplateLegHalf
          :kind="kind"
          :leg="template[kind]"
          :station-name="stationName"
          :disabled="!interactive"
          @edit="editing = kind"
        />
      </template>
    </TicketCard>
    <SurfaceCard
      v-else-if="status === 'error'"
      class="mx-6 mt-5"
    >
      <p
        role="alert"
        class="text-[13px] leading-snug font-semibold text-accent-ink"
      >
        Impossible de charger votre week-end type pour l’instant.
      </p>
      <button
        type="button"
        :disabled="!interactive"
        class="mt-3 h-11 w-full rounded-control bg-surface-muted text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
        @click="refresh()"
      >
        Réessayer
      </button>
    </SurfaceCard>

    <BottomSheet
      :open="editing !== null"
      :labelledby="editorTitleId"
      @close="editing = null"
    >
      <TemplateLegEditor
        v-if="editing && template"
        :key="editing"
        :kind="editing"
        :leg="template[editing]"
        :stations="stations"
        :station-name="stationName"
        :title-id="editorTitleId"
        :save="leg => saveLeg(editing!, leg)"
        @close="editing = null"
      />
    </BottomSheet>

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
