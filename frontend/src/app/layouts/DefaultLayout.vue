<script setup lang="ts">
import AppHeader from '@/shared/ui/layout/AppHeader.vue'
import { useLoginStore } from '@/modules/auth'

const auth = useLoginStore()
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :authenticated="auth.authenticated"
      :username="auth.user?.username"
      :restoring="auth.restoring"
      :logging-out="auth.loggingOut"
      :has-session="auth.hasSession"
      :error="auth.error"
      @logout="auth.signOut"
      @retry="auth.restore"
    />
    <main>
      <RouterView />
    </main>
  </div>
</template>
