export function getBusinessStatusMeta(status: string) {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className: "bg-status-active text-white"
      };
    case "archived":
      return {
        label: "Archived",
        className: "bg-ghost-raised text-slate-300"
      };
    case "planning":
    default:
      return {
        label: "Planning",
        className: "bg-brand-amber text-ghost-black"
      };
  }
}

export function formatBusinessDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
