import { format, parseISO } from "date-fns";

/** Maps stored action names to readable human labels */
export const ACTION_LABELS: Record<string, string> = {
  RECORD_PRODUCTION: "Record Egg Production",
  CREATE_SALE: "Create Egg Sale",
  RECORD_FEED_CONSUMPTION: "Record Feed Consumption",
  FEED_STOCK_RECEIVED: "Receive Feed Stock",
  EGG_INVENTORY_ADJUSTED: "Adjust Egg Inventory",
  RECORD_MORTALITY: "Record Mortality",
  RECORD_CULLING: "Record Culling",
  UPDATE_USER_ROLE: "Update User Role",
  USER_ROLE_CHANGED: "Update User Role",
  USER_STATUS_CHANGED: "Update User Status",
  DEACTIVATE_USER: "Deactivate User",
  ACTIVATE_USER: "Activate User",
};

/** Maps entity_table values to readable module labels */
export const MODULE_LABELS: Record<string, string> = {
  egg_production: "Egg Production",
  egg_sales: "Egg Sales",
  egg_inventory: "Egg Inventory",
  feed_consumption: "Feed Consumption",
  feed_inventory: "Feed Inventory",
  flock_mortality: "Flock Mortality",
  flock_culling: "Flock Culling",
  profiles: "Users",
};

/** Returns a display-safe action label */
export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

/** Returns a display-safe module label */
export function getModuleLabel(entityTable: string): string {
  return MODULE_LABELS[entityTable] ?? entityTable.replace(/_/g, " ");
}

/** Format ISO datetime to readable local string */
export function formatTimestamp(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy h:mm a");
  } catch {
    return iso;
  }
}

/**
 * Extracts a short, human-readable summary from metadata.
 * Each action has different relevant fields.
 */
export function formatMetadataSummary(
  action: string,
  metadata: Record<string, unknown> | null
): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "No additional details";
  }

  try {
    switch (action) {
      case "RECORD_PRODUCTION": {
        const date = metadata.production_date as string | undefined;
        const total = metadata.total_eggs as number | undefined;
        const good = metadata.good_eggs as number | undefined;
        const parts: string[] = [];
        if (date) parts.push(`Date: ${date}`);
        if (total !== undefined) parts.push(`Total: ${total.toLocaleString()} eggs`);
        if (good !== undefined) parts.push(`Good: ${good.toLocaleString()} eggs`);
        return parts.join(" · ") || JSON.stringify(metadata);
      }
      case "CREATE_SALE": {
        const date = metadata.sale_date as string | undefined;
        const total = metadata.total_amount as number | undefined;
        const discount = metadata.discount as number | undefined;
        const parts: string[] = [];
        if (date) parts.push(`Date: ${date}`);
        if (total !== undefined) parts.push(`Total: ₱${Number(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
        if (discount !== undefined && Number(discount) > 0) parts.push(`Discount: ₱${Number(discount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
        return parts.join(" · ") || JSON.stringify(metadata);
      }
      case "RECORD_FEED_CONSUMPTION": {
        const feedType = metadata.feed_type as string | undefined;
        const qty = metadata.quantity_kg as number | undefined;
        const date = metadata.consumption_date as string | undefined;
        const parts: string[] = [];
        if (feedType) parts.push(`Feed: ${feedType.replace(/_/g, " ")}`);
        if (qty !== undefined) parts.push(`Qty: ${qty} kg`);
        if (date) parts.push(`Date: ${date}`);
        return parts.join(" · ") || JSON.stringify(metadata);
      }
      case "FEED_STOCK_RECEIVED": {
        const feedType = metadata.feed_type as string | undefined;
        const qty = metadata.quantity_kg as number | undefined;
        const cost = metadata.cost_per_kg as number | undefined;
        const date = metadata.intake_date as string | undefined;
        const parts: string[] = [];
        if (feedType) parts.push(`Feed: ${feedType.replace(/_/g, " ")}`);
        if (qty !== undefined) parts.push(`Qty: ${qty} kg`);
        if (cost !== undefined) parts.push(`Cost: ₱${Number(cost).toFixed(2)}/kg`);
        if (date) parts.push(`Date: ${date}`);
        return parts.join(" · ") || JSON.stringify(metadata);
      }
      case "EGG_INVENTORY_ADJUSTED": {
        const size = metadata.size as string | undefined;
        const adj = metadata.adjustment as number | undefined;
        const before = metadata.before as number | undefined;
        const after = metadata.after as number | undefined;
        const parts: string[] = [];
        if (size) parts.push(`Size: ${size}`);
        if (adj !== undefined) parts.push(`Adjustment: ${adj > 0 ? "+" : ""}${adj}`);
        if (before !== undefined && after !== undefined) parts.push(`${before.toLocaleString()} → ${after.toLocaleString()}`);
        return parts.join(" · ") || JSON.stringify(metadata);
      }
      case "RECORD_MORTALITY":
      case "RECORD_CULLING": {
        const qty = metadata.quantity as number | undefined;
        const type = metadata.entry_record_type as string | undefined;
        const before = metadata.birds_before as number | undefined;
        const after = metadata.birds_after as number | undefined;
        const parts: string[] = [];
        if (qty !== undefined) parts.push(`Qty: ${qty.toLocaleString()} birds`);
        if (type && type !== "STANDARD") parts.push(`Type: ${type.replace(/_/g, " ")}`);
        if (before !== undefined && after !== undefined) parts.push(`Count: ${before.toLocaleString()} → ${after.toLocaleString()}`);
        return parts.join(" · ") || JSON.stringify(metadata);
      }
      case "UPDATE_USER_ROLE":
      case "USER_ROLE_CHANGED": {
        const target = (metadata.target_name || metadata.target_user) as string | undefined;
        const oldRole = (metadata.previous_role || metadata.old_role) as string | undefined;
        const newRole = (metadata.new_role) as string | undefined;
        const parts: string[] = [];
        if (target) parts.push(`User: ${target}`);
        if (oldRole && newRole) parts.push(`Role: ${oldRole} → ${newRole}`);
        else if (newRole) parts.push(`Role: ${newRole}`);
        return parts.join(" · ") || JSON.stringify(metadata);
      }
      case "USER_STATUS_CHANGED":
      case "DEACTIVATE_USER":
      case "ACTIVATE_USER": {
        const target = (metadata.target_name || metadata.target_user) as string | undefined;
        const prevStatus = metadata.previous_status !== undefined ? (metadata.previous_status ? "Active" : "Inactive") : undefined;
        const newStatus = metadata.new_status !== undefined ? (metadata.new_status ? "Active" : "Inactive") : undefined;
        const parts: string[] = [];
        if (target) parts.push(`User: ${target}`);
        if (prevStatus && newStatus) parts.push(`Status: ${prevStatus} → ${newStatus}`);
        else if (newStatus) parts.push(`Status: ${newStatus}`);
        return parts.join(" · ") || JSON.stringify(metadata);
      }
      default:
        // Generic fallback: show key=value pairs
        return Object.entries(metadata)
          .slice(0, 4)
          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
          .join(" · ");
    }
  } catch {
    return "No additional details";
  }
}
