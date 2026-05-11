<template>
  <el-container style="min-height: 100vh">
    <el-header style="background: #1a1a2e; padding: 0 20px; display: flex; align-items: center; justify-content: space-between">
      <div style="display: flex; align-items: center; gap: 12px">
        <span style="font-size: 22px; color: #fff; font-weight: bold">📰 Crypto资讯</span>
      </div>
      <el-menu
        mode="horizontal"
        :default-active="currentRoute"
        router
        style="background: transparent; border-bottom: none"
        text-color="#aaa"
        active-text-color="#fff"
      >
        <el-menu-item index="/">资讯</el-menu-item>
        <el-menu-item index="/dashboard">总览</el-menu-item>
        <el-menu-item index="/positions">持仓监控</el-menu-item>
        <el-menu-item index="/discover">发现交易员</el-menu-item>
        <el-menu-item index="/tokens">代币监控</el-menu-item>
      </el-menu>
    </el-header>
    <el-main style="background: #f5f7fa; padding: 20px">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const currentRoute = computed(() => route.path);
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.el-header { --el-header-height: 56px; }
</style>
