<template>
  <div>
    <el-breadcrumb class="page-section--tight">
      <el-breadcrumb-item :to="{ path: '/' }">Overview</el-breadcrumb-item>
      <el-breadcrumb-item>{{ trader?.nick_name || 'LOADING...' }}</el-breadcrumb-item>
    </el-breadcrumb>

    <template v-if="trader">
      <!-- 基本信息 -->
      <div class="page-section">
        <el-row :gutter="12">
          <el-col :xs="12" :sm="8" :md="4">
            <div class="glass-panel glow-border" style="padding:14px;text-align:center;border:var(--glass-border-subtle)">
              <div class="stat-value" :class="Number(latest?.pnl_30d) >= 0 ? 'value-positive' : 'value-negative'" style="font-size:20px">
                {{ fmtUSD(latest?.pnl_30d) }}
              </div>
              <div class="stat-label">PNL_30D</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="glass-panel glow-border" style="padding:14px;text-align:center;border:var(--glass-border-subtle)">
              <div class="stat-value" style="font-size:20px">{{ fmtPct(latest?.win_ratio) }}</div>
              <div class="stat-label">WIN_RATE</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="glass-panel glow-border" style="padding:14px;text-align:center;border:var(--glass-border-subtle)">
              <div class="stat-value" style="font-size:20px">{{ fmtPct(latest?.pnl_ratio) }}</div>
              <div class="stat-label">ROI</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="glass-panel glow-border" style="padding:14px;text-align:center;border:var(--glass-border-subtle)">
              <div class="stat-value" style="font-size:20px">{{ fmtPct(latest?.max_drawdown) }}</div>
              <div class="stat-label">DRAWDOWN</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="glass-panel glow-border" style="padding:14px;text-align:center;border:var(--glass-border-subtle)">
              <div class="stat-value" style="font-size:20px">{{ fmtUSD(latest?.asset) }}</div>
              <div class="stat-label">AUM</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <div class="glass-panel glow-border" style="padding:14px;text-align:center;border:var(--glass-border-subtle)">
              <div class="stat-value" style="font-size:20px">{{ latest?.onboard_days || 0 }}D</div>
              <div class="stat-label">ONBOARD</div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 图表行 -->
      <el-row :gutter="12" class="page-section">
        <el-col :xs="24" :md="12">
          <el-card>
            <template #header><strong>PNL_HISTORY</strong></template>
            <v-chart :option="pnlChartOption" style="height: 300px" autoresize />
          </el-card>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-card>
            <template #header><strong>WIN_RATE_LEVERAGE</strong></template>
            <v-chart :option="leverChartOption" style="height: 300px" autoresize />
          </el-card>
        </el-col>
      </el-row>

      <!-- 窗口 + 偏好 -->
      <el-row :gutter="12" class="page-section">
        <el-col :xs="24" :md="12">
          <el-card>
            <template #header><strong>PNL_WINDOWS</strong></template>
            <v-chart :option="windowPnlOption" style="height: 280px" autoresize />
          </el-card>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-card>
            <template #header><strong>COIN_PREF_1M</strong></template>
            <v-chart v-if="preferences.length" :option="coinPrefOption" style="height: 280px" autoresize />
            <el-empty v-else description="NO_DATA" />
          </el-card>
        </el-col>
      </el-row>

      <!-- 持仓 -->
      <el-card class="page-section">
        <template #header><strong>ACTIVE_POSITIONS</strong></template>
        <el-table v-if="positions.length" :data="positions" stripe size="small">
          <el-table-column prop="inst_id" label="SYMBOL" width="150" />
          <el-table-column label="SIDE" width="70">
            <template #default="{ row }">
              <el-tag :type="row.direction === 'long' ? 'success' : 'danger'" size="small">
                {{ row.direction === 'long' ? 'LONG' : 'SHORT' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="SIZE" width="110">
            <template #default="{ row }">{{ Number(row.size).toFixed(4) }}</template>
          </el-table-column>
          <el-table-column label="ENTRY" width="110">
            <template #default="{ row }">{{ Number(row.avg_px || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="MARK" width="110">
            <template #default="{ row }">{{ Number(row.last_px || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="LEV" width="70">
            <template #default="{ row }">{{ row.lever }}x</template>
          </el-table-column>
          <el-table-column label="NOTIONAL" width="120">
            <template #default="{ row }">{{ fmtUSD(row.notional_usd) }}</template>
          </el-table-column>
          <el-table-column label="UPL">
            <template #default="{ row }">
              <span :class="Number(row.upl) >= 0 ? 'value-positive' : 'value-negative'">{{ fmtUSD(row.upl) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="NO_POSITIONS" />
      </el-card>

      <!-- 风险 -->
      <el-card>
        <template #header><strong>RISK_METRICS</strong></template>
        <el-descriptions :column="4" border>
          <el-descriptions-item label="MAX_LEV">{{ latest?.max_lever || 0 }}x</el-descriptions-item>
          <el-descriptions-item label="AVG_LEV">{{ Number(latest?.avg_lever || 0).toFixed(1) }}x</el-descriptions-item>
          <el-descriptions-item label="LEV_TREND">{{ latest?.lever_trend || '-' }}</el-descriptions-item>
          <el-descriptions-item label="MAX_DD">{{ fmtPct(latest?.max_drawdown) }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>

    <el-empty v-else description="TRADER_NOT_FOUND" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart, BarChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { fetchTraderDetail, fetchSnapshots, fetchPositions, fetchPreferences } from "../api/index.js";

use([CanvasRenderer, LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent]);

const route = useRoute();
const trader = ref(null);
const snapshots = ref([]);
const positions = ref([]);
const preferences = ref([]);
const latest = computed(() => trader.value?.latestSnapshot || {});

function fmtUSD(n) {
  const v = Number(n);
  if (!isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v/1e4).toFixed(2)}W`;
  return `$${v.toFixed(2)}`;
}
function fmtPct(n) { const v = Number(n); return isFinite(v) ? `${(v*100).toFixed(1)}%` : "N/A"; }

const C = ['#00f2ff','#dab9ff','#74f5ff','#8f03ff','#00dbe7','#b9cacb','#849495','#3a494b'];
const POS = '#00f2ff';
const NEG = '#ffb4ab';

const pnlChartOption = computed(() => ({
  tooltip: { trigger: "axis" },
  legend: { bottom: 0, textStyle: { color: '#b9cacb' } },
  grid: { left: 60, right: 20, top: 10, bottom: 30 },
  xAxis: { type: "category", data: snapshots.value.map(s => s.snapshot_date), axisLabel: { color: '#849495' } },
  yAxis: { type: "value", axisLabel: { color: '#849495', formatter: (v) => Math.abs(v)>=1e4 ? (v/1e4).toFixed(0)+'W' : v.toFixed(0) } },
  series: [{
    name: "PNL_30D", type: "bar",
    data: snapshots.value.map(s => Number(s.pnl_30d)),
    itemStyle: { color: (p) => p.value >= 0 ? POS : NEG },
  }],
}));

const leverChartOption = computed(() => ({
  tooltip: { trigger: "axis" },
  legend: { bottom: 0, textStyle: { color: '#b9cacb' } },
  grid: { left: 50, right: 50, top: 10, bottom: 30 },
  xAxis: { type: "category", data: snapshots.value.map(s => s.snapshot_date), axisLabel: { color: '#849495' } },
  yAxis: [
    { type: "value", name: "WIN%", axisLabel: { color:'#849495', formatter: (v) => (v*100).toFixed(0)+"%" } },
    { type: "value", name: "LEV", axisLabel: { color:'#849495', formatter: (v) => v+"x" } },
  ],
  series: [
    { name: "WIN_RATE", type: "line", data: snapshots.value.map(s => Number(s.win_ratio)), smooth: true, itemStyle: { color: C[0] } },
    { name: "AVG_LEV", type: "line", yAxisIndex: 1, data: snapshots.value.map(s => Number(s.avg_lever)), smooth: true, itemStyle: { color: C[1] } },
  ],
}));

const windowPnlOption = computed(() => ({
  tooltip: { trigger: "axis" },
  grid: { left: 60, right: 20, top: 10, bottom: 20 },
  xAxis: { type: "category", data: ["48H","1W","1M"], axisLabel: { color:'#849495' } },
  yAxis: { type: "value", axisLabel: { color:'#849495', formatter: (v) => Math.abs(v)>=1e4 ? (v/1e4).toFixed(0)+'W' : v.toFixed(0) } },
  series: [{
    name: "PNL", type: "bar",
    data: [Number(latest.value?.pnl_2d||0), Number(latest.value?.pnl_1w||0), Number(latest.value?.pnl_1m||0)],
    itemStyle: { color: (p) => p.value >= 0 ? POS : NEG },
    label: { show: true, formatter: (p) => fmtUSD(p.value), fontSize: 12, color: '#b9cacb' },
  }],
}));

const coinPrefOption = computed(() => ({
  tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
  legend: { bottom: 0, textStyle: { color: '#b9cacb' } },
  series: [{
    type: "pie", radius: ["40%","70%"],
    data: preferences.value.map((p,i) => ({ name: p.inst_id, value: p.trade_count, itemStyle: { color: C[i%C.length] } })),
    label: { formatter: "{b}\n{d}%", color: '#b9cacb' },
  }],
}));

onMounted(async () => {
  const id = route.params.id;
  try {
    const [{ data: t }, { data: s }, { data: p }, { data: prefs }] = await Promise.all([
      fetchTraderDetail(id), fetchSnapshots(id, 30), fetchPositions(id), fetchPreferences(id),
    ]);
    trader.value = t; snapshots.value = s || []; positions.value = p || []; preferences.value = prefs || [];
  } catch (err) { console.error(err); }
});
</script>
