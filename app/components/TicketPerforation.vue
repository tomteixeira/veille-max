<!-- The tear line between the two halves of a <TicketCard />. Decorative only. -->
<template>
  <div
    class="ticket-perforation relative h-6 shrink-0"
    aria-hidden="true"
  >
    <span class="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line" />
  </div>
</template>

<style scoped>
.ticket-perforation {
  /* Overlap the masks slightly to avoid a seam at fractional pixel widths. */
  mask:
    radial-gradient(circle at left, transparent 12px, black 12.5px) left / 51% 100% no-repeat,
    radial-gradient(circle at right, transparent 12px, black 12.5px) right / 51% 100% no-repeat;
}
</style>
