<script setup lang="ts">
import { computed } from 'vue'
import { cupTiers } from '../model/catalog.logic'
import type { CupTier } from '../model/restaurant.types'

const props = withDefaults(defineProps<{ tier: CupTier; compact?: boolean }>(), { compact: false })
const definition = computed(() => cupTiers.find((tier) => tier.key === props.tier)!)
</script>

<template>
  <span class="cup-badge" :class="{ compact }" :style="{ '--cup-color': definition.color }">
    <svg viewBox="0 0 48 52" fill="none" aria-hidden="true" focusable="false">
      <path d="M10 17h28l-4 29H14l-4-29Z" fill="currentColor" opacity=".13" />
      <path
        d="M10 17h28l-4 29H14l-4-29Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path
        d="M8 17h32M13 12h22M28 12l4-8"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M20 25c6-3 11 1 7 6-3 4-8 3-9 0-1-3 2-5 5-4"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
    <span>{{ definition.label }}</span>
  </span>
</template>

<style scoped>
.cup-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: color-mix(in srgb, var(--cup-color) 75%, #2b2a26);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
svg {
  width: 38px;
  height: 42px;
}
.compact {
  gap: 5px;
  padding: 4px 9px 4px 5px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--cup-color) 9%, transparent);
  font-size: 12px;
}
.compact svg {
  width: 20px;
  height: 24px;
}
</style>
