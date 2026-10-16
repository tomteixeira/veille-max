<!--
  The installation step of onboarding: illustrated instructions for adding the
  app to an iPhone's home screen (« Partager → Sur l’écran d’accueil »), which
  iOS requires before it sends notifications.
-->
<script setup lang="ts">
import { BookOpen, ChevronLeft, ChevronRight, Copy, Share, SquarePlus } from '@lucide/vue'

defineProps<{
  /** The app already ran from the home screen of one of the traveller's devices. */
  installed: boolean
}>()
</script>

<template>
  <div>
    <p
      v-if="installed"
      role="status"
      class="rounded-card bg-booked-soft px-5 py-4 text-sm font-bold text-booked-ink"
    >
      Installée sur l’écran d’accueil
    </p>

    <ol
      class="space-y-3"
      :class="{ 'mt-4': installed }"
      aria-label="Ajouter Veille MAX à l’écran d’accueil"
    >
      <li class="rounded-card bg-surface p-5">
        <p class="text-sm font-bold">
          <span class="text-accent-ink">1.</span> Dans Safari, touchez Partager
        </p>
        <div
          class="mt-3 flex items-center justify-around rounded-control bg-surface-muted py-2.5 text-ink-faint"
          aria-hidden="true"
        >
          <ChevronLeft :size="20" />
          <ChevronRight :size="20" />
          <span class="grid size-9 place-items-center rounded-full bg-accent text-on-accent ring-4 ring-accent-soft">
            <Share
              :size="18"
              :stroke-width="2.2"
            />
          </span>
          <BookOpen :size="20" />
          <Copy :size="20" />
        </div>
      </li>

      <li class="rounded-card bg-surface p-5">
        <p class="text-sm font-bold">
          <span class="text-accent-ink">2.</span> Choisissez « Sur l’écran d’accueil »
        </p>
        <p class="mt-0.5 text-[13px] font-medium text-ink-muted">
          Faites défiler la liste si vous ne le voyez pas.
        </p>
        <div
          class="mt-3 divide-y divide-line rounded-control bg-surface-muted text-[13px] font-semibold"
          aria-hidden="true"
        >
          <div class="flex items-center justify-between px-4 py-2.5 text-ink-faint">
            Ajouter aux favoris
          </div>
          <div class="flex items-center justify-between px-4 py-2.5 rounded-control text-ink ring-2 ring-accent">
            Sur l’écran d’accueil
            <SquarePlus
              :size="18"
              class="text-accent-ink"
            />
          </div>
        </div>
      </li>

      <li class="rounded-card bg-surface p-5">
        <p class="text-sm font-bold">
          <span class="text-accent-ink">3.</span> Ouvrez Veille MAX depuis l’écran d’accueil
        </p>
        <p class="mt-0.5 text-[13px] font-medium text-ink-muted">
          L’étape se valide d’elle-même au premier lancement.
        </p>
        <div
          class="mt-3 flex flex-col items-center gap-1.5"
          aria-hidden="true"
        >
          <img
            src="/apple-touch-icon-180x180.png"
            alt=""
            class="size-14 rounded-2xl shadow-float"
          >
          <span class="text-[11px] font-semibold">Veille MAX</span>
        </div>
      </li>
    </ol>

    <p class="mt-4 text-[13px] leading-snug font-medium text-ink-muted">
      Sur Android ou sur ordinateur, choisissez « Installer l’application » dans le menu du navigateur.
    </p>
  </div>
</template>
