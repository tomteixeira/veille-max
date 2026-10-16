<script setup lang="ts">
useHead({ title: 'Dashboard' })

const MAX_JEUNE_BOOKING_LIMIT = 6

// Decorative silhouette of the release curve, shown until real history exists (ticket 14).
const ghostBarHeights = [36, 52, 68, 44, 28, 24, 20, 24, 18, 16, 20, 28, 48, 60, 40, 24, 18, 16, 20, 24, 32, 44, 56, 36, 20]
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Vos routes · aucun instantané pour l’instant"
      title="Dashboard"
    />

    <div class="mt-5 space-y-4 px-6">
      <SurfaceCard class="flex items-center gap-5">
        <p class="tnum text-[52px] leading-none font-extrabold tracking-tight">
          0<span class="text-ink-faint">/{{ MAX_JEUNE_BOOKING_LIMIT }}</span>
        </p>
        <div>
          <p class="text-sm font-bold">
            trajets réservés en ce moment
          </p>
          <div
            class="mt-2 flex gap-1.5"
            aria-hidden="true"
          >
            <span
              v-for="slot in MAX_JEUNE_BOOKING_LIMIT"
              :key="slot"
              class="size-2.5 rounded-full bg-line"
            />
          </div>
          <p class="mt-2 text-xs font-medium text-ink-muted">
            MAX JEUNE permet de garder {{ MAX_JEUNE_BOOKING_LIMIT }} trajets réservés à la fois.
          </p>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <p class="eyebrow">
          Sorties de places
        </p>
        <h2 class="mt-1 text-[19px] leading-snug font-extrabold tracking-tight">
          Vos premières tendances arrivent après quelques matins de veille.
        </h2>
        <div
          class="mt-5 flex h-28 items-end gap-0.5"
          aria-hidden="true"
        >
          <span
            v-for="(height, index) in ghostBarHeights"
            :key="index"
            class="flex-1 rounded-t-[4px] bg-surface-muted"
            :style="{ height: `${height}%` }"
          />
        </div>
        <p class="mt-3 text-xs font-medium text-ink-muted">
          L’historique démarre au premier instantané lu par Veille MAX : sorties de places, meilleurs créneaux et durée de vie des places sur vos routes.
        </p>
      </SurfaceCard>
    </div>
  </div>
</template>
