"use client";

import { useState } from "react";

type ChecklistItem = {
  title: string;
};

type ChecklistBuilderProps = {
  value: ChecklistItem[];
  onChange: (value: ChecklistItem[]) => void;
};

export function ChecklistBuilder({ value, onChange }: ChecklistBuilderProps) {
  const [items, setItems] = useState(value);

  const handleItemChange = (index: number, title: string) => {
    const newItems = [...items];
    newItems[index] = { title };
    setItems(newItems);
    onChange(newItems);
  };

  const handleAddItem = () => {
    const newItems = [...items, { title: "" }];
    setItems(newItems);
    onChange(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    onChange(newItems);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={item.title}
            onChange={(e) => handleItemChange(index, e.target.value)}
            className="flex-grow rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Checklist item title"
          />
          <button
            type="button"
            onClick={() => handleRemoveItem(index)}
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAddItem}
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
      >
        Add Item
      </button>
    </div>
  );
}
