export const statusLabels = {
  HEALTHY: "Healthy",
  ATTENTION: "Attention",
  CRITICAL: "Critical",
  UNDER_MAINTENANCE: "Under maintenance",
};
export const statusLabel = (value) => statusLabels[value] || value || "Unknown";
export const formatCount = (value) =>
  new Intl.NumberFormat("en-IN").format(value || 0);
export const formatINR = (value) => {
  const amount = Number(value || 0);
  return amount >= 10000000
    ? `Rs ${(amount / 10000000).toFixed(1)} Cr`
    : amount >= 100000
      ? `Rs ${(amount / 100000).toFixed(1)}L`
      : `Rs ${formatCount(amount)}`;
};
export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "-";
export const timeAgo = (value) => {
  if (!value) return "-";
  const days = Math.floor((Date.now() - new Date(value)) / 86400000);
  return days <= 0 ? "Today" : `${days}d ago`;
};
export const typeIcon = (typeKey = "asset") =>
  ({
    bridge: "▱",
    road_segment: "═",
    highway: "▰",
    culvert: "⌒",
    tunnel: "◉",
    streetlight: "✦",
    road_sign: "△",
  })[typeKey] || "•";
