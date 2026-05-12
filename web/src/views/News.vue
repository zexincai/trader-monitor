<template>
  <div>
    <!-- 顶部切换 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
      <el-radio-group v-model="newsType" @change="onTypeChange" size="default">
        <el-radio-button value="important">重要资讯</el-radio-button>
        <el-radio-button value="latest">最新资讯</el-radio-button>
        <el-radio-button value="ai">AI资讯</el-radio-button>
        <el-radio-button value="ai-daily">AI日报</el-radio-button>
      </el-radio-group>
      <div style="display: flex; gap: 8px">
        <template v-if="newsType === 'important' || newsType === 'latest'">
          <el-button type="primary" @click="fetchAnalysis" :loading="analyzing">
            <el-icon style="margin-right: 4px"><MagicStick /></el-icon>AI 分析
          </el-button>
          <el-button text @click="fetchNews" :loading="loading">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </template>
        <template v-else-if="newsType === 'ai'">
          <el-button text @click="fetchAiItems" :loading="aiLoading">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </template>
        <template v-else-if="newsType === 'ai-daily'">
          <el-button text @click="fetchAiDaily" :loading="aiDailyLoading">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </template>
      </div>
    </div>

    <!-- ═══ 加密资讯：AI 分析 + 新闻列表 ═══ -->
    <template v-if="newsType === 'important' || newsType === 'latest'">
      <!-- AI 分析卡片 -->
      <el-card v-if="analysis" shadow="hover" style="margin-bottom: 20px; border-left: 4px solid #7c3aed">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="font-weight: 600; font-size: 15px; color: #7c3aed">
              🤖 AI 市场分析
            </span>
            <el-tag :type="sentimentTagType" effect="dark" size="small">{{ analysis.sentiment || '分析中' }}</el-tag>
          </div>
        </template>

        <div style="margin-bottom: 16px; padding: 12px; background: #f8f7ff; border-radius: 8px">
          <div style="font-size: 14px; color: #303133; line-height: 1.7">{{ analysis.summary }}</div>
          <div style="margin-top: 6px; font-size: 12px; color: #909399" v-if="analysis.sentimentReason">{{ analysis.sentimentReason }}</div>
        </div>

        <el-row :gutter="16">
          <el-col :span="14">
            <div style="font-size: 13px; font-weight: 600; color: #16a34a; margin-bottom: 8px">📈 投资机会</div>
            <div v-if="analysis.opportunities && analysis.opportunities.length">
              <div v-for="(op, i) in analysis.opportunities" :key="i"
                style="padding: 10px 12px; margin-bottom: 8px; background: #f0fdf4; border-radius: 6px; border-left: 3px solid #16a34a">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px">
                  <span style="font-weight: 600; font-size: 13px; color: #166534">{{ op.title }}</span>
                  <el-tag size="small" :type="op.riskLevel === '高' ? 'danger' : op.riskLevel === '中' ? 'warning' : 'success'">{{ op.riskLevel }}风险</el-tag>
                </div>
                <div style="font-size: 12px; color: #4d7c0f; line-height: 1.5">{{ op.description }}</div>
              </div>
            </div>
            <div v-else style="font-size: 12px; color: #909399">暂无明确机会</div>
          </el-col>

          <el-col :span="10">
            <div style="font-size: 13px; font-weight: 600; color: #dc2626; margin-bottom: 8px">⚠️ 风险提示</div>
            <div v-if="analysis.risks && analysis.risks.length">
              <div v-for="(r, i) in analysis.risks" :key="i"
                style="padding: 8px 10px; margin-bottom: 6px; background: #fef2f2; border-radius: 6px; font-size: 12px; color: #991b1b; line-height: 1.5">
                {{ r }}
              </div>
            </div>
            <div v-else style="font-size: 12px; color: #909399">暂无明确风险</div>
          </el-col>
        </el-row>
      </el-card>

      <el-card v-if="analyzing" shadow="hover" style="margin-bottom: 20px; border-left: 4px solid #7c3aed">
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0">
          <el-icon class="is-loading" style="font-size: 24px; color: #7c3aed"><Loading /></el-icon>
          <span style="color: #7c3aed; font-size: 14px">AI 正在分析最新资讯...</span>
        </div>
      </el-card>

      <!-- 加密新闻列表 -->
      <div v-loading="loading">
        <el-empty v-if="!loading && newsList.length === 0" description="暂无资讯" />
        <div v-for="item in newsList" :key="item.id" style="margin-bottom: 16px">
          <el-card shadow="hover" @click="openNews(item.sourceUrl)" style="cursor: pointer">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px">
              <div style="flex: 1">
                <div style="font-size: 16px; font-weight: 600; color: #303133; margin-bottom: 8px; line-height: 1.5">
                  {{ item.cnTitle || item.title }}
                </div>
                <div style="font-size: 14px; color: #606266; line-height: 1.6; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden">
                  {{ item.summary }}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
                  <el-tag v-if="item.importance === 'high'" type="danger" size="small" effect="dark">重磅</el-tag>
                  <el-tag v-else-if="item.importance === 'medium'" type="warning" size="small">中等</el-tag>
                  <el-tag v-for="p in item.platformList" :key="p" size="small" type="info" effect="plain">{{ fmtPlatform(p) }}</el-tag>
                  <el-tag v-for="c in item.ccyList" :key="c" size="small" style="background: #ecf5ff; color: #409eff; border-color: #d9ecff">{{ c }}</el-tag>
                  <el-tag v-for="s in item.ccySentiments" :key="s.ccy" size="small"
                    :type="s.sentiment === 'bullish' ? 'success' : s.sentiment === 'bearish' ? 'danger' : 'info'" effect="plain"
                  >{{ s.ccy }} {{ fmtSentiment(s.sentiment) }}</el-tag>
                  <span style="color: #909399; font-size: 12px; margin-left: auto">{{ fmtTime(item.cTime) }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </template>

    <!-- ═══ AI日报 ═══ -->
    <template v-else-if="newsType === 'ai-daily'">
      <el-card v-if="aiDailyLoading" shadow="hover" style="margin-bottom: 20px; border-left: 4px solid #0ea5e9">
        <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0">
          <el-icon class="is-loading" style="font-size: 24px; color: #0ea5e9"><Loading /></el-icon>
          <span style="color: #0ea5e9; font-size: 14px">加载 AI 日报...</span>
        </div>
      </el-card>

      <el-empty v-if="!aiDailyLoading && !aiDaily" description="暂无AI日报" />

      <el-card v-if="aiDaily" shadow="hover" style="margin-bottom: 20px; border-left: 4px solid #0ea5e9">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="font-weight: 600; font-size: 15px; color: #0ea5e9">
              🤖 AI 日报 — {{ aiDaily.date }}
            </span>
            <span style="font-size: 12px; color: #909399">生成于 {{ fmtTimeStr(aiDaily.generatedAt) }}</span>
          </div>
        </template>

        <!-- 主编导语 -->
        <div v-if="aiDaily.lead" style="margin-bottom: 16px; padding: 12px; background: #f0f9ff; border-radius: 8px">
          <div style="font-weight: 600; font-size: 14px; color: #0369a1; margin-bottom: 6px">{{ aiDaily.lead.title }}</div>
          <div style="font-size: 13px; color: #334155; line-height: 1.7">{{ aiDaily.lead.leadParagraph }}</div>
        </div>

        <!-- 分类板块 -->
        <div v-for="(sec, si) in aiDaily.sections" :key="si" style="margin-bottom: 14px">
          <div style="font-weight: 600; font-size: 13px; color: #0ea5e9; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e0f2fe">
            {{ sec.label }}
          </div>
          <div v-for="(it, ii) in sec.items" :key="ii"
            style="padding: 6px 0; font-size: 13px; cursor: pointer; display: flex; gap: 8px"
            @click="openNews(it.sourceUrl)">
            <span style="color: #303133; flex: 1">{{ it.title }}</span>
            <span style="color: #909399; font-size: 11px; white-space: nowrap">{{ it.sourceName }}</span>
          </div>
        </div>

        <!-- 快讯 -->
        <div v-if="aiDaily.flashes && aiDaily.flashes.length" style="margin-top: 12px">
          <div style="font-weight: 600; font-size: 13px; color: #f59e0b; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #fef3c7">
            ⚡ 快讯
          </div>
          <div v-for="(f, fi) in aiDaily.flashes" :key="fi"
            style="padding: 4px 0; font-size: 12px; color: #606266; cursor: pointer"
            @click="openNews(f.sourceUrl)">
            {{ f.title }}
            <span style="color: #909399; font-size: 11px; margin-left: 8px">{{ f.sourceName }}</span>
          </div>
        </div>
      </el-card>
    </template>

    <!-- ═══ AI资讯列表 ═══ -->
    <template v-else>
      <!-- 分类筛选栏 -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap">
        <el-tag v-for="c in aiCategories" :key="c.value"
          size="default"
          :effect="aiCategory === c.value ? 'dark' : 'plain'"
          :type="aiCategory === c.value ? 'primary' : 'info'"
          style="cursor: pointer; padding: 4px 12px"
          @click="onAiCategoryChange(c.value)">
          {{ c.label }}
        </el-tag>
      </div>

      <!-- AI资讯列表 -->
      <div v-loading="aiLoading">
        <el-empty v-if="!aiLoading && aiItems.length === 0" description="暂无AI资讯" />

        <div v-for="item in aiItems" :key="item.id" style="margin-bottom: 12px">
          <el-card shadow="hover" @click="openNews(item.url)" style="cursor: pointer">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px">
              <div style="flex: 1">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px">
                  <el-tag v-if="item.category" size="small" :type="aiCatType(item.category)" effect="dark">
                    {{ aiCatLabel(item.category) }}
                  </el-tag>
                  <span style="font-weight: 600; font-size: 15px; color: #303133; line-height: 1.4">
                    {{ item.title }}
                  </span>
                </div>
                <div v-if="item.summary" style="font-size: 13px; color: #606266; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px">
                  {{ item.summary }}
                </div>
                <div style="display: flex; align-items: center; gap: 8px">
                  <span style="font-size: 12px; color: #909399">{{ item.source }}</span>
                  <span v-if="item.publishedAt" style="font-size: 12px; color: #c0c4cc">{{ fmtTimeStr(item.publishedAt) }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <!-- 加载更多 -->
        <div v-if="aiHasNext" style="text-align: center; margin-top: 16px">
          <el-button @click="loadMoreAi" :loading="aiLoadingMore" size="default" round>
            加载更多
          </el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { Refresh, MagicStick, Loading } from "@element-plus/icons-vue";
import api from "../api/index.js";

// ── 状态 ──
const newsType = ref("important");
const newsList = ref([]);
const analysis = ref(null);
const loading = ref(false);
const analyzing = ref(false);

// AI资讯状态
const aiItems = ref([]);
const aiDaily = ref(null);
const aiLoading = ref(false);
const aiDailyLoading = ref(false);
const aiLoadingMore = ref(false);
const aiCategory = ref("");
const aiCursor = ref(null);
const aiHasNext = ref(false);

const aiCategories = [
  { value: "", label: "全部" },
  { value: "ai-models", label: "模型发布" },
  { value: "ai-products", label: "AI产品" },
  { value: "industry", label: "行业动态" },
  { value: "paper", label: "论文研究" },
  { value: "tip", label: "技巧观点" },
];

// ── 计算属性 ──
const sentimentTagType = computed(() => {
  if (!analysis.value) return "info";
  if (analysis.value.sentiment === "看多") return "success";
  if (analysis.value.sentiment === "看空") return "danger";
  return "warning";
});

// ── 格式化函数 ──
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

function fmtTimeStr(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

function openNews(url) {
  if (url) window.open(url, "_blank");
}

// AI分类工具
function aiCatLabel(cat) {
  const map = { "ai-models": "模型发布", "ai-products": "AI产品", "industry": "行业动态", "paper": "论文研究", "tip": "技巧观点" };
  return map[cat] || cat;
}

function aiCatType(cat) {
  const map = { "ai-models": "", "ai-products": "success", "industry": "primary", "paper": "warning", "tip": "info" };
  return map[cat] || "info";
}

// ── 加密资讯 API ──
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

async function fetchAnalysis() {
  analyzing.value = true;
  try {
    const res = await api.get("/news/analyze", {
      params: { type: newsType.value, limit: "15" },
    });
    analysis.value = res.data?.data?.analysis || null;
    if (res.data?.data?.news?.length) {
      newsList.value = res.data.data.news;
    }
  } catch (err) {
    console.error("AI分析失败:", err);
    analysis.value = null;
  } finally {
    analyzing.value = false;
  }
}

// ── AI资讯 API ──
async function fetchAiItems(reset = true) {
  aiLoading.value = true;
  try {
    const params = { take: "30", mode: "all" };
    if (aiCategory.value) params.category = aiCategory.value;

    const res = await api.get("/news/ai/items", { params });
    const data = res.data?.data || {};
    if (reset) {
      aiItems.value = data.items || [];
    } else {
      aiItems.value = [...aiItems.value, ...(data.items || [])];
    }
    aiCursor.value = data.nextCursor || null;
    aiHasNext.value = !!data.hasNext;
  } catch (err) {
    console.error("加载AI资讯失败:", err);
  } finally {
    aiLoading.value = false;
  }
}

async function fetchAiDaily() {
  aiDailyLoading.value = true;
  try {
    const res = await api.get("/news/ai/daily");
    aiDaily.value = res.data?.data || null;
  } catch (err) {
    console.error("加载AI日报失败:", err);
  } finally {
    aiDailyLoading.value = false;
  }
}

async function loadMoreAi() {
  if (!aiCursor.value || aiLoadingMore.value) return;
  aiLoadingMore.value = true;
  try {
    const params = { take: "30", mode: "all", cursor: aiCursor.value };
    if (aiCategory.value) params.category = aiCategory.value;

    const res = await api.get("/news/ai/items", { params });
    const data = res.data?.data || {};
    aiItems.value = [...aiItems.value, ...(data.items || [])];
    aiCursor.value = data.nextCursor || null;
    aiHasNext.value = !!data.hasNext;
  } catch (err) {
    console.error("加载更多失败:", err);
  } finally {
    aiLoadingMore.value = false;
  }
}

function onAiCategoryChange(cat) {
  aiCategory.value = cat;
  fetchAiItems(true);
}

// ── Tab 切换 ──
function onTypeChange() {
  if (newsType.value === "ai") {
    if (aiItems.value.length === 0) fetchAiItems(true);
  } else if (newsType.value === "ai-daily") {
    if (!aiDaily.value) fetchAiDaily();
  } else {
    fetchNews();
    if (analysis.value) fetchAnalysis();
  }
}

// ── 初始化 ──
onMounted(() => {
  fetchNews();
  fetchAnalysis();
  // 预加载AI资讯
  fetchAiItems(true);
  fetchAiDaily();
});
</script>
