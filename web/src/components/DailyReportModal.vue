<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-panel">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-header__left">
            <span class="material-symbols-outlined modal-header__icon">psychology</span>
            <div>
              <h2 class="modal-header__title glow-primary">DAILY_REPORT</h2>
              <p class="modal-header__date">{{ report?.date || '--' }}</p>
            </div>
          </div>
          <button class="modal-header__close" @click="$emit('close')">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body" v-loading="loading">
          <template v-if="report">
            <!-- Summary Stats -->
            <section class="report-section">
              <h3 class="report-section__title">TRADER_SUMMARY</h3>
              <div class="stat-grid">
                <div class="stat-item glass-panel">
                  <span class="stat-item__value">{{ report.summary.totalTraders }}</span>
                  <span class="stat-item__label">TRADERS</span>
                </div>
                <div class="stat-item glass-panel">
                  <span class="stat-item__value" :class="report.summary.totalPnl30d >= 0 ? 'value-positive' : 'value-negative'">{{ fmtUSD(report.summary.totalPnl30d) }}</span>
                  <span class="stat-item__label">PNL_30D</span>
                </div>
                <div class="stat-item glass-panel">
                  <span class="stat-item__value">{{ fmtPct(report.summary.avgWinRate) }}</span>
                  <span class="stat-item__label">AVG_WIN%</span>
                </div>
                <div class="stat-item glass-panel">
                  <span class="stat-item__value value-negative">{{ fmtPct(report.summary.avgDrawdown) }}</span>
                  <span class="stat-item__label">AVG_DD</span>
                </div>
                <div class="stat-item glass-panel">
                  <span class="stat-item__value">{{ fmtUSD(report.summary.totalAum) }}</span>
                  <span class="stat-item__label">TOTAL_AUM</span>
                </div>
              </div>
            </section>

            <!-- Positions -->
            <section class="report-section">
              <h3 class="report-section__title">POSITION_SNAPSHOT</h3>
              <div class="stat-grid stat-grid--4">
                <div class="stat-item glass-panel">
                  <span class="stat-item__value">{{ report.positions.total }}</span>
                  <span class="stat-item__label">TOTAL</span>
                </div>
                <div class="stat-item glass-panel">
                  <span class="stat-item__value value-positive">{{ report.positions.longCount }}</span>
                  <span class="stat-item__label">LONG</span>
                </div>
                <div class="stat-item glass-panel">
                  <span class="stat-item__value value-negative">{{ report.positions.shortCount }}</span>
                  <span class="stat-item__label">SHORT</span>
                </div>
                <div class="stat-item glass-panel">
                  <span class="stat-item__value" :class="report.positions.totalUpl >= 0 ? 'value-positive' : 'value-negative'">{{ fmtUSD(report.positions.totalUpl) }}</span>
                  <span class="stat-item__label">UPL</span>
                </div>
              </div>
            </section>

            <!-- Top Traders -->
            <section class="report-section" v-if="report.topByPnl?.length">
              <h3 class="report-section__title">TOP_BY_PNL</h3>
              <div class="top-list">
                <div v-for="(t, i) in report.topByPnl" :key="t.name" class="top-row">
                  <span class="top-row__rank">{{ i + 1 }}</span>
                  <span class="top-row__name">{{ t.name }}</span>
                  <span class="top-row__pnl" :class="t.pnl30d >= 0 ? 'value-positive' : 'value-negative'">{{ fmtUSD(t.pnl30d) }}</span>
                  <span class="top-row__meta">{{ fmtPct(t.winRate) }} WR</span>
                </div>
              </div>
            </section>

            <section class="report-section" v-if="report.topByWinRate?.length">
              <h3 class="report-section__title">TOP_BY_WIN_RATE</h3>
              <div class="top-list">
                <div v-for="(t, i) in report.topByWinRate" :key="t.name" class="top-row">
                  <span class="top-row__rank">{{ i + 1 }}</span>
                  <span class="top-row__name">{{ t.name }}</span>
                  <span class="top-row__winrate value-positive">{{ fmtPct(t.winRate) }}</span>
                  <span class="top-row__meta">{{ fmtUSD(t.pnl30d) }} PnL</span>
                </div>
              </div>
            </section>

            <!-- Alerts -->
            <section class="report-section" v-if="report.alerts?.length">
              <h3 class="report-section__title report-section__title--danger">RISK_ALERTS</h3>
              <div class="alert-list">
                <div v-for="(a, i) in report.alerts" :key="i" class="alert-item" :class="`alert-item--${a.level}`">
                  <span class="material-symbols-outlined alert-item__icon">{{ a.level === 'danger' ? 'error' : 'warning' }}</span>
                  <span class="alert-item__type">{{ a.type }}</span>
                  <span class="alert-item__msg">{{ a.msg }}</span>
                  <span v-if="a.trader" class="alert-item__trader">{{ a.trader }}</span>
                </div>
              </div>
            </section>

            <!-- AI Analysis -->
            <section class="report-section" v-if="report.aiAnalysis">
              <h3 class="report-section__title report-section__title--ai">
                <span class="material-symbols-outlined">psychology</span>
                AI_ANALYSIS
              </h3>
              <div class="ai-block glass-panel">{{ report.aiAnalysis }}</div>
            </section>

            <p class="modal-generated">GENERATED: {{ report.generatedAt ? fmtTime(report.generatedAt) : '--' }}</p>
          </template>
          <div v-else-if="!loading" class="modal-empty">NO_DATA</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from "vue";
