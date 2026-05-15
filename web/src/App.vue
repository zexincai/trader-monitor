<template>
  <div class="app-shell">
    <!-- Grid Background -->
    <div class="grid-bg"></div>

    <!-- Top Header -->
    <header class="app-header">
      <div class="app-header__inner">
        <div class="app-header__left">
          <span class="app-brand">NEON_TERMINAL</span>
          <nav class="app-header__nav">
            <router-link
              v-for="item in topNavItems"
              :key="item.path"
              :to="item.path"
              class="app-header__nav-link"
              :class="{ 'app-header__nav-link--active': currentRoute === item.path }"
            >
              {{ item.label }}
            </router-link>
          </nav>
        </div>
        <div class="app-header__right">
          <button class="app-header__ai-btn" @click="goAiAnalysis">
            <span class="material-symbols-outlined">psychology</span>
            AI Analysis
          </button>
          <div class="app-header__actions">
            <span class="material-symbols-outlined app-header__icon" @click="handleRefresh">refresh</span>
            <span class="material-symbols-outlined app-header__icon">notifications</span>
            <span class="material-symbols-outlined app-header__icon">settings</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Left Sidebar -->
    <aside class="app-sidebar">
      <!-- Operator Profile -->
      <div class="app-sidebar__profile">
        <div class="app-sidebar__profile-card">
          <div class="app-sidebar__avatar">OP</div>
          <div>
            <p class="app-sidebar__name glow-secondary">OPERATOR_01</p>
            <p class="app-sidebar__status">
              <span class="live-dot"></span>
              System Active
            </p>
          </div>
        </div>
      </div>

      <!-- Nav Links -->
      <nav class="app-sidebar__nav">
        <router-link
          v-for="item in sidebarNavItems"
          :key="item.path"
          :to="item.path"
          class="app-sidebar__link"
          :class="{ 'app-sidebar__link--active': currentRoute === item.path }"
        >
          <span class="material-symbols-outlined">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- Bottom Action -->
      <div class="app-sidebar__footer">
        <button class="app-sidebar__upgrade-btn">
          UPGRADE NODE
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="app-main">
      <router-view />
    </main>

    <nav class="app-mobile-nav">
      <router-link
        v-for="item in sidebarNavItems"
        :key="item.path"
        :to="item.path"
        class="app-mobile-nav__link"
        :class="{ 'app-mobile-nav__link--active': currentRoute === item.path }"
      >
        <span class="material-symbols-outlined">{{ item.icon }}</span>
        <span>{{ item.shortLabel }}</span>
      </router-link>
    </nav>

    <!-- Daily Report Modal -->
    <DailyReportModal :visible="showReportModal" @close="showReportModal = false" />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import DailyReportModal from "./components/DailyReportModal.vue";

const route = useRoute();
const router = useRouter();
const currentRoute = computed(() => route.path);
const showReportModal = ref(false);

const topNavItems = [
  { path: "/", label: "资讯" },
  { path: "/dashboard", label: "总览" },
  { path: "/positions", label: "持仓" },
  { path: "/discover", label: "交易员" },
  { path: "/tokens", label: "代币监控" },
  { path: "/settings", label: "设置" },
];

const sidebarNavItems = [
  { path: "/", label: "资讯", shortLabel: "资讯", icon: "show_chart" },
  { path: "/dashboard", label: "总览", shortLabel: "总览", icon: "account_balance" },
  { path: "/positions", label: "持仓监控", shortLabel: "持仓", icon: "account_balance_wallet" },
  { path: "/discover", label: "发现交易员", shortLabel: "交易员", icon: "group" },
  { path: "/tokens", label: "代币监控", shortLabel: "代币", icon: "terminal" },
  { path: "/settings", label: "设置", shortLabel: "设置", icon: "settings" },
];

function handleRefresh() {
  window.location.reload();
}

function goAiAnalysis() {
  showReportModal.value = true;
}
</script>

<style scoped>
/* 鈹€鈹€ Shell 鈹€鈹€ */
.app-shell {
  min-height: 100vh;
  position: relative;
}

/* 鈹€鈹€ Header 鈹€鈹€ */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: var(--header-height);
  background: rgba(25, 28, 34, 0.7);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(58, 73, 75, 0.3);
  box-shadow: 0 0 15px rgba(0, 242, 255, 0.2);
}

.app-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 var(--space-margin-desktop);
  max-width: 100%;
}

.app-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-margin-desktop);
}

/* 鈹€鈹€ Brand 鈹€鈹€ */
.app-brand {
  font-family: var(--font-heading);
  font-size: var(--text-data-lg-size);
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.02em;
  text-shadow: var(--glow-primary);
  white-space: nowrap;
}

/* 鈹€鈹€ Header Nav 鈹€鈹€ */
.app-header__nav {
  display: none;
  gap: var(--space-comfortable);
}

@media (min-width: 768px) {
  .app-header__nav {
    display: flex;
  }
}

.app-header__nav-link {
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: var(--text-label-caps-spacing);
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
  text-decoration: none;
  padding-bottom: 2px;
  border-bottom: 2px solid transparent;
  transition: all var(--transition-base);
}

.app-header__nav-link:hover {
  color: var(--color-primary-container);
}

.app-header__nav-link--active {
  color: var(--color-primary-container);
  border-bottom-color: var(--color-primary-container);
  text-shadow: var(--glow-primary);
}

/* 鈹€鈹€ Header Right 鈹€鈹€ */
.app-header__right {
  display: flex;
  align-items: center;
  gap: var(--space-comfortable);
}

