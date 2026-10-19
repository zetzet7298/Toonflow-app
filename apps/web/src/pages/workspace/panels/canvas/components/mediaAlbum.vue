<template>
  <el-card v-if="visible" class="mediaAlbum" shadow="never" :bodyStyle="{ padding: '8px' }" role="region" aria-label="媒体相册" @dblclick.stop>
    <div class="albumToolbar">
      <el-input v-model="searchQuery" class="searchInput" :prefixIcon="IconSearch" placeholder="搜索文件" aria-label="搜索文件" clearable @keydown.esc.stop="searchQuery = ''" />
      <el-select v-model="kindFilter" class="kindSelect" aria-label="媒体类型">
        <el-option label="全部" value="all" />
        <el-option label="图片" value="image" />
        <el-option label="视频" value="video" />
        <el-option label="音频" value="audio" />
      </el-select>
      <el-button class="toolbarButton" text :icon="IconRefresh" title="刷新" aria-label="刷新" :loading="loading" @click="refresh" />
      <el-button class="toolbarButton" text :icon="IconX" title="关闭相册" aria-label="关闭相册" @click="visible = false" />
    </div>
    <el-scrollbar class="albumScroll" maxHeight="min(480px, calc(100dvh - 198px))">
      <div v-if="!loading && !visibleItems.length" class="albumEmpty">暂无媒体文件</div>
      <div v-else class="albumGrid">
        <mediaCard v-for="item in visibleItems" :key="item.path" :item="item" :directory="directory" @open="openPreview" />
      </div>
    </el-scrollbar>
    <div class="albumFooter">{{ visibleItems.length }} 个媒体文件{{ truncated ? "（已达扫描上限）" : "" }}</div>
  </el-card>

  <el-image-viewer v-if="previewAsset?.kind === 'image'" :urlList="[previewAsset.url]" teleported @close="previewAsset = undefined" />
  <el-dialog :modelValue="previewAsset?.kind === 'video'" :title="previewAsset?.name" width="min(800px, calc(100vw - 32px))" alignCenter appendToBody destroyOnClose @update:modelValue="previewAsset = undefined">
    <video v-if="previewAsset?.kind === 'video'" :key="previewAsset.url" class="previewVideo" :src="previewAsset.url" :aria-label="previewAsset.name" controls playsinline preload="metadata" @error="previewError = '视频无法播放'" />
    <el-alert v-if="previewError" :title="previewError" type="error" :closable="false" showIcon />
  </el-dialog>
  <el-dialog :modelValue="previewAsset?.kind === 'audio'" :title="previewAsset?.name" width="min(560px, calc(100vw - 32px))" alignCenter appendToBody destroyOnClose @update:modelValue="previewAsset = undefined">
    <audio v-if="previewAsset?.kind === 'audio'" :key="previewAsset.url" :src="previewAsset.url" :aria-label="previewAsset.name" controls preload="metadata" style="width: 100%" @error="previewError = '音频无法播放'" />
    <el-alert v-if="previewError" :title="previewError" type="error" :closable="false" showIcon />
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { IconMusic, IconPhoto, IconRefresh, IconSearch, IconVideo, IconX } from "@tabler/icons-vue";
import useWorkspaceFiles from "@/lib/workspaceFiles";
import mediaCard from "./mediaCard.vue";

type MediaKind = "image" | "video" | "audio";
type AlbumItem = { name: string; path: string; kind: MediaKind };

const props = defineProps<{ directory: string | undefined }>();
const visible = defineModel<boolean>({ default: false });

const files = useWorkspaceFiles(() => props.directory);
const items = ref<AlbumItem[]>([]);
const loading = ref(false);
const truncated = ref(false);
const searchQuery = ref("");
const kindFilter = ref<"all" | MediaKind>("all");
const previewAsset = ref<{ name: string; url: string; kind: MediaKind }>();
let previewHandle: { release: () => void } | undefined;
const previewError = ref("");
let loadRequest = 0;

const maxItems = 400;
const maxDepth = 6;

function mediaKind(name: string): MediaKind | undefined {
  if (/\.(avif|apng|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(name)) return "image";
  if (/\.(mp4|m4v|webm|mov|mkv|avi|ogv)$/i.test(name)) return "video";
  if (/\.(mp3|wav|ogg|opus|flac|m4a|aac)$/i.test(name)) return "audio";
}

const visibleItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return items.value.filter(item =>
    (kindFilter.value === "all" || item.kind === kindFilter.value) &&
    (!query || item.name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query)));
});

async function refresh() {
  const requestId = ++loadRequest;
  loading.value = true;
  truncated.value = false;
  const collected: AlbumItem[] = [];
  try {
    const queue: { path: string; depth: number }[] = [{ path: "", depth: 0 }];
    while (queue.length && collected.length < maxItems) {
      const current = queue.shift()!;
      const { entries } = await files.list(current.path);
      if (requestId !== loadRequest) return;
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        if (entry.type === "directory") {
          if (current.depth < maxDepth) queue.push({ path: entry.path, depth: current.depth + 1 });
          continue;
        }
        const kind = mediaKind(entry.name);
        if (kind) collected.push({ name: entry.name, path: entry.path, kind });
        if (collected.length >= maxItems) { truncated.value = true; break; }
      }
    }
    if (requestId === loadRequest) items.value = collected;
  } catch {
    if (requestId === loadRequest) items.value = [];
  } finally {
    if (requestId === loadRequest) loading.value = false;
  }
}

async function openPreview(item: AlbumItem) {
  previewError.value = "";
  previewHandle?.release();
  previewHandle = undefined;
  previewAsset.value = undefined;
  const current = files.acquireUrl(item.path);
  try {
    const url = await current.url;
    previewHandle = current;
    previewAsset.value = { name: item.name, url, kind: item.kind };
  } catch {
    current.release();
    previewError.value = "无法读取文件";
  }
}

watch(previewAsset, value => {
  if (!value && previewHandle) { previewHandle.release(); previewHandle = undefined; }
});

watch(visible, value => { if (value) refresh(); });
watch(() => props.directory, () => { if (visible.value) refresh(); });
</script>

<style lang="scss" scoped>
.mediaAlbum {
  width: min(360px, calc(100vw - 30px));
  max-height: calc(100dvh - 140px);
  margin-top: 8px;
}

.albumToolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;

  .searchInput {
    flex: 1;
    min-width: 0;
  }

  .kindSelect {
    width: 82px;
    flex-shrink: 0;
  }
}

.albumScroll {
  min-height: 120px;
}

.albumEmpty {
  padding: 40px 0;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.albumGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.albumFooter {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: right;
}

.previewVideo {
  width: 100%;
  max-height: 70dvh;
  background: #000;
}
</style>
