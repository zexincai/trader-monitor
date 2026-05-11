<template>
  <div>
    <el-breadcrumb style="margin-bottom: 16px">
      <el-breadcrumb-item :to="{ path: '/' }">总览</el-breadcrumb-item>
      <el-breadcrumb-item>{{ trader?.nick_name || '加载中...' }}</el-breadcrumb-item>
    </el-breadcrumb>

    <template v-if="trader">
      <!-- 基本信息 -->
      <el-row :gutter="16" style="margin-bottom: 20px">
        <el-col :span="4">
          <el-card shadow="hover"><div class="stat-card">
            <div class="stat-value">{{ fmtUSD(latest?.pnl_30d) }}</div>
            <div class="stat-label">30天盈亏</div>
          </div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div class="stat-card">
            <div class="stat-value">{{ fmtPct(latest?.win_ratio) }}</div>
            <div class="stat-label">胜率</div>
          </div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div class="stat-card">
            <div class="stat-value">{{ fmtPct(latest?.pnl_ratio) }}</div>
            <div class="stat-label">收益率</div>
          </div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div class="stat-card">
            <div class="stat-value">{{ fmtPct(latest?.max_drawdown) }}</div>
            <div class="stat-label">最大回撤</div>
          </div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div class="stat-card">
            <div class="stat-value">{{ fmtUSD(latest?.asset) }}</div>
            <div class="stat-label">资产规模</div>
          </div></el-card>
        </el-col>
        <el-col :span="4">
          <el-card shadow="hover"><div class="stat-card">
            <div class="stat-value">{{ latest?.onboard_days || 0 }}天</div>
            <div class="stat-label">在榜天数</div>
          </div></el-card>
        </el-col>
      </el-row>

      <!-- 图表行 -->
      <el-row :gutter="16" style="margin-bottom: 20px">
        <el-col :span="12">
          <el-card shadow="hover">
            <template #header><strong>盈亏趋势</strong></template>
            <v-chart :option="pnlChartOption" style="height: 300px" autoresize />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="hover">
            <template #header><strong>胜率 & 杠杆变化</strong></template>
            <v-chart :option="leverChartOption" style="height: 300px" autoresize />
          </el-card>
        </el-col>
      </el-row>

      <!-- 交易活跃度 -->
      <el-row :gutter="16" style="margin-bottom: 20px">
        <el-col :span="12">
          <el-card shadow="hover">
            <template #header><strong>三窗口盈亏对比</strong></template>
            <v-chart :option="windowPnlOption" style="height: 280px" autoresize />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="hover">
            <template #header><strong>币种偏好 (近一月)</strong></template>
            <v-chart v-if="preferences.length" :option="coinPrefOption" style="height: 280px" autoresize />
            <el-empty v-else description="无数据" />
          </el-card>
        </el-col>
      </el-row>

      <!-- 当前持仓 -->
      <el-card shadow="hover" style="margin-bottom: 20px">
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
              <span :class="Number(row.upl) >= 0 ? 'profit' : 'loss'">{{ fmtUSD(row.upl) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="当前无持仓" />
      </el-card>

      <!-- 风险指标 -->
      <el-card shadow="hover">
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
    series: [
      {
        name: "30天盈亏",
        type: "bar",
        data: snapshots.value.map((s) => Number(s.pnl_30d)),
        itemStyle: {
          color: (p) => p.value >= 0 ? "#67c23a" : "#f56c6c",
        },
      },
    ],
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
      itemStyle: { color: "#409eff" },
    },
    {
      name: "平均杠杆",
      type: "line",
      yAxisIndex: 1,
      data: snapshots.value.map((s) => Number(s.avg_lever)),
      smooth: true,
      itemStyle: { color: "#e6a23c" },
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
    itemStyle: { color: (p) => p.value >= 0 ? "#67c23a" : "#f56c6c" },
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
    data: preferences.value.map((p) => ({ name: p.inst_id, value: p.trade_count })),
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
.stat-card { text-align: center; padding: 8px 0; }
.stat-value { font-size: 24px; font-weight: 700; color: #303133; }
.stat-label { font-size: 12px; color: #909399; margin-top: 4px; }
.profit { color: #67c23a; }
.loss { color: #f56c6c; }
</style>
