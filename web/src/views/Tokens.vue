<template>
  <div>
    <!-- 定时任务 -->
    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <strong>定时任务配置</strong>
              <el-tag size="small" type="primary">运行中</el-tag>
            </div>
          </template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="交易员监控">
              <el-tag size="small">{{ scheduleText }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="时区">
              {{ statusData?.schedule?.timezone || 'Asia/Shanghai' }}
            </el-descriptions-item>
            <el-descriptions-item label="代币价格监控">
              每 {{ (statusData?.config?.intervalMs || 60000) / 1000 }} 秒轮询
            </el-descriptions-item>
            <el-descriptions-item label="告警阈值">
              涨幅 ≥ {{ statusData?.config?.alertPct ?? 4 }}%
            </el-descriptions-item>
            <el-descriptions-item label="上次检查">
              {{ statusData?.lastCheckTime ? fmtTime(statusData.lastCheckTime) : '等待首次检查...' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <strong>监控概览</strong>
              <el-button type="primary" size="small" @click="refresh">刷新</el-button>
            </div>
          </template>
          <el-row :gutter="12">
            <el-col :span="12">
              <div class="stat-card">
                <div class="stat-value">{{ tokens.length }}</div>
                <div class="stat-label">监控代币数</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="stat-card">
                <div class="stat-value">{{ alertCount }}</div>
                <div class="stat-label">本次会话告警次数</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <!-- 代币列表 -->
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <strong>监控代币列表</strong>
          <el-button type="primary" size="small" @click="showAddDialog = true">+ 添加代币</el-button>
        </div>
      </template>
      <el-table :data="tokens" stripe v-loading="loading" empty-text="暂无监控代币，点击右上角添加">
        <el-table-column prop="label" label="名称" width="120" />
        <el-table-column prop="instId" label="交易对" width="180" />
        <el-table-column label="基准价" width="140">
          <template #default="{ row }">
            {{ row.baseline ? fmtNum(row.baseline, 4) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="最新价" width="140">
          <template #default="{ row }">
            <span v-if="row.currentPrice" :class="row.currentPrice >= row.baseline ? 'profit' : 'loss'">
              {{ fmtNum(row.currentPrice, 4) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="涨跌幅" width="120">
          <template #default="{ row }">
            <span v-if="row.baseline && row.currentPrice" :class="changeClass(row)">
              {{ changePct(row) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.baseline && row.currentPrice && pctVal(row) >= threshold" type="danger" size="small">
              已触发告警
            </el-tag>
            <el-tag v-else-if="row.baseline" type="success" size="small">监控中</el-tag>
            <el-tag v-else type="info" size="small">等待基线</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="danger" size="small" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加代币弹窗 -->
    <el-dialog v-model="showAddDialog" title="添加监控代币" width="420px">
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="交易对">
          <el-input v-model="addForm.instId" placeholder="如 BTC-USDT-SWAP" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="addForm.label" placeholder="如 BTC（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAdd" :disabled="!addForm.instId.trim()">确认添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { fetchTokens, fetchTokensStatus, addToken, deleteToken } from "../api/index.js";

const tokens = ref([]);
const statusData = ref({});
const loading = ref(false);
const showAddDialog = ref(false);
const alertCount = ref(0);
const addForm = ref({ instId: "", label: "" });

function fmtNum(n, d = 2) {
  const v = Number(n);
  return isFinite(v) ? v.toFixed(d) : "N/A";
}

const threshold = computed(() => statusData.value?.config?.alertPct ?? 4);

const scheduleText = computed(() => {
  const s = statusData.value?.schedule;
  if (!s?.cron) return "未配置";
  const parts = s.cron.split(/\s+/);
  const minutes = parts[0] || "0";
  const hours = parts[1] || "8,20";
  return `每天 ${hours.split(",").map(h => h.padStart(2, "0")).join("、")}:${minutes.padStart(2, "0")} (cron: ${s.cron})`;
});

function pctVal(row) {
  if (!row.baseline || !row.currentPrice || row.baseline === 0) return 0;
  return ((row.currentPrice - row.baseline) / row.baseline) * 100;
}

function changePct(row) {
  const v = pctVal(row);
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function changeClass(row) {
  return pctVal(row) >= 0 ? "profit" : "loss";
}

function fmtTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

async function refresh() {
  loading.value = true;
  try {
    const [tokensRes, statusRes] = await Promise.all([
      fetchTokens(),
      fetchTokensStatus(),
    ]);
    if (tokensRes.code === 0) {
      tokens.value = tokensRes.data.tokens || [];
    }
    if (statusRes.code === 0) {
      statusData.value = statusRes.data;
    }
  } catch (err) {
    console.error("加载失败:", err);
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  const instId = addForm.value.instId.trim();
  if (!instId) return;
  try {
    const res = await addToken(instId, addForm.value.label.trim() || instId);
    if (res.code === 0) {
      ElMessage.success("添加成功");
      showAddDialog.value = false;
      addForm.value = { instId: "", label: "" };
      await refresh();
    } else {
      ElMessage.warning(res.msg);
    }
  } catch (err) {
    ElMessage.error("添加失败: " + err.message);
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确认移除 ${row.label || row.instId}？`, "确认删除", { type: "warning" });
  } catch {
    return;
  }
  try {
    const res = await deleteToken(row.instId);
    if (res.code === 0) {
      ElMessage.success("已移除");
      await refresh();
    }
  } catch (err) {
    ElMessage.error("删除失败: " + err.message);
  }
}

let timer = null;
onMounted(() => {
  refresh();
  timer = setInterval(refresh, 10000); // 10 秒自动刷新
});
onUnmounted(() => {
  clearInterval(timer);
});
</script>

<style scoped>
.stat-card { text-align: center; padding: 12px 0; }
.stat-value { font-size: 28px; font-weight: bold; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 6px; }
.profit { color: #22c55e; font-weight: 600; }
.loss { color: #ef4444; font-weight: 600; }
</style>
