import { createRouter, createWebHashHistory } from "vue-router";
import Dashboard from "../views/Dashboard.vue";
import TraderDetail from "../views/TraderDetail.vue";
import PositionMonitor from "../views/PositionMonitor.vue";
import Discover from "../views/Discover.vue";

const routes = [
  { path: "/", name: "Dashboard", component: Dashboard },
  { path: "/trader/:id", name: "TraderDetail", component: TraderDetail },
  { path: "/positions", name: "PositionMonitor", component: PositionMonitor },
  { path: "/discover", name: "Discover", component: Discover },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
