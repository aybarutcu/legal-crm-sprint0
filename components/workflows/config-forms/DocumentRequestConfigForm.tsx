"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

interface DocumentRequestConfigFormProps {
  initialConfig: {
    requestText?: string;
    documentNames?: string[];
  };
  onChange: (config: { requestText: string; documentNames: string[] }) => void;
}

export function DocumentRequestConfigForm({
  initialConfig,
  onChange,
}: DocumentRequestConfigFormProps) {
  const [documentNames, setDocumentNames] = useState<string[]>(
    initialConfig.documentNames ?? []
  );
  const [newName, setNewName] = useState("");

  const handleRequestTextChange = (requestText: string) => {
    onChange({
      requestText,
      documentNames: documentNames,
    });
  };

  const handleAddDocumentName = () => {
    if (!newName.trim()) return;
    const updated = [...documentNames, newName.trim()];
    setDocumentNames(updated);
    setNewName("");
    onChange({
      requestText: initialConfig.requestText ?? "",
      documentNames: updated,
    });
  };

  const handleRemoveDocumentName = (index: number) => {
    const updated = documentNames.filter((_, i) => i !== index);
    setDocumentNames(updated);
    onChange({
      requestText: initialConfig.requestText ?? "",
      documentNames: updated,
    });
  };

  return (
    <div className="space-y-4">
      {/* Request Text */}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Belge Talep Mesajı *
          <span className="ml-1 text-xs text-slate-500">(Müvekkile gösterilecek)</span>
        </label>
        <textarea
          value={initialConfig.requestText ?? ""}
          onChange={(e) => handleRequestTextChange(e.target.value)}
          placeholder="Örn: Lütfen nüfus cüzdanınızın renkli kopyasını yükleyiniz..."
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>

      {/* Document Names */}
      <div>
        <label className="block text-sm font-medium text-slate-700">
          İstenilen Belgeler
          <span className="ml-1 text-xs text-slate-500">(Opsiyonel - belge adları)</span>
        </label>

        {/* Existing Document Names */}
        <ul className="mt-2 space-y-2">
          {documentNames.map((name, index) => (
            <li
              key={index}
              className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2"
            >
              <span className="flex-1 text-sm text-orange-900">{name}</span>
              <button
                type="button"
                onClick={() => handleRemoveDocumentName(index)}
                className="text-orange-600 hover:text-orange-700"
                title="Sil"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {documentNames.length === 0 && (
          <p className="mt-2 text-xs text-slate-500 italic">
            Belge adı belirtilmedi.
          </p>
        )}

        {/* Add New Document Name */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddDocumentName();
              }
            }}
            placeholder="Örn: Nüfus Cüzdanı Kopyası, Pasaport Fotokopisi"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          <button
            type="button"
            onClick={handleAddDocumentName}
            disabled={!newName.trim()}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          💡 Örnek belge adları: Nüfus Cüzdanı Kopyası, İkametgah Belgesi, Pasaport Fotokopisi
        </p>
      </div>
    </div>
  );
}
