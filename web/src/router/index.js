import { createRouter, createWebHashHistory } from "vue-router";
import News from "../views/News.vue";
import Dashboard from "../views/Dashboard.vue";
import TraderDetail from "../views/TraderDetail.vue";
import PositionMonitor from "../views/PositionMonitor.vue";
import Discover from "../views/Discover.vue";
import Tokens from "../views/Tokens.vue";
import Settings from "../views/Settings.vue";

const routes = [
  { path: "/", name: "News", component: News },
  { path: "/dashboard", name: "Dashboard", component: Dashboard },
  { path: "/trader/:id", name: "TraderDetail", component: TraderDetail },
  { path: "/positions", name: "PositionMonitor", component: PositionMonitor },
  { path: "/discover", name: "Discover", component: Discover },
  { path: "/tokens", name: "Tokens", component: Tokens },
  { path: "/settings", name: "Settings", component: Settings },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
