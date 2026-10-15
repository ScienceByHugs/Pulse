export type InventoryHistoryEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
};
type Container = {
  id: string;
  unit: string;
  total_amount: number;
  created_at: string;
};
type Adjustment = {
  id: string;
  inventory_container_id: string;
  old_remaining_amount: number;
  new_remaining_amount: number;
  reason: string;
  created_at: string;
};
type StockLog = {
  id: string;
  amount: number;
  unit: string;
  status: string;
  logged_at: string;
};
function stockLogEvent(log: StockLog): InventoryHistoryEvent {
  const amount = `${log.amount} ${log.unit}`;
  const event = { id: `log:${log.id}`, at: log.logged_at };
  switch (log.status) {
    case 'completed':
      return {
        ...event,
        title: 'Recorded use (current amount)',
        detail: amount,
      };
    case 'voided':
      return {
        ...event,
        title: 'Entry undone (current status)',
        detail: `${amount} · stock restored where tracked`,
      };
    case 'skipped':
      return {
        ...event,
        title: 'Entry skipped (current status)',
        detail: `${amount} · no stock consumed by this entry`,
      };
    case 'missed':
      return {
        ...event,
        title: 'Entry not recorded (current status)',
        detail: `${amount} · no stock consumed by this entry`,
      };
    default:
      return {
        ...event,
        title: 'Tracking entry (current status)',
        detail: `${amount} · ${log.status}`,
      };
  }
}
export function inventoryHistoryEvents(
  containers: Container[],
  adjustments: Adjustment[],
  logs: StockLog[],
): InventoryHistoryEvent[] {
  const units = new Map(containers.map((c) => [c.id, c.unit]));
  return [
    ...containers.map((c) => ({
      id: `container:${c.id}`,
      at: c.created_at,
      title: 'Container added',
      detail: `Starting total: ${c.total_amount} ${c.unit}`,
    })),
    ...adjustments.map((a) => ({
      id: `correction:${a.id}`,
      at: a.created_at,
      title: 'Stock corrected',
      detail: `${a.old_remaining_amount} → ${a.new_remaining_amount} ${units.get(a.inventory_container_id) ?? ''} · ${a.reason}`,
    })),
    ...logs.map(stockLogEvent),
  ].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}
