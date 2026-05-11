<template>
  <div>
    <el-breadcrumb style="margin-bottom: 16px">
      <el-breadcrumb-item :to="{ path: '/dashboard' }">总览</el-breadcrumb-item>
      <el-breadcrumb-item>发现交易员</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 筛选区域 -->
    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header><strong>筛选条件</strong></template>
      <el-form :inline="true" :model="filters" size="default">
        <el-form-item label="最低胜率">
          <el-input-number v-model="filters.winRatio" :min="0" :max="1" :step="0.05" :precision="2" placeholder="0.80" style="width: 130px" />
        </el-form-item>
        <el-form-item label="最大回撤">
          <el-input-number v-model="filters.maxRetreat" :min="0" :max="1" :step="0.01" :precision="2" placeholder="0.10" style="width: 130px" />
        </el-form-item>
        <el-form-item label="周期(天)">
          <el-select v-model="filters.period" style="width: 100px">
            <el-option label="3天" value="3" />
            <el-option label="7天" value="7" />
            <el-option label="30天" value="30" />
            <el-option label="90天" value="90" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-select v-model="filters.sortType" style="width: 120px">
            <el-option label="按盈亏" value="pnl" />
            <el-option label="按收益率" value="pnlRatio" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number v-model="filters.limit" :min="5" :max="100" style="width: 100px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="doSearch" :loading="loading">
            <el-icon style="margin-right: 4px"><Search /></el-icon>搜索
          </el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 快速筛选 -->
      <div style="margin-top: 8px">
        <span style="color: #909399; font-size: 13px; margin-right: 8px">快速筛选：</span>
        <el-tag v-for="preset in presets" :key="preset.label" style="cursor: pointer; margin-right: 8px"
          :type="presetActive === preset.label ? 'primary' : 'info'"
          @click="applyPreset(preset)">
          {{ preset.label }}
        </el-tag>
      </div>
    </el-card>

    <!-- 搜索结果 -->
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <strong>搜索结果 ({{ traders.length }})</strong>
          <span style="font-size: 13px; color: #909399">
            已监控：{{ traders.filter(t => t.monitored).length }} / {{ traders.length }}
          </span>
        </div>
      </template>

      <el-table :data="traders" stripe max-height="600" v-loading="loading" size="small">
        <el-table-column label="状态" width="70">
          <template #default="{ row }">
            <el-tag v-if="row.monitored" type="success" size="small">已监控</el-tag>
            <el-tag v-else type="info" size="small">未监控</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="nickName" label="昵称" width="140" />
        <el-table-column prop="authorId" label="ID" width="180" show-overflow-tooltip />
        <el-table-column label="30天盈亏" sortable prop="pnl" width="120">
          <template #default="{ row }">
            <span :class="Number(row.pnl) >= 0 ? 'profit' : 'loss'">{{ fmtUSD(row.pnl) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="收益率" sortable prop="pnlRatio" width="100">
          <template #default="{ row }">{{ fmtPct(row.pnlRatio) }}</template>
        </el-table-column>
        <el-table-column label="胜率" sortable prop="winRatio" width="90">
          <template #default="{ row }">{{ fmtPct(row.winRatio || row.winRate) }}</template>
        </el-table-column>
        <el-table-column label="最大回撤" sortable prop="maxDrawdown" width="100">
          <template #default="{ row }">{{ fmtPct(row.maxDrawdown || row.maxRetreat) }}</template>
        </el-table-column>
        <el-table-column label="AUM" sortable prop="asset" width="120">
          <template #default="{ row }">{{ fmtUSD(row.asset) }}</template>
        </el-table-column>
        <el-table-column label="在榜天数" sortable prop="onboardDuration" width="90" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.monitored" type="primary" size="small" :loading="row._adding" @click="addTrader(row)">
              添加到监控
            </el-button>
            <el-button v-else type="danger" size="small" plain :loading="row._removing" @click="removeTrader(row)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && traders.length === 0" description="点击「搜索」发现交易员" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import api from "../api/index.js";

const filters = reactive({
  winRatio: 0.8,
  maxRetreat: 0.1,
  period: "30",
  sortType: "pnl",
  limit: 20,
});

const presets = [
  { label: "高胜率低回撤", winRatio: 0.85, maxRetreat: 0.08, period: "30", sortType: "pnl" },
  { label: "近期收益王", winRatio: null, maxRetreat: null, period: "7", sortType: "pnl" },
  { label: "长线赢家", winRatio: 0.7, maxRetreat: 0.15, period: "90", sortType: "pnlRatio" },
  { label: "超高收益", winRatio: null, maxRetreat: null, period: "30", sortType: "pnlRatio" },
];

const presetActive = ref("");
const traders = ref([]);
const loading = ref(false);

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

function applyPreset(preset) {
  presetActive.value = preset.label;
  filters.winRatio = preset.winRatio;
  filters.maxRetreat = preset.maxRetreat;
  filters.period = preset.period;
  filters.sortType = preset.sortType;
  doSearch();
}

function resetFilters() {
  presetActive.value = "";
  filters.winRatio = 0.8;
  filters.maxRetreat = 0.1;
  filters.period = "30";
  filters.sortType = "pnl";
  filters.limit = 20;
  traders.value = [];
}

async function doSearch() {
  loading.value = true;
  try {
    const params = {
      period: filters.period,
      sortType: filters.sortType,
      limit: String(filters.limit),
    };
    if (filters.winRatio != null) params.winRatio = String(filters.winRatio);
    if (filters.maxRetreat != null) params.maxRetreat = String(filters.maxRetreat);

    const res = await api.get("/traders/discover", { params });
    const list = res.data?.data || [];
    traders.value = list.map((t) => ({ ...t, _adding: false, _removing: false }));
  } catch (err) {
    ElMessage.error("搜索失败：" + (err.response?.data?.msg || err.message));
  } finally {
    loading.value = false;
  }
}

async function addTrader(row) {
  row._adding = true;
  try {
    await api.post("/traders/add", {
      authorId: row.authorId,
      nickName: row.nickName,
      note: `${fmtPct(row.winRate || row.winRatio)}胜率 ${fmtPct(row.maxDrawdown || row.maxRetreat)}回撤`,
    });
    row.monitored = true;
    ElMessage.success(`${row.nickName} 已添加到监控列表`);
  } catch (err) {
    ElMessage.error("添加失败：" + (err.response?.data?.msg || err.message));
  } finally {
    row._adding = false;
  }
}

async function removeTrader(row) {
  row._removing = true;
  try {
    await api.delete(`/traders/${row.authorId}`);
    row.monitored = false;
    ElMessage.success(`${row.nickName} 已从监控列表移除`);
  } catch (err) {
    ElMessage.error("移除失败：" + (err.response?.data?.msg || err.message));
  } finally {
    row._removing = false;
  }
}
</script>

<style scoped>
.profit { color: #67c23a; font-weight: 600; }
.loss { color: #f56c6c; font-weight: 600; }
</style>
