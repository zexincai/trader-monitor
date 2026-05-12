<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__inner">
        <router-link to="/" class="app-brand">
          <span class="app-brand__text">TRADER MONITOR</span>
        </router-link>
        <nav class="app-nav">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="app-nav__link"
            :class="{ 'app-nav__link--active': currentRoute === item.path }"
          >
            {{ item.label }}
          </router-link>
        </nav>
      </div>
    </header>
    <main class="app-main">
      <div class="app-main__container">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const currentRoute = computed(() => route.path);

const navItems = [
  { path: "/", label: "资讯" },
  { path: "/dashboard", label: "总览" },
  { path: "/positions", label: "持仓监控" },
  { path: "/discover", label: "发现交易员" },
  { path: "/tokens", label: "代币监控" },
];
</script>

<style scoped>
/* ── Shell ── */
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Header: Glassmorphic ── */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 64px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-bottom: var(--glass-border);
  display: flex;
  align-items: center;
  padding: 0 var(--margin-desktop);
}

.app-header__inner {
  width: 100%;
  max-width: var(--container-max);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ── Brand ── */
.app-brand {
  text-decoration: none;
  display: flex;
  align-items: center;
}

.app-brand__text {
  font-family: var(--font-heading);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-on-surface);
}

/* ── Nav ── */
.app-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-nav__link {
  font-family: var(--font-body);
  font-size: var(--text-label-sm-size);
  font-weight: var(--text-label-sm-weight);
  letter-spacing: var(--text-label-sm-spacing);
  color: var(--color-on-surface-variant);
  text-decoration: none;
  text-transform: uppercase;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  position: relative;
}

.app-nav__link:hover {
  color: var(--color-on-surface);
}

.app-nav__link--active {
  color: var(--color-on-surface);
}

.app-nav__link--active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 16px;
  right: 16px;
  height: 2px;
  background: var(--color-primary);
  border-radius: 1px;
}

/* ── Main ── */
.app-main {
  flex: 1;
  padding-top: 64px;
  padding-left: var(--margin-desktop);
  padding-right: var(--margin-desktop);
  padding-bottom: var(--section-gap);
}

.app-main__container {
  width: 100%;
  max-width: var(--container-max);
  margin: 0 auto;
  padding-top: var(--content-gap);
}

/* ── Responsive ── */
@media (max-width: 1199px) {
  .app-header {
    padding: 0 var(--margin-tablet);
  }

  .app-main {
    padding-left: var(--margin-tablet);
    padding-right: var(--margin-tablet);
  }
}

@media (max-width: 767px) {
  .app-header {
    padding: 0 var(--margin-mobile);
    height: 56px;
  }

  .app-brand__text {
    font-size: 12px;
    letter-spacing: 0.06em;
  }

  .app-nav__link {
    padding: 6px 10px;
    font-size: 10px;
  }

  .app-main {
    padding-top: 56px;
    padding-left: var(--margin-mobile);
    padding-right: var(--margin-mobile);
    padding-bottom: 60px;
  }
}
</style>
