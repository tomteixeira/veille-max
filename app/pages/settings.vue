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
  { title: 'Compte et application', text: 'Connexion par code reçu par e-mail et installation sur l’écran d’accueil.' },
] as const
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
    </section>
  </div>
</template>
