<script setup lang="ts">
import MapFilter from '@/components/map-filter/map-filter.vue'

const areaCode = defineModel<string | undefined>('areaCode', {
  required: false,
  default: '',
})
</script>

<template>
  <div class="flex-1 w-full">
    <MapFilter class="mt-2 mx-auto" v-model:area-code="areaCode" />
  </div>
</template>
