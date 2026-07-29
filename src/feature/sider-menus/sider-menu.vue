<script setup lang="ts">
import { DraggablePanel } from '@/components/draggable-panel'
</script>

<template>
  <DraggablePanel title="面板">
    <p class="sider-menu__placeholder">
      拖拽标题栏移动面板<br />
      悬停边缘缩放面板
    </p>
  </DraggablePanel>
</template>

<style scoped>
.sider-menu__placeholder {
  margin: 0;
  line-height: 1.6;
  color: var(--gl-5);
}
</style>
