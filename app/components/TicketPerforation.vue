<!-- The tear line between the two halves of a <TicketCard />. Decorative only. -->
<template>
  <div
    class="relative h-6"
    aria-hidden="true"
  >
    <span class="absolute top-1/2 left-0 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas" />
    <span class="absolute top-1/2 right-0 size-6 translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas" />
    <span class="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line" />
  </div>
</template>
