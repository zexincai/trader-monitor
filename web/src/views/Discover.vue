<template>
  <div>
    <div class="page-header__meta" style="margin-bottom:12px">
      <span class="page-header__badge">DISCOVERY_ENGINE</span>
      <span class="text-data-sm" style="color:var(--color-on-surface-variant)">{{ traders.length }} Results</span>
    </div>

    <!-- Filter -->
    <el-card class="page-section">
      <template #header><strong>FILTER_PARAMETERS</strong></template>
      <el-form :inline="true" :model="filters" size="default">
        <el-form-item label="MIN_WIN%">
          <el-input-number v-model="filters.winRatio" :min="0" :max="1" :step="0.05" :precision="2" style="width:130px" />
        </el-form-item>
        <el-form-item label="MAX_DD">
          <el-input-number v-model="filters.maxRetreat" :min="0" :max="1" :step="0.01" :precision="2" style="width:130px" />
        </el-form-item>
        <el-form-item label="PERIOD">
          <el-select v-model="filters.period" style="width:100px">
            <el-option label="3D" value="3" /><el-option label="7D" value="7" /><el-option label="30D" value="30" /><el-option label="90D" value="90" />
          </el-select>
        </el-form-item>
        <el-form-item label="SORT">
          <el-select v-model="filters.sortType" style="width:120px">
            <el-option label="BY_PNL" value="pnl" /><el-option label="BY_ROI" value="pnlRatio" />
          </el-select>
        </el-form-item>
        <el-form-item label="LIMIT">
          <el-input-number v-model="filters.limit" :min="5" :max="100" style="width:100px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="doSearch" :loading="loading">
            <span class="material-symbols-outlined" style="font-size:14px;margin-right:4px">search</span>SEARCH
          </el-button>
          <el-button @click="resetFilters">RESET</el-button>
        </el-form-item>
      </el-form>
      <div class="quick-filters">
        <span class="quick-filters__label">PRESETS:</span>
        <button
          v-for="preset in presets" :key="preset.label"
          class="quick-filters__btn"
          :class="{ 'quick-filters__btn--active': presetActive === preset.label }"
          @click="applyPreset(preset)"
        >{{ preset.label }}</button>
      </div>
    </el-card>

    <!-- Results -->
    <el-card>
      <template #header>
        <div class="card-header-row">
          <strong>RESULTS ({{ traders.length }})</strong>
          <span class="text-data-sm" style="color:var(--color-on-surface-variant)">
            MONITORED: {{ traders.filter(t => t.monitored).length }}/{{ traders.length }}
          </span>
        </div>
      </template>
      <el-table :data="traders" stripe max-height="600" v-loading="loading" size="small">
        <el-table-column label="STATUS" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.monitored" type="success" size="small">MONITORED</el-tag>
            <el-tag v-else type="info" size="small">IDLE</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="nickName" label="NAME" width="140" />
        <el-table-column prop="authorId" label="ID" width="180" show-overflow-tooltip />
        <el-table-column label="PNL_30D" sortable prop="pnl" width="120">
          <template #default="{ row }">
            <span :class="Number(row.pnl) >= 0 ? 'value-positive' : 'value-negative'">{{ fmtUSD(row.pnl) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="ROI" sortable prop="pnlRatio" width="100">
          <template #default="{ row }">{{ fmtPct(row.pnlRatio) }}</template>
        </el-table-column>
        <el-table-column label="WIN%" sortable prop="winRatio" width="90">
          <template #default="{ row }">{{ fmtPct(row.winRatio || row.winRate) }}</template>
        </el-table-column>
        <el-table-column label="MAX_DD" sortable prop="maxDrawdown" width="100">
          <template #default="{ row }">{{ fmtPct(row.maxDrawdown || row.maxRetreat) }}</template>
        </el-table-column>
        <el-table-column label="AUM" sortable prop="asset" width="120">
          <template #default="{ row }">{{ fmtUSD(row.asset) }}</template>
        </el-table-column>
        <el-table-column label="DAYS" sortable prop="onboardDuration" width="70" />
        <el-table-column label="ACTION" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.monitored" type="primary" size="small" :loading="row._adding" @click="addTrader(row)">
              ADD_NODE
            </el-button>
            <el-button v-else type="danger" size="small" plain :loading="row._removing" @click="removeTrader(row)">
              REMOVE
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && traders.length === 0" description="CLICK_SEARCH_TO_DISCOVER" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { ElMessage } from "element-plus";
import api from "../api/index.js";

const filters = reactive({ winRatio: 0.8, maxRetreat: 0.1, period: "30", sortType: "pnl", limit: 20 });
const presets = [
  { label: "HIGH_WIN_LOW_DD", winRatio: 0.85, maxRetreat: 0.08, period: "30", sortType: "pnl" },
  { label: "RECENT_GAINERS", winRatio: null, maxRetreat: null, period: "7", sortType: "pnl" },
  { label: "LONG_RUNNERS", winRatio: 0.7, maxRetreat: 0.15, period: "90", sortType: "pnlRatio" },
  { label: "HIGH_ROI", winRatio: null, maxRetreat: null, period: "30", sortType: "pnlRatio" },
];
const presetActive = ref("");
const traders = ref([]);
const loading = ref(false);

function fmtUSD(n) {
  const v = Number(n);
  if (!isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v/1e4).toFixed(2)}W`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(n) { const v = Number(n); return isFinite(v) ? `${(v*100).toFixed(1)}%` : "N/A"; }

function applyPreset(p) {
  presetActive.value = p.label;
  filters.winRatio = p.winRatio; filters.maxRetreat = p.maxRetreat;
  filters.period = p.period; filters.sortType = p.sortType;
  doSearch();
}
function resetFilters() {
  presetActive.value = "";
  filters.winRatio = 0.8; filters.maxRetreat = 0.1; filters.period = "30"; filters.sortType = "pnl"; filters.limit = 20;
  traders.value = [];
}
async function doSearch() {
  loading.value = true;
  try {
    const params = { period: filters.period, sortType: filters.sortType, limit: String(filters.limit) };
    if (filters.winRatio != null) params.winRatio = String(filters.winRatio);
    if (filters.maxRetreat != null) params.maxRetreat = String(filters.maxRetreat);
    const res = await api.get("/traders/discover", { params });
    traders.value = (res.data?.data || []).map(t => ({ ...t, _adding: false, _removing: false }));
  } catch (err) {
    ElMessage.error("SEARCH_FAILED: " + (err.response?.data?.msg || err.message));
  } finally { loading.value = false; }
}
async function addTrader(row) {
  row._adding = true;
  try {
    await api.post("/traders/add", { authorId: row.authorId, nickName: row.nickName, note: `${fmtPct(row.winRate||row.winRatio)} WR ${fmtPct(row.maxDrawdown||row.maxRetreat)} DD` });
    row.monitored = true;
    ElMessage.success(`${row.nickName} ADDED`);
  } catch (err) { ElMessage.error("FAILED: " + (err.response?.data?.msg || err.message)); }
  finally { row._adding = false; }
}
async function removeTrader(row) {
  row._removing = true;
  try { await api.delete(`/traders/${row.authorId}`); row.monitored = false; ElMessage.success(`${row.nickName} REMOVED`); }
  catch (err) { ElMessage.error("FAILED: " + (err.response?.data?.msg || err.message)); }
  finally { row._removing = false; }
}
</script>

<style scoped>
.page-header__badge {
  padding: 2px 8px;
  background: var(--color-surface-container-highest);
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  color: var(--color-outline);
  text-transform: uppercase;
  border: 1px solid rgba(58,73,75,0.3);
}
.quick-filters { margin-top: 12px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.quick-filters__label {
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  margin-right: 4px;
}
.quick-filters__btn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid var(--color-outline-variant);
  color: var(--color-on-surface-variant);
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.quick-filters__btn:hover { border-color: var(--color-primary-container); color: var(--color-primary-container); }
.quick-filters__btn--active {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  border-color: var(--color-primary-container);
  box-shadow: 0 0 8px rgba(0,242,255,0.3);
}
</style>
