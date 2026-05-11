<template>
  <div>
    <el-breadcrumb style="margin-bottom: 16px">
      <el-breadcrumb-item :to="{ path: '/' }">总览</el-breadcrumb-item>
      <el-breadcrumb-item>持仓监控</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 摘要 -->
    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card shadow="hover"><div class="stat-card">
          <div class="stat-value">{{ positions.length }}</div>
          <div class="stat-label">总持仓数</div>
        </div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover"><div class="stat-card">
          <div class="stat-value">{{ longCount }}</div>
          <div class="stat-label">多头仓位</div>
        </div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover"><div class="stat-card">
          <div class="stat-value">{{ shortCount }}</div>
          <div class="stat-label">空头仓位</div>
        </div></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover"><div class="stat-card">
          <div class="stat-value" :class="totalUpl >= 0 ? 'profit' : 'loss'">{{ fmtUSD(totalUpl) }}</div>
          <div class="stat-label">总浮盈亏</div>
        </div></el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom: 20px">
      <!-- 多空比饼图 -->
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><strong>多空分布</strong></template>
          <v-chart v-if="positions.length" :option="pieOption" style="height: 260px" autoresize />
          <el-empty v-else description="无持仓数据" />
        </el-card>
      </el-col>
      <!-- 浮盈亏排行 -->
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><strong>浮盈亏排行</strong></template>
          <v-chart v-if="positions.length" :option="uplBarOption" style="height: 260px" autoresize />
          <el-empty v-else description="无数据" />
        </el-card>
      </el-col>
      <!-- 仓位集中度 -->
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><strong>仓位集中度</strong></template>
          <v-chart v-if="positions.length" :option="concentrationOption" style="height: 260px" autoresize />
          <el-empty v-else description="无数据" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 持仓详情表 -->
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <strong>当前所有持仓</strong>
          <el-input v-model="search" placeholder="搜索币种..." style="width: 200px" clearable size="small" />
        </div>
      </template>
      <el-table :data="filteredPositions" stripe size="small" max-height="600">
        <el-table-column prop="nick_name" label="交易员" width="130" />
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
        <el-table-column label="杠杆" width="70" sortable prop="lever">
          <template #default="{ row }">{{ row.lever }}x</template>
        </el-table-column>
        <el-table-column label="名义价值" width="130" sortable prop="notional_usd">
          <template #default="{ row }">{{ fmtUSD(row.notional_usd) }}</template>
        </el-table-column>
        <el-table-column label="浮盈亏" sortable prop="upl">
          <template #default="{ row }">
            <span :class="Number(row.upl) >= 0 ? 'profit' : 'loss'">{{ fmtUSD(row.upl) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="仓位强度" width="100">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(100, Number(row.intensity || 0))"
              :color="Number(row.intensity) > 100 ? '#f56c6c' : '#409eff'"
              :show-text="false"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { PieChart, BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { fetchLatestPositions } from "../api/index.js";

use([CanvasRenderer, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent]);

const positions = ref([]);
const search = ref("");

function fmtUSD(n) {
  const v = Number(n);
  if (!isFinite(v)) return "N/A";
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v / 1e4).toFixed(2)}万`;
  return `$${v.toFixed(2)}`;
}

const filteredPositions = computed(() => {
  if (!search.value) return positions.value;
  const kw = search.value.toLowerCase();
  return positions.value.filter(
    (p) => p.inst_id?.toLowerCase().includes(kw) || p.nick_name?.toLowerCase().includes(kw)
  );
});

const longCount = computed(() => positions.value.filter((p) => p.direction === "long").length);
const shortCount = computed(() => positions.value.filter((p) => p.direction === "short").length);
const totalUpl = computed(() => positions.value.reduce((s, p) => s + Number(p.upl || 0), 0));

// 多空饼图
const pieOption = computed(() => ({
  tooltip: { trigger: "item" },
  legend: { bottom: 0 },
  series: [{
    type: "pie",
    radius: ["45%", "70%"],
    data: [
      { name: "多头", value: longCount.value, itemStyle: { color: "#67c23a" } },
      { name: "空头", value: shortCount.value, itemStyle: { color: "#f56c6c" } },
    ],
    label: { formatter: "{b}: {c}笔 ({d}%)" },
  }],
}));

// 浮盈亏排行
const uplBarOption = computed(() => ({
  tooltip: { trigger: "axis" },
  grid: { left: 120, right: 20, top: 10, bottom: 20 },
  xAxis: { type: "value", axisLabel: { formatter: (v) => { if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(0) + "万"; return v.toFixed(0); } } },
  yAxis: {
    type: "category",
    data: [...positions.value]
      .sort((a, b) => Number(b.upl) - Number(a.upl))
      .slice(0, 10)
      .map((p) => p.inst_id + " (" + p.nick_name + ")")
      .reverse(),
  },
  series: [{
    type: "bar",
    data: [...positions.value]
      .sort((a, b) => Number(b.upl) - Number(a.upl))
      .slice(0, 10)
      .map((p) => Number(p.upl))
      .reverse(),
    itemStyle: { color: (p) => p.value >= 0 ? "#67c23a" : "#f56c6c" },
  }],
}));

// 仓位集中度 (各币种名义价值汇总)
const concentrationOption = computed(() => {
  const coinMap = {};
  for (const p of positions.value) {
    const coin = p.inst_id || "unknown";
    coinMap[coin] = (coinMap[coin] || 0) + Number(p.notional_usd || 0);
  }
  const data = Object.entries(coinMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  return {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    series: [{
      type: "pie",
      radius: ["40%", "70%"],
      data: data.map(([name, value]) => ({ name, value })),
      label: { formatter: "{b}\n{d}%" },
    }],
  };
});

onMounted(async () => {
  try {
    const { data } = await fetchLatestPositions();
    positions.value = data || [];
  } catch (err) {
    console.error("加载持仓失败:", err);
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