/* 鈹€鈹€ AI Button 鈹€鈹€ */
.app-header__ai-btn {
  display: none;
  align-items: center;
  gap: 6px;
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
  border: none;
  padding: 6px 16px;
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: var(--radius-default);
  box-shadow: var(--glow-button-primary);
  transition: all var(--transition-fast);
}

@media (min-width: 1024px) {
  .app-header__ai-btn {
    display: flex;
  }
}

.app-header__ai-btn:hover {
  box-shadow: var(--glow-button-primary-hover);
}

.app-header__ai-btn:active {
  transform: scale(0.95);
}

.app-header__ai-btn .material-symbols-outlined {
  font-size: 18px;
}

/* 鈹€鈹€ Action Icons 鈹€鈹€ */
.app-header__actions {
  display: flex;
  gap: var(--space-compact);
  color: var(--color-on-surface-variant);
}

.app-header__icon {
  cursor: pointer;
  font-size: 20px;
  transition: all var(--transition-fast);
}

.app-header__icon:hover {
  color: var(--color-primary-container);
  filter: drop-shadow(0 0 8px rgba(0, 242, 255, 0.8));
}

/* 鈹€鈹€ Sidebar 鈹€鈹€ */
.app-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--sidebar-width);
  z-index: 40;
  background: rgba(11, 14, 20, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-right: 1px solid rgba(58, 73, 75, 0.2);
  padding-top: var(--header-height);
  display: flex;
  flex-direction: column;
}

@media (max-width: 767px) {
  .app-sidebar {
    display: none;
  }
}

/* 鈹€鈹€ Sidebar Profile 鈹€鈹€ */
.app-sidebar__profile {
  padding: var(--space-comfortable);
  margin-bottom: var(--space-compact);
}

.app-sidebar__profile-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(50, 53, 60, 0.2);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition: border-color var(--transition-base);
}

.app-sidebar__profile-card:hover {
  border-color: rgba(218, 185, 255, 0.3);
}

.app-sidebar__avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-secondary);
  background: rgba(143, 3, 255, 0.15);
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-secondary);
  box-shadow: 0 0 10px rgba(218, 185, 255, 0.3);
  flex-shrink: 0;
}

.app-sidebar__name {
  font-family: var(--font-heading);
  font-size: var(--text-headline-md-size);
  line-height: 1;
  color: var(--color-secondary);
  text-shadow: var(--glow-secondary);
}

.app-sidebar__status {
  font-family: var(--font-mono);
  font-size: var(--text-data-sm-size);
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

/* 鈹€鈹€ Sidebar Nav 鈹€鈹€ */
.app-sidebar__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.app-sidebar__link {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  color: var(--color-on-surface-variant);
  text-decoration: none;
  font-family: var(--font-body);
  font-size: var(--text-body-size);
  transition: all 0.3s ease;
}

.app-sidebar__link:hover {
  background: rgba(50, 53, 60, 0.1);
  color: var(--color-primary-fixed-dim);
  transform: translateX(4px);
}

.app-sidebar__link--active {
  background: rgba(143, 3, 255, 0.1);
  color: var(--color-secondary);
  border-right: 2px solid var(--color-secondary);
  font-weight: 700;
  text-shadow: var(--glow-secondary);
}

.app-sidebar__link .material-symbols-outlined {
  font-size: 20px;
}

/* 鈹€鈹€ Sidebar Footer 鈹€鈹€ */
.app-sidebar__footer {
  padding: var(--space-comfortable);
}

.app-sidebar__upgrade-btn {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-secondary);
  background: transparent;
  color: var(--color-secondary);
  font-family: var(--font-body);
  font-size: var(--text-label-caps-size);
  font-weight: var(--text-label-caps-weight);
  letter-spacing: var(--text-label-caps-spacing);
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.app-sidebar__upgrade-btn:hover {
  background: rgba(218, 185, 255, 0.1);
  box-shadow: 0 0 15px rgba(218, 185, 255, 0.4);
}

/* 鈹€鈹€ Main Content 鈹€鈹€ */
.app-main {
  padding-top: var(--header-height);
  padding-left: var(--space-margin-desktop);
  padding-right: var(--space-margin-desktop);
  padding-bottom: 40px;
  min-height: 100vh;
}

@media (min-width: 768px) {
  .app-main {
    padding-left: calc(var(--sidebar-width) + var(--space-margin-desktop));
  }
}

/* 鈹€鈹€ Responsive 鈹€鈹€ */
@media (max-width: 767px) {
  .app-header__inner {
    padding: 0 var(--space-margin-mobile);
  }
  .app-main {
    padding-left: var(--space-margin-mobile);
    padding-right: var(--space-margin-mobile);
  }
}
.app-mobile-nav {
  display: none;
}

@media (max-width: 767px) {
  .app-shell {
    --header-height: 56px;
  }
  .app-header__left {
    min-width: 0;
    gap: 12px;
  }
  .app-brand {
    max-width: 48vw;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .app-header__right,
  .app-header__actions {
    gap: 8px;
  }
  .app-header__icon {
    font-size: 19px;
  }
  .app-main {
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
  }
  .app-mobile-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 60;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    min-height: calc(64px + env(safe-area-inset-bottom));
    padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
    background: rgba(11, 14, 20, 0.92);
    border-top: 1px solid rgba(58, 73, 75, 0.35);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }
  .app-mobile-nav__link {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: var(--color-on-surface-variant);
    text-decoration: none;
    font-family: var(--font-body);
    font-size: 10px;
    line-height: 1.1;
    text-align: center;
    overflow: hidden;
  }
  .app-mobile-nav__link .material-symbols-outlined {
    font-size: 20px;
  }
  .app-mobile-nav__link span:last-child {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .app-mobile-nav__link--active {
    color: var(--color-primary-container);
    text-shadow: var(--glow-primary);
  }
}
</style>
