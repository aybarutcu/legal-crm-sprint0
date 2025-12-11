"use client";

interface ChecklistExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  checkedItems: Set<string>;
  onToggleItem: (item: string) => void;
  onComplete: (completedItems: string[]) => void;
  isLoading: boolean;
}

export function ChecklistExecution({
  step,
  checkedItems,
  onToggleItem,
  onComplete,
  isLoading,
}: ChecklistExecutionProps) {
  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const items = (config?.items as string[]) ?? [];
  const allChecked = items.length > 0 && items.every((item) => checkedItems.has(item));

  const handleToggle = async (item: string) => {
    // Toggle in local state first
    onToggleItem(item);
    
    // Calculate new checked items
    const newCheckedItems = new Set(checkedItems);
    if (newCheckedItems.has(item)) {
      newCheckedItems.delete(item);
    } else {
      newCheckedItems.add(item);
    }
    
    // Persist to server
    try {
      await fetch(`/api/workflows/steps/${step.id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkedItems: Array.from(newCheckedItems),
        }),
      });
    } catch (error) {
      console.error("Failed to save checklist state:", error);
    }
  };

  return (
    <div className="mt-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
      <h5 className="mb-3 font-semibold text-blue-900">Kontrol Listesi</h5>
      <div className="space-y-2">
        {items.map((item) => {
          const isChecked = checkedItems.has(item);
          return (
            <label
              key={item}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-blue-200 bg-white px-3 py-2 hover:bg-blue-50"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(item)}
                className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className={`text-sm ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {item}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onComplete(Array.from(checkedItems))}
          disabled={!allChecked || isLoading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isLoading ? "Tamamlanıyor..." : `Tamamla (${checkedItems.size}/${items.length})`}
        </button>
      </div>
    </div>
  );
}