import { fetchDailyReport } from "../api/index.js";

const props = defineProps({ visible: Boolean });
defineEmits(["close"]);

const report = ref(null);
const loading = ref(false);

watch(() => props.visible, async (v) => {
  if (v) {
    loading.value = true;
    report.value = null;
    try {
      const res = await fetchDailyReport();
      if (res.code === 0) report.value = res.data;
    } catch (e) {
      console.error("Daily report fetch failed:", e);
    } finally {
      loading.value = false;
    }
  }
});

function fmtUSD(n) {
  const v = Number(n);
  if (!isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1e6) return `${(v >= 0 ? "+" : "")}${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `${(v >= 0 ? "+" : "")}${(v / 1e4).toFixed(2)}W`;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}
function fmtPct(n) {
  const v = Number(n);
  return isFinite(v) ? `${(v * 100).toFixed(1)}%` : "N/A";
}
function fmtTime(iso) {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}
</script>

<style scoped>
/* ── Overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* ── Panel ── */
.modal-panel {
  width: min(720px, 100%);
  max-height: 85vh;
  background: rgba(16, 19, 26, 0.95);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(58, 73, 75, 0.4);
  border-radius: 12px;
  box-shadow: 0 0 30px rgba(0, 242, 255, 0.15), 0 0 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(58, 73, 75, 0.3);
  flex-shrink: 0;
}
.modal-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.modal-header__icon {
  font-size: 28px;
  color: var(--color-primary-container);
  text-shadow: var(--glow-primary);
}
.modal-header__title {
  font-family: var(--font-heading);
  font-size: var(--text-headline-md-size);
  color: var(--color-primary);
  text-shadow: var(--glow-primary);
  margin: 0;
  line-height: 1.1;
}
.modal-header__date {
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  color: var(--color-on-surface-variant);
  margin: 2px 0 0;
}
.modal-header__close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(58, 73, 75, 0.3);
  color: var(--color-on-surface-variant);
  cursor: pointer;
  border-radius: 6px;
  transition: all var(--transition-fast);
}
.modal-header__close:hover {
  border-color: var(--color-primary-container);
  color: var(--color-primary-container);
  box-shadow: 0 0 8px rgba(0, 242, 255, 0.3);
}

/* ── Body ── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

/* ── Sections ── */
.report-section {
  margin-bottom: 20px;
}
.report-section__title {
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: var(--text-label-caps-spacing);
  text-transform: uppercase;
  color: var(--color-outline);
  margin: 0 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(58, 73, 75, 0.2);
}
.report-section__title--danger {
  color: var(--color-error);
}
.report-section__title--ai {
  color: var(--color-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.report-section__title--ai .material-symbols-outlined {
  font-size: 18px;
}

/* ── Stat Grid ── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.stat-grid--4 {
  grid-template-columns: repeat(4, 1fr);
}
.stat-item {
  padding: 12px;
  text-align: center;
  border: 1px solid rgba(58, 73, 75, 0.2);
}
.stat-item__value {
  display: block;
  font-family: var(--font-mono);
  font-size: var(--text-data-lg-size);
  font-weight: 600;
  color: var(--color-on-surface);
}
.stat-item__label {
  display: block;
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-outline);
  margin-top: 4px;
}

/* ── Top List ── */
.top-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.top-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(50, 53, 60, 0.15);
  border: 1px solid rgba(58, 73, 75, 0.15);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
}
.top-row__rank {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 242, 255, 0.1);
  color: var(--color-primary-container);
  font-weight: 700;
  border-radius: 4px;
  flex-shrink: 0;
}
.top-row__name {
  flex: 1;
  color: var(--color-on-surface);
  font-weight: 600;
}
.top-row__pnl,
.top-row__winrate {
  font-weight: 600;
  min-width: 80px;
  text-align: right;
}
.top-row__meta {
  color: var(--color-outline);
  min-width: 70px;
  text-align: right;
}

/* ── Alerts ── */
.alert-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.alert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid;
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
}
.alert-item--warning {
  background: rgba(255, 193, 7, 0.06);
  border-color: rgba(255, 193, 7, 0.3);
  color: #ffc107;
}
.alert-item--danger {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}
.alert-item__icon {
  font-size: 18px;
  flex-shrink: 0;
}
.alert-item__type {
  font-weight: 700;
  flex-shrink: 0;
}
.alert-item__msg {
  flex: 1;
}
.alert-item__trader {
  color: var(--color-on-surface-variant);
}

/* ── AI Block ── */
.ai-block {
  padding: 16px;
  border: 1px solid rgba(218, 185, 255, 0.2);
  font-family: var(--font-body);
  font-size: var(--text-body-size);
  line-height: 1.7;
  color: var(--color-on-surface);
  white-space: pre-wrap;
}

/* ── Generated ── */
.modal-generated {
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  color: var(--color-outline);
  text-align: right;
  margin-top: 16px;
}

/* ── Empty ── */
.modal-empty {
  text-align: center;
  padding: 40px;
  font-family: var(--font-mono);
  color: var(--color-outline);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }
  .modal-panel {
    max-height: 90vh;
    border-radius: 12px 12px 0 0;
  }
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .stat-grid--4 {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
