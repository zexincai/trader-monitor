<template>
  <div>
    <!-- Page Header -->
    <div class="page-toolbar">
      <div>
        <h1 class="section-title" style="margin-bottom:4px">Trader Monitor</h1>
        <div class="page-header__meta">
          <span class="page-header__badge">Stream_Live</span>
          <span class="text-data-sm" style="color:var(--color-on-surface-variant)">2,481 Active Nodes</span>
        </div>
      </div>
      <div class="tab-switcher">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-switcher__btn"
          :class="{ 'tab-switcher__btn--active': newsType === tab.value }"
          @click="newsType = tab.value; onTypeChange()"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ═══ 加密资讯：AI 分析 + 新闻列表 ═══ -->
    <template v-if="newsType === 'important' || newsType === 'latest'">
      <!-- AI 分析卡片 -->
      <div v-if="analysis" class="page-section">
        <div class="glass-panel glow-border" style="padding: var(--space-comfortable); border: var(--glass-border-subtle)">
          <div class="card-header-row" style="margin-bottom: 12px">
            <h3 class="ai-section-label glow-secondary" style="display:flex;align-items:center;gap:8px">
              <span class="material-symbols-outlined">auto_awesome</span>
              AI_DAILY_RECAP
            </h3>
            <span class="text-data-sm" style="color:var(--color-outline)">V.2.4</span>
          </div>
          <div class="ai-summary-block" style="margin-bottom: 12px">
            <p class="ai-summary-text">{{ analysis.summary }}</p>
            <p v-if="analysis.sentimentReason" class="ai-summary-reason">{{ analysis.sentimentReason }}</p>
          </div>
          <el-row :gutter="12">
            <el-col :span="14">
              <p class="ai-section-label glow-primary" style="margin-bottom:8px">INVESTMENT OPPORTUNITIES</p>
              <div v-if="analysis.opportunities && analysis.opportunities.length">
                <div v-for="(op, i) in analysis.opportunities" :key="i" class="ai-opp-item">
                  <div class="ai-opp-item__header">
                    <span class="ai-opp-item__title">{{ op.title }}</span>
                    <el-tag size="small" :type="op.riskLevel === '高' ? 'danger' : op.riskLevel === '中' ? 'warning' : 'success'">
                      {{ op.riskLevel }}_RISK
                    </el-tag>
                  </div>
                  <p class="ai-opp-item__desc">{{ op.description }}</p>
                </div>
              </div>
              <p v-else class="text-data-sm" style="color:var(--color-outline)">NO_DATA</p>
            </el-col>
            <el-col :span="10">
              <p class="ai-section-label" style="color:var(--color-error);margin-bottom:8px">RISK ALERTS</p>
              <div v-if="analysis.risks && analysis.risks.length">
                <div v-for="(r, i) in analysis.risks" :key="i" class="ai-risk-item">{{ r }}</div>
              </div>
              <p v-else class="text-data-sm" style="color:var(--color-outline)">NO_DATA</p>
            </el-col>
          </el-row>
          <div style="margin-top:12px;display:flex;gap:8px">
            <el-button type="primary" size="small" @click="fetchAnalysis" :loading="analyzing">
              <span class="material-symbols-outlined" style="font-size:14px;margin-right:4px">psychology</span>GENERATE REPORT
            </el-button>
            <el-button size="small" text @click="fetchNews" :loading="loading">
              <span class="material-symbols-outlined" style="font-size:14px">refresh</span>
            </el-button>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="analyzing" class="page-section">
        <div class="glass-panel" style="padding:20px;display:flex;align-items:center;gap:12px;border:var(--glass-border-subtle)">
          <el-icon class="is-loading" :size="20" color="#00f2ff"><Loading /></el-icon>
          <span class="text-data-sm" style="color:var(--color-primary-fixed-dim)">AI_PROCESSING_DATA_STREAM...</span>
        </div>
      </div>

      <!-- News List -->
      <div v-loading="loading">
        <el-empty v-if="!loading && newsList.length === 0" description="NO_SIGNAL" />
        <div v-for="item in newsList" :key="item.id" class="page-section">
          <div class="news-card glass-panel glow-border" @click="openNews(item.sourceUrl)" style="border: var(--glass-border-subtle)">
            <div class="news-card__accent" :class="item.importance === 'high' ? 'news-card__accent--primary' : 'news-card__accent--secondary'"></div>
            <div style="padding: var(--space-comfortable)">
              <div class="news-card__top">
                <div class="news-card__tags">
                  <span v-if="item.importance === 'high'" class="news-card__tag news-card__tag--primary">HEAVYWEIGHT</span>
                  <span v-else-if="item.importance === 'medium'" class="news-card__tag news-card__tag--secondary">MEDIUM</span>
                  <span v-for="p in item.platformList" :key="p" class="news-card__tag news-card__tag--muted">{{ fmtPlatform(p) }}</span>
                </div>
                <span class="news-card__time">{{ fmtTime(item.cTime) }}</span>
              </div>
              <h2 class="news-card__title">{{ item.cnTitle || item.title }}</h2>
              <p class="news-card__summary">{{ item.summary }}</p>
              <div class="news-card__bottom">
                <div class="news-card__bottom-tags">
                  <el-tag v-for="c in item.ccyList" :key="c" size="small" type="info">{{ c }}</el-tag>
                  <el-tag v-for="s in item.ccySentiments" :key="s.ccy" size="small"
                    :type="s.sentiment === 'bullish' ? 'success' : s.sentiment === 'bearish' ? 'danger' : 'info'"
                  >{{ s.ccy }}_{{ fmtSentiment(s.sentiment) }}</el-tag>
                  <span class="news-card__hashtag" v-for="(tag, ti) in item.platformList" :key="'h'+ti">#{{ tag.toUpperCase() }}</span>
                </div>
                <span class="news-card__action">
                  ANALYSIS_DETAILS
                  <span class="material-symbols-outlined" style="font-size:14px">arrow_forward</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ AI日报 ═══ -->
    <template v-else-if="newsType === 'ai-daily'">
      <div v-if="aiDailyLoading" class="page-section">
        <div class="glass-panel" style="padding:20px;display:flex;align-items:center;gap:12px;border:var(--glass-border-subtle)">
          <el-icon class="is-loading" :size="20" color="#dab9ff"><Loading /></el-icon>
          <span class="text-data-sm" style="color:var(--color-secondary)">LOADING_AI_DAILY...</span>
        </div>
      </div>
      <el-empty v-if="!aiDailyLoading && !aiDaily" description="NO_DAILY_REPORT" />
      <div v-if="aiDaily" class="page-section">
        <div class="glass-panel glow-border" style="padding: var(--space-comfortable); border: var(--glass-border-subtle)">
          <div class="card-header-row" style="margin-bottom: 16px">
            <h3 class="ai-section-label glow-primary" style="display:flex;align-items:center;gap:8px">
              <span class="material-symbols-outlined">auto_awesome</span>
              AI_DAILY — {{ aiDaily.date }}
            </h3>
            <span class="text-data-sm" style="color:var(--color-outline)">GENERATED_{{ fmtTimeStr(aiDaily.generatedAt) }}</span>
          </div>
          <!-- Lead -->
          <div v-if="aiDaily.lead" class="daily-lead">
            <p class="daily-lead__title">{{ aiDaily.lead.title }}</p>
            <p class="daily-lead__text">{{ aiDaily.lead.leadParagraph }}</p>
          </div>
          <!-- Sections -->
          <div v-for="(sec, si) in aiDaily.sections" :key="si" class="daily-section">
            <p class="daily-section__label glow-primary">{{ sec.label }}</p>
            <div v-for="(it, ii) in sec.items" :key="ii" class="daily-section__item" @click="openNews(it.sourceUrl)">
              <span>{{ it.title }}</span>
              <span class="daily-section__item-src">{{ it.sourceName }}</span>
            </div>
          </div>
          <!-- Flashes -->
          <div v-if="aiDaily.flashes && aiDaily.flashes.length" class="daily-flashes">
            <p class="daily-section__label glow-secondary">LIVE_FLASHES</p>
            <div v-for="(f, fi) in aiDaily.flashes" :key="fi" class="daily-section__item" @click="openNews(f.sourceUrl)">
              <span>{{ f.title }}</span>
              <span class="daily-section__item-src">{{ f.sourceName }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ AI资讯 ═══ -->
    <template v-else>
      <div class="category-filter">
        <button
          v-for="c in aiCategories" :key="c.value"
          class="category-filter__btn"
          :class="{ 'category-filter__btn--active': aiCategory === c.value }"
          @click="onAiCategoryChange(c.value)"
        >
          {{ c.label }}
        </button>
      </div>
      <div v-loading="aiLoading">
        <el-empty v-if="!aiLoading && aiItems.length === 0" description="NO_AI_SIGNAL" />
        <div v-for="item in aiItems" :key="item.id" class="page-section">
          <div class="news-card glass-panel glow-border" @click="openNews(item.url)" style="border: var(--glass-border-subtle)">
            <div style="padding: var(--space-comfortable)">
              <div class="news-card__top">
                <div class="news-card__tags">
                  <span v-if="item.category" class="news-card__tag news-card__tag--primary">{{ aiCatLabel(item.category) }}</span>
                </div>
                <span class="news-card__time">{{ item.source }}</span>
              </div>
              <h2 class="news-card__title">{{ item.title }}</h2>
              <p v-if="item.summary" class="news-card__summary">{{ item.summary }}</p>
              <span v-if="item.publishedAt" class="text-data-sm" style="color:var(--color-outline)">{{ fmtTimeStr(item.publishedAt) }}</span>
            </div>
          </div>
        </div>
        <div v-if="aiHasNext" style="text-align:center;margin-top:12px">
          <el-button @click="loadMoreAi" :loading="aiLoadingMore" size="default">LOAD_MORE</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { Loading } from "@element-plus/icons-vue";
import api from "../api/index.js";

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

const tabs = [
  { value: "important", label: "Important" },
  { value: "latest", label: "Latest" },
  { value: "ai", label: "AI News" },
  { value: "ai-daily", label: "AI Daily" },
];

const aiCategories = [
  { value: "", label: "ALL" },
  { value: "ai-models", label: "Models" },
  { value: "ai-products", label: "Products" },
  { value: "industry", label: "Industry" },
  { value: "paper", label: "Papers" },
  { value: "tip", label: "Tips" },
];

const sentimentTagType = computed(() => {
  if (!analysis.value) return "info";
  if (analysis.value.sentiment === "看多") return "success";
  if (analysis.value.sentiment === "看空") return "danger";
  return "warning";
});

function fmtPlatform(p) {
  const m = { odaily_flash: "Odaily", panews: "PANews", blockbeats: "BlockBeats", techflowpost: "TechFlow", foresightnews: "Foresight" };
  return m[p] || p;
}
function fmtSentiment(s) { return s === "bullish" ? "BULL" : s === "bearish" ? "BEAR" : "NEUTRAL"; }
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(Number(ts));
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}M_AGO`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}H_AGO`;
  return `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function fmtTimeStr(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function openNews(url) { if (url) window.open(url, "_blank"); }
function aiCatLabel(c) { const m = { "ai-models": "MODELS", "ai-products": "PRODUCTS", "industry": "INDUSTRY", "paper": "PAPERS", "tip": "TIPS" }; return m[c] || c; }
function aiCatType(c) { const m = { "ai-models": "", "ai-products": "success", "industry": "primary", "paper": "warning", "tip": "info" }; return m[c] || "info"; }

async function fetchNews() {
  loading.value = true;
  try { const res = await api.get("/news", { params: { type: newsType.value, limit: "20" } }); newsList.value = res.data?.data?.details || []; }
  catch (err) { console.error(err); } finally { loading.value = false; }
}
async function fetchAnalysis() {
  analyzing.value = true;
  try { const res = await api.get("/news/analyze", { params: { type: newsType.value, limit: "15" } }); analysis.value = res.data?.data?.analysis || null; if (res.data?.data?.news?.length) newsList.value = res.data.data.news; }
  catch (err) { analysis.value = null; } finally { analyzing.value = false; }
}
async function fetchAiItems(reset = true) {
  aiLoading.value = true;
  try { const params = { take: "30", mode: "all" }; if (aiCategory.value) params.category = aiCategory.value; const res = await api.get("/news/ai/items", { params }); const data = res.data?.data || {}; if (reset) aiItems.value = data.items || []; else aiItems.value = [...aiItems.value, ...(data.items || [])]; aiCursor.value = data.nextCursor || null; aiHasNext.value = !!data.hasNext; }
  catch (err) { console.error(err); } finally { aiLoading.value = false; }
}
async function fetchAiDaily() {
  aiDailyLoading.value = true;
  try { const res = await api.get("/news/ai/daily"); aiDaily.value = res.data?.data || null; }
  catch (err) { console.error(err); } finally { aiDailyLoading.value = false; }
}
async function loadMoreAi() { if (!aiCursor.value || aiLoadingMore.value) return; aiLoadingMore.value = true; try { const params = { take: "30", mode: "all", cursor: aiCursor.value }; if (aiCategory.value) params.category = aiCategory.value; const res = await api.get("/news/ai/items", { params }); const data = res.data?.data || {}; aiItems.value = [...aiItems.value, ...(data.items || [])]; aiCursor.value = data.nextCursor || null; aiHasNext.value = !!data.hasNext; } catch (err) { console.error(err); } finally { aiLoadingMore.value = false; } }
function onAiCategoryChange(cat) { aiCategory.value = cat; fetchAiItems(true); }
function onTypeChange() {
  if (newsType.value === "ai") { if (aiItems.value.length === 0) fetchAiItems(true); }
  else if (newsType.value === "ai-daily") { if (!aiDaily.value) fetchAiDaily(); }
  else { fetchNews(); if (analysis.value) fetchAnalysis(); }
}
onMounted(() => { fetchNews(); fetchAnalysis(); fetchAiItems(true); fetchAiDaily(); });
</script>

<style scoped>
/* ── Page Header ── */
.page-header__meta { display: flex; gap: var(--space-compact); align-items: center; }
.page-header__badge {
  padding: 2px 8px;
  background: var(--color-surface-container-highest);
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  color: var(--color-outline);
  text-transform: uppercase;
  border: 1px solid rgba(58,73,75,0.3);
}

/* ── Tab Switcher ── */
.tab-switcher {
  display: flex;
  gap: 0;
  background: var(--color-surface-container-low);
  padding: 2px;
  border: 1px solid rgba(58,73,75,0.3);
}
.tab-switcher__btn {
  padding: 6px 16px;
  background: transparent;
  border: none;
  color: var(--color-on-surface-variant);
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tab-switcher__btn:hover { color: var(--color-primary-container); }
.tab-switcher__btn--active {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  box-shadow: 0 0 12px rgba(0,242,255,0.4);
}

/* ── AI Section Label ── */
.ai-section-label {
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* ── AI Summary Block ── */
.ai-summary-block {
  padding: 12px;
  background: rgba(0,242,255,0.03);
  border-left: 2px solid var(--color-primary-container);
}
.ai-summary-text { color: var(--color-on-surface); line-height: 1.6; font-size: var(--text-body-size); }
.ai-summary-reason { margin-top: 8px; font-size: var(--text-data-sm-size); color: var(--color-on-surface-variant); }

/* ── AI Opportunity ── */
.ai-opp-item {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: rgba(0,242,255,0.04);
  border-left: 2px solid var(--color-primary-container);
}
.ai-opp-item__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.ai-opp-item__title { font-weight: 600; font-size: 13px; color: var(--color-on-surface); }
.ai-opp-item__desc { font-size: var(--text-data-sm-size); color: var(--color-on-surface-variant); line-height: 1.4; }

/* ── AI Risk ── */
.ai-risk-item {
  padding: 8px 10px;
  margin-bottom: 6px;
  background: rgba(255,180,171,0.05);
  font-size: var(--text-data-sm-size);
  color: var(--color-on-surface-variant);
  line-height: 1.4;
}

/* ── News Card ── */
.news-card {
  cursor: pointer;
  transition: all var(--transition-base);
  position: relative;
  overflow: hidden;
}
.news-card:hover { box-shadow: var(--glow-border-primary-hover); }
.news-card__accent {
  height: 3px;
  width: 64px;
  transition: width var(--transition-slow);
}
.news-card:hover .news-card__accent { width: 100%; }
.news-card__accent--primary { background: var(--color-primary-container); box-shadow: 0 0 10px rgba(0,242,255,0.5); }
.news-card__accent--secondary { background: var(--color-secondary-container); box-shadow: 0 0 10px rgba(218,185,255,0.5); }

.news-card__top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-compact); }
.news-card__tags { display: flex; gap: 6px; flex-wrap: wrap; }
.news-card__tag {
  border: 1px solid var(--color-outline-variant);
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  padding: 1px 8px;
  color: var(--color-on-surface-variant);
}
.news-card__tag--primary { border-color: rgba(0,242,255,0.3); color: var(--color-primary-container); box-shadow: 0 0 5px rgba(0,242,255,0.2); }
.news-card__tag--secondary { border-color: rgba(218,185,255,0.3); color: var(--color-secondary); box-shadow: 0 0 5px rgba(218,185,255,0.2); }
.news-card__tag--muted { border-color: var(--color-outline-variant); color: var(--color-on-surface-variant); }
.news-card__time { font-family: var(--font-mono); font-size: var(--text-data-sm-size); color: var(--color-on-surface-variant); white-space: nowrap; }

.news-card__title {
  font-family: var(--font-heading);
  font-size: var(--text-headline-md-size);
  line-height: var(--text-headline-md-line);
  font-weight: var(--text-headline-md-weight);
  color: var(--color-primary);
  margin-bottom: var(--space-compact);
  transition: text-shadow var(--transition-base);
}
.news-card:hover .news-card__title { text-shadow: var(--glow-primary); }

.news-card__summary {
  font-size: var(--text-body-size);
  color: var(--color-on-surface-variant);
  line-height: 1.6;
  margin-bottom: var(--space-compact);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card__bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.news-card__bottom-tags { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.news-card__hashtag {
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: var(--text-label-caps-spacing);
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  background: var(--color-surface-container-highest);
  padding: 2px 6px;
}
.news-card__action {
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  color: var(--color-primary-container);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.news-card__action:hover { text-decoration: underline; filter: drop-shadow(0 0 5px rgba(0,242,255,0.8)); }

/* ── Daily ── */
.daily-lead {
  padding: 12px;
  background: rgba(218,185,255,0.04);
  border-left: 2px solid var(--color-secondary-container);
  margin-bottom: 12px;
}
.daily-lead__title { font-weight: 600; font-size: 14px; color: var(--color-secondary); margin-bottom: 6px; }
.daily-lead__text { font-size: 13px; color: var(--color-on-surface-variant); line-height: 1.6; }
.daily-section { margin-bottom: 12px; }
.daily-section__label {
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-primary-fixed-dim);
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(58,73,75,0.2);
}
.daily-section__item {
  padding: 6px 0;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  border-bottom: 1px solid rgba(58,73,75,0.08);
  color: var(--color-on-surface);
  transition: color var(--transition-fast);
}
.daily-section__item:hover { color: var(--color-primary-container); }
.daily-section__item:last-child { border-bottom: none; }
.daily-section__item-src { color: var(--color-outline); font-size: 11px; white-space: nowrap; }
.daily-flashes { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(58,73,75,0.2); }

/* ── Category Filter ── */
.category-filter { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.category-filter__btn {
  padding: 4px 14px;
  background: transparent;
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.category-filter__btn:hover { border-color: var(--color-primary-container); color: var(--color-primary-container); }
.category-filter__btn--active {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  border-color: var(--color-primary-container);
  box-shadow: 0 0 8px rgba(0,242,255,0.3);
}
</style>
