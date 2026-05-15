<template>
  <div>
    <div class="page-header__meta" style="margin-bottom:12px">
      <span class="page-header__badge">Stream_Live</span>
      <span class="text-data-sm" style="color:var(--color-on-surface-variant)">{{ positions.length }} Active Positions</span>
    </div>

    <!-- 摘要 -->
    <div class="page-section">
      <el-row :gutter="12">
        <el-col :xs="12" :sm="12" :md="6">
          <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
            <div class="stat-value">{{ positions.length }}</div>
            <div class="stat-label">TOTAL</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
            <div class="stat-value value-positive">{{ longCount }}</div>
            <div class="stat-label">LONG</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
            <div class="stat-value value-negative">{{ shortCount }}</div>
            <div class="stat-label">SHORT</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
            <div class="stat-value" :class="totalUpl >= 0 ? 'value-positive' : 'value-negative'">{{ fmtUSD(totalUpl) }}</div>
            <div class="stat-label">UPL</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- 图表行 -->
    <el-row :gutter="12" class="page-section">
      <el-col :xs="24" :md="8">
        <el-card>
          <template #header><strong>LONG_SHORT_RATIO</strong></template>
          <v-chart v-if="positions.length" :option="pieOption" style="height: 260px" autoresize />
          <el-empty v-else description="NO_DATA" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card>
          <template #header><strong>UPL_RANKING</strong></template>
          <v-chart v-if="positions.length" :option="uplBarOption" style="height: 260px" autoresize />
          <el-empty v-else description="NO_DATA" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card>
          <template #header><strong>CONCENTRATION</strong></template>
          <v-chart v-if="positions.length" :option="concentrationOption" style="height: 260px" autoresize />
          <el-empty v-else description="NO_DATA" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 持仓表 -->
    <el-card>
      <template #header>
        <div class="card-header-row">
          <strong>ACTIVE_POSITIONS</strong>
          <el-input v-model="search" placeholder="SEARCH_SYMBOL..." style="width: 220px" clearable size="small" />
        </div>
      </template>
      <el-table :data="filteredPositions" stripe size="small" max-height="600">
        <el-table-column prop="nick_name" label="TRADER" width="130" />
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
        <el-table-column label="LEV" width="70" sortable prop="lever">
          <template #default="{ row }">{{ row.lever }}x</template>
        </el-table-column>
        <el-table-column label="NOTIONAL" width="130" sortable prop="notional_usd">
          <template #default="{ row }">{{ fmtUSD(row.notional_usd) }}</template>
        </el-table-column>
        <el-table-column label="UPL" sortable prop="upl">
          <template #default="{ row }">
            <span :class="Number(row.upl) >= 0 ? 'value-positive' : 'value-negative'">{{ fmtUSD(row.upl) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="INTENSITY" width="100">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(100, Number(row.intensity || 0))"
              :color="Number(row.intensity) > 100 ? '#ffb4ab' : '#00f2ff'"
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
  if (Math.abs(v) >= 1e6) return `$${(v/1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e4) return `$${(v/1e4).toFixed(2)}W`;
  return `$${v.toFixed(2)}`;
}

const filteredPositions = computed(() => {
  if (!search.value) return positions.value;
  const kw = search.value.toLowerCase();
  return positions.value.filter(p => p.inst_id?.toLowerCase().includes(kw) || p.nick_name?.toLowerCase().includes(kw));
});
const longCount = computed(() => positions.value.filter(p => p.direction==="long").length);
const shortCount = computed(() => positions.value.filter(p => p.direction==="short").length);
const totalUpl = computed(() => positions.value.reduce((s,p) => s + Number(p.upl||0), 0));

const C = ['#00f2ff','#dab9ff','#74f5ff','#8f03ff','#00dbe7','#b9cacb','#849495','#3a494b'];

const pieOption = computed(() => ({
  tooltip: { trigger: "item" },
  legend: { bottom: 0, textStyle: { color: '#b9cacb' } },
  series: [{
    type: "pie", radius: ["45%","70%"],
    data: [
      { name: "LONG", value: longCount.value, itemStyle: { color: '#00f2ff' } },
      { name: "SHORT", value: shortCount.value, itemStyle: { color: '#ffb4ab' } },
    ],
    label: { formatter: "{b}:{c} ({d}%)", color: '#b9cacb' },
  }],
}));

const uplBarOption = computed(() => ({
  tooltip: { trigger: "axis" },
  grid: { left: 120, right: 20, top: 10, bottom: 20 },
  xAxis: { type: "value", axisLabel: { color:'#849495', formatter: (v) => Math.abs(v)>=1e4 ? (v/1e4).toFixed(0)+'W' : v.toFixed(0) } },
  yAxis: {
    type: "category",
    axisLabel: { color: '#849495' },
    data: [...positions.value].sort((a,b) => Number(b.upl)-Number(a.upl)).slice(0,10).map(p => p.inst_id+" ("+p.nick_name+")").reverse(),
  },
  series: [{
    type: "bar",
    data: [...positions.value].sort((a,b) => Number(b.upl)-Number(a.upl)).slice(0,10).map(p => Number(p.upl)).reverse(),
    itemStyle: { color: (p) => p.value >= 0 ? '#00f2ff' : '#ffb4ab' },
  }],
}));

const concentrationOption = computed(() => {
  const coinMap = {};
  for (const p of positions.value) { const coin = p.inst_id||"unknown"; coinMap[coin] = (coinMap[coin]||0) + Number(p.notional_usd||0); }
  const data = Object.entries(coinMap).sort((a,b) => b[1]-a[1]).slice(0,10);
  return {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    series: [{
      type: "pie", radius: ["40%","70%"],
      data: data.map(([name,value],i) => ({ name, value, itemStyle: { color: C[i%C.length] } })),
      label: { formatter: "{b}\n{d}%", color: '#b9cacb' },
    }],
  };
});

onMounted(async () => {
  try { const { data } = await fetchLatestPositions(); positions.value = data || []; }
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
