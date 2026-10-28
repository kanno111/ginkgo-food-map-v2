<script setup lang="ts">
import { computed } from 'vue'
import { cupTiers } from '../model/catalog.logic'
import type { CupTier } from '../model/restaurant.types'

// 原版 cupGlyph 的路径与 tierFg 规则保持一致，所有业务入口共用同一徽章。
const props = withDefaults(defineProps<{ tier: CupTier; compact?: boolean }>(), { compact: false })
const definition = computed(() => cupTiers.find((tier) => tier.key === props.tier)!)
const foreground = computed(() => (['medium', 'none'].includes(props.tier) ? '#2B2A26' : '#FFFFFF'))
</script>

<template>
  <span
    class="cup-badge"
    :class="{ compact, 'is-bucket': tier === 'bucket' }"
    :style="{ '--cup-color': definition.color, color: foreground }"
    :title="definition.description"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6.3 8.1h11.4l-1.35 10.2H7.65Z"
        fill="currentColor"
        :stroke="tier === 'bucket' ? '#E9B949' : 'rgba(255,255,255,0.35)'"
        stroke-width="1.1"
        stroke-linejoin="round"
      />
      <path
        d="M17 10.1h1.25a2.05 2.05 0 0 1 0 4.1h-1.05"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
      <path d="M5.3 5.7h13.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </svg>
    <span>{{ definition.label }}</span>
  </span>
</template>

<style scoped>
.cup-badge {
  display: inline-flex;
  justify-self: start;
  align-items: center;
  gap: 4px;
  padding: 4px 13px 4px 8px;
  border: 1px solid rgb(0 0 0 / 5%);
  border-radius: 999px;
  background: var(--cup-color);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.6;
  white-space: nowrap;
}
.is-bucket {
  box-shadow: 0 0 0 1.5px #e9b949 inset;
}
svg {
  display: block;
  width: 17px;
  height: 17px;
}
.compact {
  padding: 2px 9px 2px 5px;
  font-size: 11px;
}
.compact svg {
  width: 13px;
  height: 13px;
}
</style>
