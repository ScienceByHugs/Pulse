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
    ...logs.map((l) => ({
      id: `log:${l.id}`,
      at: l.logged_at,
      title:
        l.status === 'undone'
          ? 'Entry undone (current status)'
          : 'Recorded use (current amount)',
      detail: `${l.amount} ${l.unit}${l.status === 'undone' ? ' · stock restored where tracked' : ''}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}
