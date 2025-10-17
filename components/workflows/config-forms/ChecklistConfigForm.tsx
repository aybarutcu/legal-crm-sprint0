"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

interface ChecklistConfigFormProps {
  initialConfig: {
    items?: string[] | { title: string }[];
  };
  onChange: (config: { items: string[] }) => void;
}

export function ChecklistConfigForm({ initialConfig, onChange }: ChecklistConfigFormProps) {
  // Handle both string[] and { title: string }[] formats for backward compatibility
  const normalizeItems = (items: string[] | { title: string }[] | undefined): string[] => {
    if (!items || items.length === 0) return [];
    // Check if first item is an object with title property
    if (typeof items[0] === 'object' && 'title' in items[0]) {
      return (items as { title: string }[]).map(item => item.title);
    }
    return items as string[];
  };

  const [items, setItems] = useState<string[]>(normalizeItems(initialConfig.items));
  const [newItem, setNewItem] = useState("");

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    const updated = [...items, newItem.trim()];
    setItems(updated);
    setNewItem("");
    onChange({ items: updated });
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    onChange({ items: updated });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Kontrol Listesi Maddeleri
      </label>
      
      {/* Existing Items */}
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <span className="flex-1 text-sm text-slate-700">{item}</span>
            <button
              type="button"
              onClick={() => handleRemoveItem(index)}
              className="text-red-600 hover:text-red-700"
              title="Sil"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="text-sm text-slate-500 italic">Henüz madde eklenmedi.</p>
      )}

      {/* Add New Item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddItem();
            }
          }}
          placeholder="Yeni madde ekle..."
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <button
          type="button"
          onClick={handleAddItem}
          disabled={!newItem.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
