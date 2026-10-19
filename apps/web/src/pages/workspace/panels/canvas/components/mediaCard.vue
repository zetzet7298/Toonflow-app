<template>
  <div class="albumCard" :title="item.path" @click="$emit('open', item)">
    <el-image v-if="item.kind === 'image'" class="cardThumb" :src="url" fit="cover" loading="lazy">
      <template #error><icon-photo :size="24" /></template>
    </el-image>
    <video v-else-if="item.kind === 'video' && url" class="cardThumb cardVideo" :src="`${url}#t=0.5`" muted playsinline preload="metadata" />
    <div v-else-if="item.kind === 'video'" class="cardThumb cardIcon"><icon-video :size="24" /></div>
    <div v-else class="cardThumb cardIcon"><icon-music :size="24" /></div>
    <div class="cardMeta">
      <span class="cardName">{{ item.name }}</span>
      <span class="cardKind">{{ item.kind }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { IconMusic, IconPhoto, IconVideo } from "@tabler/icons-vue";
import useWorkspaceFiles from "@/lib/workspaceFiles";

const props = defineProps<{
  item: { name: string; path: string; kind: "image" | "video" | "audio" };
  directory: string | undefined;
}>();
defineEmits<{ open: [item: { name: string; path: string; kind: "image" | "video" | "audio" }] }>();

const files = useWorkspaceFiles(() => props.directory);
const url = ref("");
let preview: { url: Promise<string>; release: () => void } | undefined;

watch(() => [props.item.path, props.directory], async () => {
  preview?.release();
  preview = undefined;
  url.value = "";
  if (!props.item.path) return;
  const current = files.acquireUrl(props.item.path);
  preview = current;
  try {
    const resolved = await current.url;
    if (preview === current) url.value = resolved;
  } catch {
    /* thumbnail failed; card still shows icon */
  }
}, { immediate: true });

onBeforeUnmount(() => {
  preview?.release();
  preview = undefined;
});
</script>

<style lang="scss" scoped>
.albumCard {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  background: var(--el-fill-color-lighter);

  &:hover {
    border-color: var(--el-color-primary);
  }
}

.cardThumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}

.cardVideo {
  background: #000;
}

.cardMeta {
  display: flex;
  flex-direction: column;
  padding: 4px 6px;
  gap: 2px;
}

.cardName {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cardKind {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
}
</style>
