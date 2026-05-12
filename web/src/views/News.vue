<template>
  <div>
    <!-- 顶部切换 -->
    <div class="page-toolbar">
      <el-radio-group v-model="newsType" @change="onTypeChange" size="default">
        <el-radio-button value="important">重要资讯</el-radio-button>
        <el-radio-button value="latest">最新资讯</el-radio-button>
        <el-radio-button value="ai">AI资讯</el-radio-button>
        <el-radio-button value="ai-daily">AI日报</el-radio-button>
      </el-radio-group>

      <div class="page-toolbar__actions">
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
      <div v-if="analysis" class="page-section">
        <el-card class="ai-analysis-card">
          <template #header>
            <div class="card-header-row">
              <span class="card-header-row__title">AI 市场分析</span>
              <el-tag :type="sentimentTagType" effect="dark" size="small">
                {{ analysis.sentiment || '分析中' }}
              </el-tag>
            </div>
          </template>

          <div class="ai-summary">
            <div class="ai-summary__text">{{ analysis.summary }}</div>
            <div v-if="analysis.sentimentReason" class="ai-summary__reason">{{ analysis.sentimentReason }}</div>
          </div>

          <el-row :gutter="16">
            <el-col :span="14">
              <div class="ai-section-title ai-section-title--positive">投资机会</div>
              <div v-if="analysis.opportunities && analysis.opportunities.length">
                <div v-for="(op, i) in analysis.opportunities" :key="i" class="ai-opportunity-item">
                  <div class="ai-opportunity-item__header">
                    <span class="ai-opportunity-item__title">{{ op.title }}</span>
                    <el-tag size="small" :type="op.riskLevel === '高' ? 'danger' : op.riskLevel === '中' ? 'warning' : 'success'">
                      {{ op.riskLevel }}风险
                    </el-tag>
                  </div>
                  <div class="ai-opportunity-item__desc">{{ op.description }}</div>
                </div>
              </div>
              <div v-else class="ai-empty-text">暂无明确机会</div>
            </el-col>

            <el-col :span="10">
              <div class="ai-section-title ai-section-title--negative">风险提示</div>
              <div v-if="analysis.risks && analysis.risks.length">
                <div v-for="(r, i) in analysis.risks" :key="i" class="ai-risk-item">
                  {{ r }}
                </div>
              </div>
              <div v-else class="ai-empty-text">暂无明确风险</div>
            </el-col>
          </el-row>
        </el-card>
      </div>

      <!-- 分析中 -->
      <div v-if="analyzing" class="page-section">
        <el-card>
          <div class="loading-row">
            <el-icon class="is-loading" :size="24"><Loading /></el-icon>
            <span>AI 正在分析最新资讯...</span>
          </div>
        </el-card>
      </div>

      <!-- 加密新闻列表 -->
      <div v-loading="loading">
        <el-empty v-if="!loading && newsList.length === 0" description="暂无资讯" />
        <div v-for="item in newsList" :key="item.id" class="news-item">
          <el-card @click="openNews(item.sourceUrl)" class="news-card">
            <div class="news-card__body">
              <div class="news-card__main">
                <div class="news-card__title">{{ item.cnTitle || item.title }}</div>
                <div class="news-card__summary">{{ item.summary }}</div>
                <div class="news-card__meta">
                  <el-tag v-if="item.importance === 'high'" type="danger" size="small" effect="dark">重磅</el-tag>
                  <el-tag v-else-if="item.importance === 'medium'" type="warning" size="small">中等</el-tag>
                  <el-tag v-for="p in item.platformList" :key="p" size="small" type="info" effect="plain">{{ fmtPlatform(p) }}</el-tag>
                  <el-tag v-for="c in item.ccyList" :key="c" size="small" class="tag-ccy">{{ c }}</el-tag>
                  <el-tag v-for="s in item.ccySentiments" :key="s.ccy" size="small"
                    :type="s.sentiment === 'bullish' ? 'success' : s.sentiment === 'bearish' ? 'danger' : 'info'" effect="plain"
                  >{{ s.ccy }} {{ fmtSentiment(s.sentiment) }}</el-tag>
                  <span class="news-card__time">{{ fmtTime(item.cTime) }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </template>

    <!-- ═══ AI日报 ═══ -->
    <template v-else-if="newsType === 'ai-daily'">
      <div v-if="aiDailyLoading" class="page-section">
        <el-card>
          <div class="loading-row">
            <el-icon class="is-loading" :size="24"><Loading /></el-icon>
            <span>加载 AI 日报...</span>
          </div>
        </el-card>
      </div>

      <el-empty v-if="!aiDailyLoading && !aiDaily" description="暂无AI日报" />

      <div v-if="aiDaily" class="page-section">
        <el-card>
          <template #header>
            <div class="card-header-row">
              <span class="card-header-row__title">AI 日报 — {{ aiDaily.date }}</span>
              <span class="card-header-row__subtitle">生成于 {{ fmtTimeStr(aiDaily.generatedAt) }}</span>
            </div>
          </template>

          <!-- 主编导语 -->
          <div v-if="aiDaily.lead" class="daily-lead">
            <div class="daily-lead__title">{{ aiDaily.lead.title }}</div>
            <div class="daily-lead__text">{{ aiDaily.lead.leadParagraph }}</div>
          </div>

          <!-- 分类板块 -->
          <div v-for="(sec, si) in aiDaily.sections" :key="si" class="daily-section">
            <div class="daily-section__label">{{ sec.label }}</div>
            <div
              v-for="(it, ii) in sec.items" :key="ii"
              class="daily-section__item"
              @click="openNews(it.sourceUrl)"
            >
              <span class="daily-section__item-title">{{ it.title }}</span>
              <span class="daily-section__item-source">{{ it.sourceName }}</span>
            </div>
          </div>

          <!-- 快讯 -->
          <div v-if="aiDaily.flashes && aiDaily.flashes.length" class="daily-flashes">
            <div class="daily-flashes__label">快讯</div>
            <div
              v-for="(f, fi) in aiDaily.flashes" :key="fi"
              class="daily-flashes__item"
              @click="openNews(f.sourceUrl)"
            >
              {{ f.title }}
              <span class="daily-flashes__item-source">{{ f.sourceName }}</span>
            </div>
          </div>
        </el-card>
      </div>
    </template>

    <!-- ═══ AI资讯列表 ═══ -->
    <template v-else>
      <!-- 分类筛选栏 -->
      <div class="category-filter">
        <el-tag
          v-for="c in aiCategories" :key="c.value"
          size="default"
          :effect="aiCategory === c.value ? 'dark' : 'plain'"
          :type="aiCategory === c.value ? 'primary' : 'info'"
          class="category-filter__tag"
          @click="onAiCategoryChange(c.value)"
        >
          {{ c.label }}
        </el-tag>
      </div>

      <!-- AI资讯列表 -->
      <div v-loading="aiLoading">
        <el-empty v-if="!aiLoading && aiItems.length === 0" description="暂无AI资讯" />

        <div v-for="item in aiItems" :key="item.id" class="news-item">
          <el-card @click="openNews(item.url)" class="news-card">
            <div class="ai-item">
              <div class="ai-item__main">
                <div class="ai-item__header">
                  <el-tag v-if="item.category" size="small" :type="aiCatType(item.category)" effect="dark">
                    {{ aiCatLabel(item.category) }}
                  </el-tag>
                  <span class="ai-item__title">{{ item.title }}</span>
                </div>
                <div v-if="item.summary" class="ai-item__summary">{{ item.summary }}</div>
                <div class="ai-item__meta">
                  <span>{{ item.source }}</span>
                  <span v-if="item.publishedAt" class="ai-item__meta-time">{{ fmtTimeStr(item.publishedAt) }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <!-- 加载更多 -->
        <div v-if="aiHasNext" class="load-more">
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

const sentimentTagType = computed(() => {
  if (!analysis.value) return "info";
  if (analysis.value.sentiment === "看多") return "success";
  if (analysis.value.sentiment === "看空") return "danger";
  return "warning";
});

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

function aiCatLabel(cat) {
  const map = { "ai-models": "模型发布", "ai-products": "AI产品", "industry": "行业动态", "paper": "论文研究", "tip": "技巧观点" };
  return map[cat] || cat;
}

function aiCatType(cat) {
  const map = { "ai-models": "", "ai-products": "success", "industry": "primary", "paper": "warning", "tip": "info" };
  return map[cat] || "info";
}

async function fetchNews() {
  loading.value = true;
  try {
    const res = await api.get("/news", { params: { type: newsType.value, limit: "20" } });
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
    const res = await api.get("/news/analyze", { params: { type: newsType.value, limit: "15" } });
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

onMounted(() => {
  fetchNews();
  fetchAnalysis();
  fetchAiItems(true);
  fetchAiDaily();
});
</script>

<style scoped>
/* ── Page Toolbar ── */
.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--content-gap);
  flex-wrap: wrap;
  gap: 12px;
}

.page-toolbar__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* ── Card Header ── */
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.card-header-row__title {
  font-family: var(--font-heading);
  font-weight: 500;
  font-size: 14px;
  color: var(--color-on-surface);
}

.card-header-row__subtitle {
  font-size: var(--text-label-sm-size);
  color: var(--color-on-surface-variant);
}

/* ── AI Analysis Card ── */
.ai-analysis-card {
  border-left: 3px solid var(--color-primary);
}

.ai-summary {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--color-surface-container-low);
  border-radius: 0;
}

.ai-summary__text {
  font-size: var(--text-body-md-size);
  color: var(--color-on-surface);
  line-height: 1.7;
}

.ai-summary__reason {
  margin-top: 8px;
  font-size: var(--text-label-sm-size);
  color: var(--color-on-surface-variant);
}

.ai-section-title {
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}

.ai-section-title--positive {
  color: var(--color-positive);
}

.ai-section-title--negative {
  color: var(--color-negative);
}

.ai-opportunity-item {
  padding: 14px 16px;
  margin-bottom: 10px;
  background: var(--color-positive-bg);
  border-radius: 0;
  border-left: 3px solid var(--color-positive);
}

.ai-opportunity-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.ai-opportunity-item__title {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-on-surface);
}

