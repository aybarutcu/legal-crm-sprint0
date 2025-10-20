"use client";

import { useState, useEffect } from "react";

interface WriteTextConfigFormProps {
  initialConfig: {
    title?: string;
    description?: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    required?: boolean;
  };
  onChange: (config: {
    title: string;
    description?: string;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    required?: boolean;
  }) => void;
}

export function WriteTextConfigForm({ initialConfig, onChange }: WriteTextConfigFormProps) {
  const [title, setTitle] = useState(initialConfig.title || "");
  const [description, setDescription] = useState(initialConfig.description || "");
  const [placeholder, setPlaceholder] = useState(
    initialConfig.placeholder || "Enter your text here..."
  );
  const [minLength, setMinLength] = useState<number | undefined>(initialConfig.minLength);
  const [maxLength, setMaxLength] = useState<number | undefined>(initialConfig.maxLength);
  const [required, setRequired] = useState(initialConfig.required !== false); // default true

  useEffect(() => {
    // Trigger onChange when any field changes
    if (title) { // Only save if title is not empty
      onChange({
        title,
        description: description || undefined,
        placeholder: placeholder || undefined,
        minLength: minLength && minLength > 0 ? minLength : undefined,
        maxLength: maxLength && maxLength > 0 ? maxLength : undefined,
        required,
      });
    }
  }, [title, description, placeholder, minLength, maxLength, required]); // Removed onChange from deps

  return (
    <div className="space-y-4">
      {/* Title Field - Required */}
      <div>
        <label htmlFor="writeTextTitle" className="block text-sm font-medium text-slate-700 mb-1">
          Başlık <span className="text-red-500">*</span>
        </label>
        <input
          id="writeTextTitle"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Örn: İlk Yanıt Taslağı"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Kullanıcının yazması beklenen metnin başlığı
        </p>
      </div>

      {/* Description Field - Optional */}
      <div>
        <label htmlFor="writeTextDesc" className="block text-sm font-medium text-slate-700 mb-1">
          Açıklama
        </label>
        <textarea
          id="writeTextDesc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Bu metinde ne yazılması gerektiğini açıklayın..."
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <p className="mt-1 text-xs text-slate-500">
          Kullanıcıya ne yazması gerektiği hakkında yönlendirme
        </p>
      </div>

      {/* Placeholder Field - Optional */}
      <div>
        <label htmlFor="writeTextPlaceholder" className="block text-sm font-medium text-slate-700 mb-1">
          Yer Tutucu Metin
        </label>
        <input
          id="writeTextPlaceholder"
          type="text"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder="Enter your text here..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <p className="mt-1 text-xs text-slate-500">
          Metin alanında gösterilecek yer tutucu
        </p>
      </div>

      {/* Length Constraints */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="writeTextMinLength" className="block text-sm font-medium text-slate-700 mb-1">
            Minimum Uzunluk
          </label>
          <input
            id="writeTextMinLength"
            type="number"
            min="0"
            value={minLength ?? ""}
            onChange={(e) => setMinLength(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            placeholder="0"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="mt-1 text-xs text-slate-500">
            Minimum karakter sayısı
          </p>
        </div>

        <div>
          <label htmlFor="writeTextMaxLength" className="block text-sm font-medium text-slate-700 mb-1">
            Maximum Uzunluk
          </label>
          <input
            id="writeTextMaxLength"
            type="number"
            min="1"
            value={maxLength ?? ""}
            onChange={(e) => setMaxLength(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            placeholder="Sınırsız"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="mt-1 text-xs text-slate-500">
            Maximum karakter sayısı
          </p>
        </div>
      </div>

      {/* Required Toggle */}
      <div className="flex items-center gap-2">
        <input
          id="writeTextRequired"
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="writeTextRequired" className="text-sm font-medium text-slate-700">
          Bu alan zorunludur
        </label>
      </div>

      {/* Preview */}
      {title && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase mb-2">Önizleme</p>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="font-medium text-slate-900 mb-1">
              {title}
              {required && <span className="text-red-500 ml-1">*</span>}
            </h4>
            {description && (
              <p className="text-sm text-slate-600 mb-3">{description}</p>
            )}
            <div className="border border-slate-200 rounded-lg p-3 text-sm text-slate-400">
              {placeholder}
            </div>
            {(minLength || maxLength) && (
              <p className="mt-2 text-xs text-slate-500">
                {minLength && maxLength
                  ? `${minLength} - ${maxLength} karakter`
                  : minLength
                  ? `En az ${minLength} karakter`
                  : `En fazla ${maxLength} karakter`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
