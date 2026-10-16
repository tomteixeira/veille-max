<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-lg flex-col pt-[env(safe-area-inset-top)]">
    <main class="flex-1">
      <slot />
    </main>
    <footer class="px-6 pt-10 pb-[calc(env(safe-area-inset-bottom)+7.5rem)]">
      <LegalNote />
    </footer>
    <AppTabBar />
  </div>
</template>
