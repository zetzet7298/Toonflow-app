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
        <div v-for="item in visibleItems" :key="item.path" class="albumCard" :title="item.path" @click="openPreview(item)">
          <el-image v-if="item.kind === 'image'" class="cardThumb" :src="assetUrl(item.path)" fit="cover" loading="lazy">
            <template #error><icon-photo :size="24" /></template>
          </el-image>
          <video v-else-if="item.kind === 'video'" class="cardThumb cardVideo" :src="assetUrl(item.path)" muted playsinline preload="metadata" />
          <div v-else class="cardThumb cardIcon"><icon-music :size="24" /></div>
          <div class="cardMeta">
            <span class="cardName">{{ item.name }}</span>
            <span class="cardKind">{{ item.kind }}</span>
          </div>
        </div>
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
import { IconMusic, IconPhoto, IconRefresh, IconSearch, IconX } from "@tabler/icons-vue";
import useWorkspaceFiles from "@/lib/workspaceFiles";

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
const previewError = ref("");
let loadRequest = 0;

const maxItems = 400;
const maxDepth = 6;

function assetUrl(path: string) {
  return `/api/assets/read?path=${encodeURIComponent(path)}`;
}

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

function openPreview(item: AlbumItem) {
  previewError.value = "";
  previewAsset.value = { name: item.name, url: assetUrl(item.path), kind: item.kind };
}

watch(visible, value => { if (value) refresh(); });
watch(() => props.directory, () => { if (visible.value) refresh(); });
</script>

<style lang="scss" scoped>
.mediaAlbum {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  width: min(360px, calc(100vw - 24px));
}

.albumToolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;

  .searchInput {
    flex: 1;
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
