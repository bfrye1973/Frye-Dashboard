// src/lib/dashboardApiSafe.js
// Safe wrapper: use the real dashboard polling implementation instead of the old neutral stub.

export {
  fetchDashboard,
  getPollMs,
  getTone,
  useDashboardPoll,
} from "./dashboardApi";

export { useDashboardPoll as default } from "./dashboardApi";
