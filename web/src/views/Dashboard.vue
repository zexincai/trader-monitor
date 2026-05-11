<template>
  <div>
    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ traders.length }}</div>
            <div class="stat-label">监控人数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value" :class="summary.totalPnl2d >= 0 ? 'profit' : 'loss'">
              {{ fmtUSD(summary.totalPnl2d) }}
            </div>
            <div class="stat-label">近2天总盈亏</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ fmtPct(summary.avgWinRate) }}</div>
            <div class="stat-label">平均胜率 (30天)</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ fmtPct(summary.avgDrawdown) }}</div>
            <div class="stat-label">平均最大回撤</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表行 -->
    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><strong>近30天盈亏趋势</strong></template>
          <v-chart :option="pnlTrendOption" style="height: 320px" autoresize />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><strong>风险收益分布</strong></template>
          <v-chart :option="riskScatterOption" style="height: 320px" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <!-- 交易员排名 -->
    <el-card shadow="hover">
      <template #header><strong>交易员绩效排名</strong></template>
      <el-table :data="traders" stripe highlight-current-row @row-click="goDetail" style="cursor: pointer">
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="nick_name" label="交易员" width="140" />
        <el-table-column label="30天盈亏" sortable prop="pnl_30d" width="120">
          <template #default="{ row }">
            <span :class="row.pnl_30d >= 0 ? 'profit' : 'loss'">{{ fmtUSD(row.pnl_30d) }}</span>
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
  series: traders.value.map((t) => ({
    name: t.nick_name,
    type: "line",
    data: [Number(t.pnl_2d || 0), Number(t.pnl_1w || 0), Number(t.pnl_1m || 0)],
    smooth: true,
    symbol: "circle",
    symbolSize: 8,
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
.stat-card { text-align: center; padding: 8px 0; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.profit { color: #67c23a; }
.loss { color: #f56c6c; }
</style>
