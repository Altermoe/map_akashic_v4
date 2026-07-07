<script lang="ts" setup>
import { useMarkerStore } from '@/stores'

definePage({
  meta: {
    title: 'worker-marker-state',
  },
})

const markerStore = useMarkerStore()
</script>

<template>
  <div class="w-full h-full overflow-hidden">
    {{ markerStore.indexList.length }}
  </div>
</template>