.ai-opportunity-item__desc {
  font-size: var(--text-label-sm-size);
  color: var(--color-on-surface-variant);
  line-height: 1.5;
}

.ai-risk-item {
  padding: 10px 14px;
  margin-bottom: 8px;
  background: var(--color-negative-bg);
  border-radius: 0;
  font-size: var(--text-label-sm-size);
  color: var(--color-on-error-container);
  line-height: 1.5;
}

.ai-empty-text {
  font-size: var(--text-label-sm-size);
  color: var(--color-on-surface-variant);
}

/* ── Loading ── */
.loading-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: var(--text-body-md-size);
  color: var(--color-on-surface-variant);
}

/* ── News Card ── */
.news-card {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.news-card:hover {
  background: var(--color-surface-container-low);
}

.news-card__body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.news-card__main {
  flex: 1;
}

.news-card__title {
  font-family: var(--font-heading);
  font-size: var(--text-body-md-size);
  font-weight: 600;
  color: var(--color-on-surface);
  margin-bottom: 8px;
  line-height: 1.5;
}

.news-card__summary {
  font-size: var(--text-body-md-size);
  color: var(--color-on-surface-variant);
  line-height: 1.6;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.news-card__time {
  color: var(--color-on-surface-variant);
  font-size: var(--text-label-sm-size);
  margin-left: auto;
}

/* ── Tag - CCY ── */
.tag-ccy {
  background: var(--color-surface-container-low) !important;
  color: var(--color-on-surface-variant) !important;
  border-color: var(--color-outline-variant) !important;
}

/* ── AI Daily ── */
.daily-lead {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--color-surface-container-low);
  border-radius: 0;
}

.daily-lead__title {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 14px;
  color: var(--color-on-surface);
  margin-bottom: 8px;
}

.daily-lead__text {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  line-height: 1.7;
}

.daily-section {
  margin-bottom: 20px;
}

.daily-section__label {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 13px;
  color: var(--color-on-surface);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: var(--border-subtle);
}

.daily-section__item {
  padding: 8px 0;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  border-bottom: 1px solid var(--color-surface-container);
  transition: color var(--transition-fast);
}

.daily-section__item:hover {
  color: var(--color-on-surface);
}

.daily-section__item:last-child {
  border-bottom: none;
}

.daily-section__item-title {
  color: var(--color-on-surface);
  flex: 1;
}

.daily-section__item-source {
  color: var(--color-on-surface-variant);
  font-size: 11px;
  white-space: nowrap;
}

.daily-flashes {
  margin-top: 16px;
  padding-top: 16px;
  border-top: var(--border-subtle);
}

.daily-flashes__label {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 13px;
  color: var(--color-on-surface-variant);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: var(--border-subtle);
}

.daily-flashes__item {
  padding: 6px 0;
  font-size: var(--text-label-sm-size);
  color: var(--color-on-surface-variant);
  cursor: pointer;
  border-bottom: 1px solid var(--color-surface-container);
  transition: color var(--transition-fast);
}

.daily-flashes__item:hover {
  color: var(--color-on-surface);
}

.daily-flashes__item:last-child {
  border-bottom: none;
}

.daily-flashes__item-source {
  color: var(--color-on-surface-variant);
  font-size: 11px;
  margin-left: 8px;
}

/* ── Category Filter ── */
.category-filter {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.category-filter__tag {
  cursor: pointer;
  padding: 6px 16px;
}

/* ── AI Items ── */
.ai-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ai-item__main {
  flex: 1;
}

.ai-item__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ai-item__title {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 15px;
  color: var(--color-on-surface);
  line-height: 1.4;
}

.ai-item__summary {
  font-size: 13px;
  color: var(--color-on-surface-variant);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 10px;
}

.ai-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-label-sm-size);
  color: var(--color-on-surface-variant);
}

.ai-item__meta-time {
  color: var(--color-outline-variant);
}

/* ── Load More ── */
.load-more {
  text-align: center;
  margin-top: 24px;
}
</style>
