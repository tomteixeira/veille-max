<!-- Layout of the pages a signed-out visitor can reach: no tab bar, since every tab requires signing in. -->
<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[env(safe-area-inset-top)]">
    <main class="flex-1">
      <slot />
    </main>
    <footer class="px-6 pt-10 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <LegalNote />
    </footer>
  </div>
</template>
