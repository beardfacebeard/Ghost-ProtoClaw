/**
 * Shared premium design primitives used across every admin page after
 * the 2026 redesign. Import from this barrel so pages don't have to
 * reach into individual files:
 *
 *   import { PageHeader, Panel, StatBlock } from "@/components/admin/ui";
 */
export { PageHeader } from "./PageHeader";
export { Panel, PanelHeader, PanelBody } from "./Panel";
export { StatBlock } from "./StatBlock";
export { StatusDot } from "./StatusDot";
export { EmptyState } from "./EmptyState";
export { DataRow } from "./DataRow";
