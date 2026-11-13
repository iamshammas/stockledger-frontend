// Frontend-only PO numbers. The backend has no PO field, so derive a stable
// sequence from the tenant's purchase list: oldest first, PO-0001, PO-0002, ...
export const formatPoNumber = (sequence) => `PO-${String(sequence).padStart(4, '0')}`;

/**
 * Builds a Map of purchase id → PO label.
 * Ordering is chronological (purchase_date, then id) so a purchase keeps the
 * same number regardless of search filters or sort direction.
 */
export function buildPoNumbers(purchases) {
  const sorted = [...(purchases || [])].sort((a, b) => {
    const da = a.purchase_date || '';
    const db = b.purchase_date || '';
    if (da === db) return (a.id ?? 0) - (b.id ?? 0);
    return da.localeCompare(db);
  });

  const map = new Map();
  sorted.forEach((purchase, index) => {
    map.set(purchase.id, formatPoNumber(index + 1));
  });
  return map;
}
