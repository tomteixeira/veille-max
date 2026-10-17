<!--
  The « Billets » card: a trip drawn as a train ticket. Its halves (Aller,
  Retour) are separated by a <TicketPerforation />. Each child paints its own
  surface so the perforation can cut real holes; one filter shadows their union.
-->
<template>
  <article class="ticket-card flex flex-col">
    <slot />
  </article>
</template>

<style scoped>
.ticket-card {
  filter: var(--ticket-shadow);
}

.ticket-card > :deep(*) {
  background-color: var(--vm-surface);
}

.ticket-card > :deep(:first-child) {
  border-top-left-radius: var(--radius-ticket);
  border-top-right-radius: var(--radius-ticket);
}

.ticket-card > :deep(:last-child) {
  border-bottom-left-radius: var(--radius-ticket);
  border-bottom-right-radius: var(--radius-ticket);
}
</style>
