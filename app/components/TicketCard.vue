<!--
  The « Billets » card: a trip drawn as a train ticket. Its halves (Aller,
  Retour) are separated by a <TicketPerforation />. No overflow clipping, so
  the perforation notches can bite into the card edges.
-->
<template>
  <article class="rounded-ticket bg-surface shadow-ticket">
    <slot />
  </article>
</template>
