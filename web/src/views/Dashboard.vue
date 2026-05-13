<template>
  <div>
    <div class="page-header__meta" style="margin-bottom:12px">
      <span class="page-header__badge">Stream_Live</span>
      <span class="text-data-sm" style="color:var(--color-on-surface-variant)">{{ traders.length }} Active Nodes</span>
    </div>

    <!-- 统计卡片 -->
    <div class="page-section">
      <el-row :gutter="12">
        <el-col :xs="12" :sm="12" :md="6">
          <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
            <div class="stat-value">{{ traders.length }}</div>
            <div class="stat-label">Nodes</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
            <div class="stat-value" :class="summary.totalPnl2d >= 0 ? 'value-positive' : 'value-negative'">
              {{ fmtUSD(summary.totalPnl2d) }}
            </div>
            <div class="stat-label">PNL_48H</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
            <div class="stat-value">{{ fmtPct(summary.avgWinRate) }}</div>
            <div class="stat-label">WIN_RATE_30D</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
            <div class="stat-value">{{ fmtPct(summary.avgDrawdown) }}</div>
            <div class="stat-label">MAX_DRAWDOWN</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 图表行 -->
    <el-row :gutter="12" class="page-section">
      <el-col :span="14">
        <el-card>
          <template #header><strong>PNL_TREND_30D</strong></template>
          <v-chart :option="pnlTrendOption" style="height: 320px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header><strong>RISK_REWARD_MATRIX</strong></template>
          <v-chart :option="riskScatterOption" style="height: 320px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <!-- 排名表 -->
    <el-card>
      <template #header><strong>TRADER_RANKING</strong></template>
      <el-table :data="traders" stripe highlight-current-row @row-click="goDetail" style="cursor: pointer">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="nick_name" label="TRADER" width="140" />
        <el-table-column label="PNL_30D" sortable prop="pnl_30d" width="120">
          <template #default="{ row }">
            <span :class="Number(row.pnl_30d) >= 0 ? 'value-positive' : 'value-negative'">
              {{ fmtUSD(row.pnl_30d) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="ROI" sortable prop="pnl_ratio" width="100">
          <template #default="{ row }">{{ fmtPct(row.pnl_ratio) }}</template>
        </el-table-column>
        <el-table-column label="WIN% " sortable prop="win_ratio" width="100">
          <template #default="{ row }">{{ fmtPct(row.win_ratio) }}</template>
        </el-table-column>
        <el-table-column label="DRAWDOWN" sortable prop="max_drawdown" width="110">
          <template #default="{ row }">{{ fmtPct(row.max_drawdown) }}</template>
        </el-table-column>
        <el-table-column label="AUM" sortable prop="asset" width="120">
          <template #default="{ row }">{{ fmtUSD(row.asset) }}</template>
        </el-table-column>
        <el-table-column label="POS" sortable prop="position_count" width="70" />
        <el-table-column label="LEVER_TREND" width="110">
          <template #default="{ row }">{{ row.lever_trend || '-' }}</template>
        </el-table-column>
        <el-table-column label="VOL_24H" sortable prop="volume_24h" width="130">
          <template #default="{ row }">{{ fmtUSD(row.volume_24h) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart, ScatterChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { fetchLatestSnapshots } from "../api/index.js";

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent]);

const router = useRouter();
const traders = ref([]);

function fmtUSD(n) {
  const v = Number(n);
  if (!isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v/1e4).toFixed(2)}W`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(n) { const v = Number(n); return isFinite(v) ? `${(v*100).toFixed(1)}%` : "N/A"; }

const summary = computed(() => {
  const arr = traders.value;
  if (!arr.length) return { totalPnl2d: 0, avgWinRate: 0, avgDrawdown: 0 };
  return {
    totalPnl2d: arr.reduce((s,t) => s + Number(t.pnl_2d||0), 0),
    avgWinRate: arr.reduce((s,t) => s + Number(t.win_ratio||0), 0) / arr.length,
    avgDrawdown: arr.reduce((s,t) => s + Number(t.max_drawdown||0), 0) / arr.length,
  };
});

const C = ['#00f2ff','#dab9ff','#74f5ff','#8f03ff','#00dbe7','#b9cacb','#849495','#3a494b'];

const pnlTrendOption = computed(() => ({
  tooltip: { trigger: "axis" },
  legend: { bottom: 0, textStyle: { color: '#b9cacb' } },
  grid: { left: 60, right: 20, top: 20, bottom: 30 },
  xAxis: { type: "category", data: ["48H", "1W", "1M"], axisLabel: { color: '#849495' } },
  yAxis: { type: "value", axisLabel: { color: '#849495', formatter: (v) => Math.abs(v)>=1e4 ? (v/1e4).toFixed(0)+'W' : v.toFixed(0) } },
  series: traders.value.map((t,i) => ({
    name: t.nick_name, type: "line",
    data: [Number(t.pnl_2d||0), Number(t.pnl_1w||0), Number(t.pnl_1m||0)],
    smooth: true, symbol: "circle", symbolSize: 8,
    itemStyle: { color: C[i % C.length] },
  })),
}));

const riskScatterOption = computed(() => ({
  tooltip: { trigger: "item", formatter: (p) => `${p.name}<br/>ROI: ${fmtPct(p.value[0])}<br/>DD: ${fmtPct(p.value[1])}` },
  grid: { left: 50, right: 20, top: 20, bottom: 30 },
  xAxis: { type: "value", name: "ROI", axisLabel: { color:'#849495', formatter: (v) => (v*100).toFixed(0)+"%" } },
  yAxis: { type: "value", name: "DD", axisLabel: { color:'#849495', formatter: (v) => (v*100).toFixed(0)+"%" } },
  series: [{
    type: "scatter",
    symbolSize: (val) => Math.max(20, Math.min(60, val[2]/50000)),
    data: traders.value.map(t => ({ name: t.nick_name, value: [Number(t.pnl_ratio||0), Math.abs(Number(t.max_drawdown||0)), Number(t.asset||0)] })),
    itemStyle: { color: '#00f2ff' },
    label: { show: true, formatter: (p) => p.name, position: "top", fontSize: 12, color: '#b9cacb' },
  }],
}));

function goDetail(row) { router.push(`/trader/${row.trader_id}`); }

onMounted(async () => {
  try { const { data } = await fetchLatestSnapshots(); traders.value = data || []; }
  catch (err) { console.error(err); }
});
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
</style>
