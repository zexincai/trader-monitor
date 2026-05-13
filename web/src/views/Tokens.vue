<template>
  <div>
    <div class="page-header__meta" style="margin-bottom:12px">
      <span class="page-header__badge">TOKEN_MONITOR</span>
      <span class="text-data-sm" style="color:var(--color-on-surface-variant)">{{ tokens.length }} Tokens Tracked</span>
    </div>

    <!-- Config + Overview -->
    <el-row :gutter="12" class="page-section">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header-row">
              <strong>SCHEDULER_CONFIG</strong>
              <el-tag size="small" type="primary">ACTIVE</el-tag>
            </div>
          </template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="TRADER_SYNC">
              <el-tag size="small">{{ scheduleText }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="TIMEZONE">{{ statusData?.schedule?.timezone || 'Asia/Shanghai' }}</el-descriptions-item>
            <el-descriptions-item label="TOKEN_POLL">{{ (statusData?.config?.intervalMs || 60000) / 1000 }}s</el-descriptions-item>
            <el-descriptions-item label="ALERT_THRESHOLD">{{ statusData?.config?.alertPct ?? 4 }}%</el-descriptions-item>
            <el-descriptions-item label="LAST_CHECK">{{ statusData?.lastCheckTime ? fmtTime(statusData.lastCheckTime) : 'AWAITING...' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header-row">
              <strong>MONITOR_OVERVIEW</strong>
              <el-button type="primary" size="small" @click="refresh">REFRESH</el-button>
            </div>
          </template>
          <el-row :gutter="12">
            <el-col :span="12">
              <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
                <div class="stat-value">{{ tokens.length }}</div>
                <div class="stat-label">TOKENS</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="glass-panel glow-border" style="padding:16px;text-align:center;border:var(--glass-border-subtle)">
                <div class="stat-value value-negative">{{ alertCount }}</div>
                <div class="stat-label">ALERTS</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <!-- Token Table -->
    <el-card>
      <template #header>
        <div class="card-header-row">
          <strong>TOKEN_LIST</strong>
          <el-button type="primary" size="small" @click="showAddDialog = true">+ ADD_TOKEN</el-button>
        </div>
      </template>
      <el-table :data="tokens" stripe v-loading="loading" empty-text="NO_TOKENS">
        <el-table-column prop="label" label="NAME" width="120" />
        <el-table-column prop="instId" label="PAIR" width="180" />
        <el-table-column label="BASELINE" width="140">
          <template #default="{ row }">{{ row.baseline ? fmtNum(row.baseline, 4) : '-' }}</template>
        </el-table-column>
        <el-table-column label="MARK" width="140">
          <template #default="{ row }">
            <span v-if="row.currentPrice" :class="row.currentPrice >= row.baseline ? 'value-positive' : 'value-negative'">{{ fmtNum(row.currentPrice, 4) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="CHANGE" width="120">
          <template #default="{ row }">
            <span v-if="row.baseline && row.currentPrice" :class="pctVal(row) >= 0 ? 'value-positive' : 'value-negative'">{{ changePct(row) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="STATUS" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.baseline && row.currentPrice && pctVal(row) >= threshold" type="danger" size="small">ALERT</el-tag>
            <el-tag v-else-if="row.baseline" type="success" size="small">ACTIVE</el-tag>
            <el-tag v-else type="info" size="small">PENDING</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="ACTION" width="100">
          <template #default="{ row }">
            <el-button type="danger" size="small" link @click="handleDelete(row)">DELETE</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add Dialog -->
    <el-dialog v-model="showAddDialog" title="ADD_TOKEN">
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="PAIR">
          <el-input v-model="addForm.instId" placeholder="BTC-USDT-SWAP" />
        </el-form-item>
        <el-form-item label="NAME">
          <el-input v-model="addForm.label" placeholder="BTC (optional)" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">CANCEL</el-button>
        <el-button type="primary" @click="handleAdd" :disabled="!addForm.instId.trim()">CONFIRM</el-button>
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

function fmtNum(n, d=2) { const v = Number(n); return isFinite(v) ? v.toFixed(d) : "N/A"; }
const threshold = computed(() => statusData.value?.config?.alertPct ?? 4);
const scheduleText = computed(() => {
  const s = statusData.value?.schedule;
  if (!s?.cron) return "NOT_CONFIGURED";
  const parts = s.cron.split(/\s+/);
  return `${parts[1]}:${parts[0].padStart(2,"0")} (${s.cron})`;
});
function pctVal(row) { if (!row.baseline || !row.currentPrice || row.baseline===0) return 0; return ((row.currentPrice-row.baseline)/row.baseline)*100; }
function changePct(row) { const v = pctVal(row); return (v>=0?"+":"")+v.toFixed(2)+"%"; }
function fmtTime(iso) { if (!iso) return "-"; return new Date(iso).toLocaleString("zh-CN", { hour12: false }); }

async function refresh() {
  loading.value = true;
  try {
    const [tokensRes, statusRes] = await Promise.all([fetchTokens(), fetchTokensStatus()]);
    if (tokensRes.code === 0) tokens.value = tokensRes.data.tokens || [];
    if (statusRes.code === 0) statusData.value = statusRes.data;
  } catch (err) { console.error(err); }
  finally { loading.value = false; }
}
async function handleAdd() {
  const instId = addForm.value.instId.trim();
  if (!instId) return;
  try {
    const res = await addToken(instId, addForm.value.label.trim() || instId);
    if (res.code === 0) { ElMessage.success("ADDED"); showAddDialog.value = false; addForm.value = { instId: "", label: "" }; await refresh(); }
    else ElMessage.warning(res.msg);
  } catch (err) { ElMessage.error("FAILED: " + err.message); }
}
async function handleDelete(row) {
  try { await ElMessageBox.confirm(`REMOVE ${row.label||row.instId}?`, "CONFIRM", { type: "warning" }); }
  catch { return; }
  try { const res = await deleteToken(row.instId); if (res.code === 0) { ElMessage.success("REMOVED"); await refresh(); } }
  catch (err) { ElMessage.error("FAILED: " + err.message); }
}

let timer = null;
onMounted(() => { refresh(); timer = setInterval(refresh, 10000); });
onUnmounted(() => { clearInterval(timer); });
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
