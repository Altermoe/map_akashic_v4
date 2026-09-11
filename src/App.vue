<script setup lang="ts">
import cursorImageUrl from '@/assets/cursor_28.png?url'
import { AsyncTasksPopover } from '@/components/async-tasks-popover'

const style = {
  cursor: `url('${cursorImageUrl}') 2 2, default`,
}
</script>

<template>
  <div class="w-full h-full overflow-hidden" :style="style">
    <RouterView />
    <AsyncTasksPopover />
  </div>
</template>
