<template>
  <div>
    <div class="page-header__meta" style="margin-bottom:12px">
      <span class="page-header__badge">SYSTEM_CONFIG</span>
      <span class="text-data-sm" style="color:var(--color-on-surface-variant)">Configuration Panel</span>
    </div>

    <el-tabs v-model="activeTab" type="border-card" class="page-section">
      <!-- 飞书通知 -->
      <el-tab-pane label="FEISHU" name="feishu">
        <el-form :model="form.feishu" label-width="140px" label-position="left">
          <el-form-item label="WEBHOOK_URL">
            <el-input v-model="form.feishu.webhookUrl" placeholder="飞书机器人 webhook 地址" show-password />
          </el-form-item>
          <el-form-item label="SIGN_SECRET">
            <el-input v-model="form.feishu.secret" placeholder="飞书签名校验密钥（可选）" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSection('feishu')">SAVE</el-button>
            <el-button @click="testFeishu" :loading="testingFeishu">TEST_SEND</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 定时任务 -->
      <el-tab-pane label="SCHEDULER" name="schedule">
        <el-form :model="form.schedule" label-width="140px" label-position="left">
          <el-form-item label="CRON_EXPR">
            <el-input v-model="form.schedule.cron" placeholder="0 8,20 * * *" />
            <div class="form-hint">Format: MIN HOUR DOM MON DOW. E.g. 0 8,20 * * * = Daily 8:00 &amp; 20:00</div>
          </el-form-item>
          <el-form-item label="TIMEZONE">
            <el-select v-model="form.schedule.timezone" placeholder="选择时区">
              <el-option label="Asia/Shanghai" value="Asia/Shanghai" />
              <el-option label="Asia/Tokyo" value="Asia/Tokyo" />
              <el-option label="Asia/Seoul" value="Asia/Seoul" />
              <el-option label="Asia/Singapore" value="Asia/Singapore" />
              <el-option label="America/New_York" value="America/New_York" />
              <el-option label="Europe/London" value="Europe/London" />
              <el-option label="UTC" value="UTC" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSection('schedule')">SAVE</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 代币监控 -->
      <el-tab-pane label="TOKEN_MONITOR" name="tokenMonitor">
        <el-form :model="form.tokenMonitor" label-width="140px" label-position="left">
          <el-form-item label="ENABLED">
            <el-switch v-model="form.tokenMonitor.enabled" />
          </el-form-item>
          <el-form-item label="INTERVAL_MS">
            <el-input-number v-model="form.tokenMonitor.intervalMs" :min="5000" :max="3600000" :step="10000" />
            <span class="form-hint-inline">Min 5s, Max 1h</span>
          </el-form-item>
          <el-form-item label="ALERT_PCT(%)">
            <el-input-number v-model="form.tokenMonitor.alertPct" :min="0.1" :max="100" :step="0.5" :precision="1" />
            <span class="form-hint-inline">Alert when price change exceeds this %</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSection('tokenMonitor')">SAVE</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- AI 分析 -->
      <el-tab-pane label="AI_ENGINE" name="deepseek">
        <el-form :model="form.deepseek" label-width="140px" label-position="left">
          <el-form-item label="API_KEY">
            <el-input v-model="form.deepseek.apiKey" placeholder="DeepSeek API Key" show-password />
          </el-form-item>
          <el-form-item label="MODEL">
            <el-select v-model="form.deepseek.model" placeholder="选择模型">
              <el-option label="deepseek-chat" value="deepseek-chat" />
              <el-option label="deepseek-reasoner" value="deepseek-reasoner" />
            </el-select>
          </el-form-item>
          <el-form-item label="TEMPERATURE">
            <el-input-number v-model="form.deepseek.temperature" :min="0" :max="2" :step="0.1" :precision="1" />
            <span class="form-hint-inline">0~2, higher = more random</span>
          </el-form-item>
          <el-form-item label="MAX_TOKENS">
            <el-input-number v-model="form.deepseek.maxTokens" :min="100" :max="8000" :step="100" />
            <span class="form-hint-inline">Max output tokens</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSection('deepseek')">SAVE</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 报告设置 -->
      <el-tab-pane label="REPORTS" name="report">
        <el-form :model="form.report" label-width="140px" label-position="left">
          <el-form-item label="OUTPUT_DIR">
            <el-input v-model="form.report.outputDir" placeholder="./reports" />
          </el-form-item>
          <el-form-item label="KEEP_DAYS">
            <el-input-number v-model="form.report.keepDays" :min="1" :max="365" :step="1" />
            <span class="form-hint-inline">Auto-delete reports older than this</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSection('report')">SAVE</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { fetchSettings, updateSettings, testFeishu as apiTestFeishu } from "../api/index.js";

const activeTab = ref("feishu");
const testingFeishu = ref(false);

const form = reactive({
  feishu: { webhookUrl: "", secret: "" },
  schedule: { cron: "0 8,20 * * *", timezone: "Asia/Shanghai" },
  tokenMonitor: { intervalMs: 60000, alertPct: 4, enabled: true },
  deepseek: { apiKey: "", model: "deepseek-chat", temperature: 0.3, maxTokens: 2000 },
  report: { outputDir: "./reports", keepDays: 30 },
});

async function loadSettings() {
  try {
    const res = await fetchSettings();
    if (res.code === 0) {
      Object.assign(form.feishu, res.data.feishu);
      Object.assign(form.schedule, res.data.schedule);
      Object.assign(form.tokenMonitor, res.data.tokenMonitor);
      Object.assign(form.deepseek, res.data.deepseek);
      Object.assign(form.report, res.data.report);
    }
  } catch (err) {
    ElMessage.error("LOAD_FAILED: " + err.message);
  }
}

async function saveSection(section) {
  try {
    const res = await updateSettings(section, form[section]);
    if (res.code === 0) {
      ElMessage.success(`${section.toUpperCase()}_SAVED`);
      loadSettings();
    } else {
      ElMessage.error(res.msg || "SAVE_FAILED");
    }
  } catch (err) {
    ElMessage.error("SAVE_FAILED: " + err.message);
  }
}

async function testFeishu() {
  testingFeishu.value = true;
  try {
    const res = await apiTestFeishu();
    if (res.code === 0) {
      ElMessage.success("TEST_MSG_SENT");
    } else {
      ElMessage.error(res.msg || "SEND_FAILED");
    }
  } catch (err) {
    ElMessage.error("TEST_FAILED: " + err.message);
  } finally {
    testingFeishu.value = false;
  }
}

onMounted(loadSettings);
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
.form-hint {
  color: var(--color-outline);
  font-size: var(--text-data-sm-size);
  font-family: var(--font-mono);
  margin-top: 4px;
}
.form-hint-inline {
  color: var(--color-outline);
  font-size: var(--text-data-sm-size);
  font-family: var(--font-mono);
  margin-left: 8px;
}
</style>
