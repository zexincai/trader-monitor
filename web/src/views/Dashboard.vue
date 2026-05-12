<template>
  <div>
    <!-- 统计卡片 -->
    <div class="page-section">
      <el-row :gutter="16">
        <el-col :xs="12" :sm="12" :md="6">
          <StatCard label="监控人数" :value="traders.length" />
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <StatCard
            label="近2天总盈亏"
            :value="fmtUSD(summary.totalPnl2d)"
            :trend="summary.totalPnl2d >= 0 ? 'up' : 'down'"
          />
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <StatCard label="平均胜率 (30天)" :value="fmtPct(summary.avgWinRate)" />
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <StatCard label="平均最大回撤" :value="fmtPct(summary.avgDrawdown)" />
        </el-col>
      </el-row>
    </div>

    <!-- 图表行 -->
    <el-row :gutter="16" class="page-section">
      <el-col :span="14">
        <el-card>
          <template #header><strong>近30天盈亏趋势</strong></template>
          <v-chart :option="pnlTrendOption" style="height: 320px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header><strong>风险收益分布</strong></template>
          <v-chart :option="riskScatterOption" style="height: 320px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <!-- 交易员排名 -->
    <el-card>
      <template #header><strong>交易员绩效排名</strong></template>
      <el-table :data="traders" stripe highlight-current-row @row-click="goDetail" style="cursor: pointer">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="nick_name" label="交易员" width="140" />
        <el-table-column label="30天盈亏" sortable prop="pnl_30d" width="120">
          <template #default="{ row }">
            <span :class="Number(row.pnl_30d) >= 0 ? 'value-positive' : 'value-negative'">
              {{ fmtUSD(row.pnl_30d) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="收益率" sortable prop="pnl_ratio" width="100">
          <template #default="{ row }">{{ fmtPct(row.pnl_ratio) }}</template>
        </el-table-column>
        <el-table-column label="胜率" sortable prop="win_ratio" width="100">
          <template #default="{ row }">{{ fmtPct(row.win_ratio) }}</template>
        </el-table-column>
        <el-table-column label="最大回撤" sortable prop="max_drawdown" width="100">
          <template #default="{ row }">{{ fmtPct(row.max_drawdown) }}</template>
        </el-table-column>
        <el-table-column label="AUM" sortable prop="asset" width="120">
          <template #default="{ row }">{{ fmtUSD(row.asset) }}</template>
        </el-table-column>
        <el-table-column label="持仓数" sortable prop="position_count" width="80" />
        <el-table-column label="杠杆趋势" width="100">
          <template #default="{ row }">{{ row.lever_trend || '-' }}</template>
        </el-table-column>
        <el-table-column label="24h交易额" sortable prop="volume_24h" width="130">
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
import StatCard from "../components/StatCard.vue";

use([CanvasRenderer, LineChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent]);

const router = useRouter();
const traders = ref([]);

function fmtUSD(n) {
  const v = Number(n);
  if (!isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v / 1e4).toFixed(2)}万`;
  return `$${v.toFixed(2)}`;
}

function fmtPct(n) {
  const v = Number(n);
  return isFinite(v) ? `${(v * 100).toFixed(1)}%` : "N/A";
}

const summary = computed(() => {
  const arr = traders.value;
  if (!arr.length) return { totalPnl2d: 0, avgWinRate: 0, avgDrawdown: 0 };
  return {
    totalPnl2d: arr.reduce((s, t) => s + Number(t.pnl_2d || 0), 0),
    avgWinRate: arr.reduce((s, t) => s + Number(t.win_ratio || 0), 0) / arr.length,
    avgDrawdown: arr.reduce((s, t) => s + Number(t.max_drawdown || 0), 0) / arr.length,
  };
});

const MONO = {
  positive: '#2d5a3d',
  negative: '#ba1a1a',
  c1: '#1a1c1c',
  c2: '#4c4546',
  c3: '#7e7576',
  c4: '#5d5f5f',
  c5: '#2f3131',
  c6: '#cfc4c5',
  c7: '#848484',
  c8: '#c6c6c6',
};

const MONO_SERIES = [MONO.c1, MONO.c2, MONO.c3, MONO.c4, MONO.c5, MONO.c6, MONO.c7, MONO.c8];

const pnlTrendOption = computed(() => ({
  tooltip: { trigger: "axis" },
  legend: { bottom: 0 },
  grid: { left: 60, right: 20, top: 20, bottom: 30 },
  xAxis: { type: "category", data: ["近2天", "近一周", "近一月"] },
  yAxis: {
    type: "value",
    axisLabel: {
      formatter: (v) => {
        if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(0) + "万";
        return v.toFixed(0);
      },
    },
  },
  series: traders.value.map((t, i) => ({
    name: t.nick_name,
    type: "line",
    data: [Number(t.pnl_2d || 0), Number(t.pnl_1w || 0), Number(t.pnl_1m || 0)],
    smooth: true,
    symbol: "circle",
    symbolSize: 8,
    itemStyle: { color: MONO_SERIES[i % MONO_SERIES.length] },
  })),
}));

const riskScatterOption = computed(() => ({
  tooltip: {
    trigger: "item",
    formatter: (p) => `${p.name}<br/>收益率: ${fmtPct(p.value[0])}<br/>最大回撤: ${fmtPct(p.value[1])}`,
  },
  grid: { left: 50, right: 20, top: 20, bottom: 30 },
  xAxis: {
    type: "value",
    name: "收益率",
    axisLabel: { formatter: (v) => (v * 100).toFixed(0) + "%" },
  },
  yAxis: {
    type: "value",
    name: "最大回撤",
    axisLabel: { formatter: (v) => (v * 100).toFixed(0) + "%" },
  },
  series: [{
    type: "scatter",
    symbolSize: (val) => Math.max(20, Math.min(60, val[2] / 50000)),
    data: traders.value.map((t) => ({
      name: t.nick_name,
      value: [Number(t.pnl_ratio || 0), Math.abs(Number(t.max_drawdown || 0)), Number(t.asset || 0)],
    })),
    itemStyle: { color: MONO.c1 },
    label: {
      show: true,
      formatter: (p) => p.name,
      position: "top",
      fontSize: 12,
    },
  }],
}));

function goDetail(row) {
  router.push(`/trader/${row.trader_id}`);
}

onMounted(async () => {
  try {
    const { data } = await fetchLatestSnapshots();
    traders.value = data || [];
  } catch (err) {
    console.error("加载快照失败:", err);
  }
});
</script>

<style scoped>
/* ── el-row spacing is now handled by page-section ── */
</style>
