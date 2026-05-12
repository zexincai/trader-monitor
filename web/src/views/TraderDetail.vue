<template>
  <div>
    <el-breadcrumb class="page-section--tight">
      <el-breadcrumb-item :to="{ path: '/' }">总览</el-breadcrumb-item>
      <el-breadcrumb-item>{{ trader?.nick_name || '加载中...' }}</el-breadcrumb-item>
    </el-breadcrumb>

    <template v-if="trader">
      <!-- 基本信息 -->
      <div class="page-section">
        <el-row :gutter="16">
          <el-col :xs="12" :sm="8" :md="4">
            <StatCard size="sm" label="30天盈亏" :value="fmtUSD(latest?.pnl_30d)" :trend="Number(latest?.pnl_30d) >= 0 ? 'up' : 'down'" />
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <StatCard size="sm" label="胜率" :value="fmtPct(latest?.win_ratio)" />
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <StatCard size="sm" label="收益率" :value="fmtPct(latest?.pnl_ratio)" />
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <StatCard size="sm" label="最大回撤" :value="fmtPct(latest?.max_drawdown)" />
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <StatCard size="sm" label="资产规模" :value="fmtUSD(latest?.asset)" />
          </el-col>
          <el-col :xs="12" :sm="8" :md="4">
            <StatCard size="sm" label="在榜天数" :value="`${latest?.onboard_days || 0}天`" />
          </el-col>
        </el-row>
      </div>

      <!-- 图表行 -->
      <el-row :gutter="16" class="page-section">
        <el-col :span="12">
          <el-card>
            <template #header><strong>盈亏趋势</strong></template>
            <v-chart :option="pnlChartOption" style="height: 300px" autoresize />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card>
            <template #header><strong>胜率 & 杠杆变化</strong></template>
            <v-chart :option="leverChartOption" style="height: 300px" autoresize />
          </el-card>
        </el-col>
      </el-row>

      <!-- 交易活跃度 -->
      <el-row :gutter="16" class="page-section">
        <el-col :span="12">
          <el-card>
            <template #header><strong>三窗口盈亏对比</strong></template>
            <v-chart :option="windowPnlOption" style="height: 280px" autoresize />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card>
            <template #header><strong>币种偏好 (近一月)</strong></template>
            <v-chart v-if="preferences.length" :option="coinPrefOption" style="height: 280px" autoresize />
            <el-empty v-else description="无数据" />
          </el-card>
        </el-col>
      </el-row>

      <!-- 当前持仓 -->
      <el-card class="page-section">
        <template #header><strong>当前持仓</strong></template>
        <el-table v-if="positions.length" :data="positions" stripe size="small">
          <el-table-column prop="inst_id" label="币种" width="150" />
          <el-table-column label="方向" width="70">
            <template #default="{ row }">
              <el-tag :type="row.direction === 'long' ? 'success' : 'danger'" size="small">
                {{ row.direction === 'long' ? '多' : '空' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="仓位量" width="110">
            <template #default="{ row }">{{ Number(row.size).toFixed(4) }}</template>
          </el-table-column>
          <el-table-column label="开仓均价" width="110">
            <template #default="{ row }">{{ Number(row.avg_px || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="当前价" width="110">
            <template #default="{ row }">{{ Number(row.last_px || 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="杠杆" width="70">
            <template #default="{ row }">{{ row.lever }}x</template>
          </el-table-column>
          <el-table-column label="名义价值" width="120">
            <template #default="{ row }">{{ fmtUSD(row.notional_usd) }}</template>
          </el-table-column>
          <el-table-column label="浮盈亏">
            <template #default="{ row }">
              <span :class="Number(row.upl) >= 0 ? 'value-positive' : 'value-negative'">
                {{ fmtUSD(row.upl) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="当前无持仓" />
      </el-card>

      <!-- 风险指标 -->
      <el-card>
        <template #header><strong>风险指标</strong></template>
        <el-descriptions :column="4" border>
          <el-descriptions-item label="最大杠杆">{{ latest?.max_lever || 0 }}x</el-descriptions-item>
          <el-descriptions-item label="平均杠杆">{{ Number(latest?.avg_lever || 0).toFixed(1) }}x</el-descriptions-item>
          <el-descriptions-item label="杠杆趋势">{{ latest?.lever_trend || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最大回撤">{{ fmtPct(latest?.max_drawdown) }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>

    <el-empty v-else description="交易员不存在" />
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
import StatCard from "../components/StatCard.vue";

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
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v / 1e4).toFixed(2)}万`;
  return `$${v.toFixed(2)}`;
}

function fmtPct(n) {
  const v = Number(n);
  return isFinite(v) ? `${(v * 100).toFixed(1)}%` : "N/A";
}

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

// 盈亏趋势图
const pnlChartOption = computed(() => {
  const dates = snapshots.value.map((s) => s.snapshot_date);
  return {
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 60, right: 20, top: 10, bottom: 30 },
    xAxis: { type: "category", data: dates },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (v) => { if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(0) + "万"; return v.toFixed(0); } },
    },
    series: [{
      name: "30天盈亏",
      type: "bar",
      data: snapshots.value.map((s) => Number(s.pnl_30d)),
      itemStyle: {
        color: (p) => p.value >= 0 ? MONO.positive : MONO.negative,
      },
    }],
  };
});

// 胜率 & 杠杆
const leverChartOption = computed(() => ({
  tooltip: { trigger: "axis" },
  legend: { bottom: 0 },
  grid: { left: 50, right: 50, top: 10, bottom: 30 },
  xAxis: { type: "category", data: snapshots.value.map((s) => s.snapshot_date) },
  yAxis: [
    { type: "value", name: "胜率", axisLabel: { formatter: (v) => (v * 100).toFixed(0) + "%" } },
    { type: "value", name: "杠杆", axisLabel: { formatter: (v) => v + "x" } },
  ],
  series: [
    {
      name: "胜率",
      type: "line",
      data: snapshots.value.map((s) => Number(s.win_ratio)),
      smooth: true,
      itemStyle: { color: MONO.c1 },
    },
    {
      name: "平均杠杆",
      type: "line",
      yAxisIndex: 1,
      data: snapshots.value.map((s) => Number(s.avg_lever)),
      smooth: true,
      itemStyle: { color: MONO.c3 },
    },
  ],
}));

// 三窗口盈亏柱状图
const windowPnlOption = computed(() => ({
  tooltip: { trigger: "axis" },
  grid: { left: 60, right: 20, top: 10, bottom: 20 },
  xAxis: { type: "category", data: ["近2天", "近一周", "近一月"] },
  yAxis: {
    type: "value",
    axisLabel: { formatter: (v) => { if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(0) + "万"; return v.toFixed(0); } },
  },
  series: [{
    name: "平仓盈亏",
    type: "bar",
    data: [
      Number(latest.value?.pnl_2d || 0),
      Number(latest.value?.pnl_1w || 0),
      Number(latest.value?.pnl_1m || 0),
    ],
    itemStyle: { color: (p) => p.value >= 0 ? MONO.positive : MONO.negative },
    label: { show: true, formatter: (p) => fmtUSD(p.value), fontSize: 12 },
  }],
}));

// 币种偏好饼图
const coinPrefOption = computed(() => ({
  tooltip: { trigger: "item", formatter: "{b}: {c}笔 ({d}%)" },
  legend: { bottom: 0 },
  series: [{
    type: "pie",
    radius: ["40%", "70%"],
    data: preferences.value.map((p, i) => ({
      name: p.inst_id,
      value: p.trade_count,
      itemStyle: { color: MONO_SERIES[i % MONO_SERIES.length] },
    })),
    label: { formatter: "{b}\n{d}%" },
  }],
}));

onMounted(async () => {
  const id = route.params.id;
  try {
    const [{ data: t }, { data: s }, { data: p }, { data: prefs }] = await Promise.all([
      fetchTraderDetail(id),
      fetchSnapshots(id, 30),
      fetchPositions(id),
      fetchPreferences(id),
    ]);
    trader.value = t;
    snapshots.value = s || [];
    positions.value = p || [];
    preferences.value = prefs || [];
  } catch (err) {
    console.error("加载交易员详情失败:", err);
  }
});
</script>

<style scoped>
/* All styling is handled by StatCard component and global CSS utilities */
</style>
