<template>
  <div>
    <!-- 顶部切换 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
      <el-radio-group v-model="newsType" @change="fetchNews" size="default">
        <el-radio-button value="important">重要资讯</el-radio-button>
        <el-radio-button value="latest">最新资讯</el-radio-button>
      </el-radio-group>
      <el-button text @click="fetchNews" :loading="loading">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
    </div>

    <!-- 新闻列表 -->
    <div v-loading="loading">
      <el-empty v-if="!loading && newsList.length === 0" description="暂无资讯" />

      <div v-for="item in newsList" :key="item.id" style="margin-bottom: 16px">
        <el-card shadow="hover" @click="openNews(item.sourceUrl)" style="cursor: pointer">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px">
            <div style="flex: 1">
              <!-- 标题 -->
              <div style="font-size: 16px; font-weight: 600; color: #303133; margin-bottom: 8px; line-height: 1.5">
                {{ item.cnTitle || item.title }}
              </div>

              <!-- 摘要 -->
              <div style="font-size: 14px; color: #606266; line-height: 1.6; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden">
                {{ item.summary }}
              </div>

              <!-- 底部标签行 -->
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
                <!-- 重要性 -->
                <el-tag v-if="item.importance === 'high'" type="danger" size="small" effect="dark">重磅</el-tag>
                <el-tag v-else-if="item.importance === 'medium'" type="warning" size="small">中等</el-tag>

                <!-- 来源 -->
                <el-tag
                  v-for="p in item.platformList"
                  :key="p"
                  size="small"
                  type="info"
                  effect="plain"
                >{{ fmtPlatform(p) }}</el-tag>

                <!-- 关联币种 -->
                <el-tag
                  v-for="c in item.ccyList"
                  :key="c"
                  size="small"
                  style="background: #ecf5ff; color: #409eff; border-color: #d9ecff"
                >{{ c }}</el-tag>

                <!-- 情绪 -->
                <el-tag
                  v-for="s in item.ccySentiments"
                  :key="s.ccy"
                  size="small"
                  :type="s.sentiment === 'bullish' ? 'success' : s.sentiment === 'bearish' ? 'danger' : 'info'"
                  effect="plain"
                >{{ s.ccy }} {{ fmtSentiment(s.sentiment) }}</el-tag>

                <!-- 时间 -->
                <span style="color: #909399; font-size: 12px; margin-left: auto">{{ fmtTime(item.cTime) }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Refresh } from "@element-plus/icons-vue";
import api from "../api/index.js";

const newsType = ref("important");
const newsList = ref([]);
const loading = ref(false);

function fmtPlatform(p) {
  const map = {
    "odaily_flash": "Odaily",
    "panews": "PANews",
    "blockbeats": "BlockBeats",
    "techflowpost": "TechFlow",
    "foresightnews": "Foresight",
  };
  return map[p] || p;
}

function fmtSentiment(s) {
  if (s === "bullish") return "看涨";
  if (s === "bearish") return "看跌";
  return "中性";
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(Number(ts));
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

function openNews(url) {
  if (url) window.open(url, "_blank");
}

async function fetchNews() {
  loading.value = true;
  try {
    const res = await api.get("/news", {
      params: { type: newsType.value, limit: "20" },
    });
    newsList.value = res.data?.data?.details || [];
  } catch (err) {
    console.error("加载资讯失败:", err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchNews();
});
</script>
