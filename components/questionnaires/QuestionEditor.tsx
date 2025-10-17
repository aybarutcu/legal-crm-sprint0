"use client";

import { ChevronUp, ChevronDown, Trash2, GripVertical, Plus, X, HelpCircle } from "lucide-react";
import type { QuestionDetail } from "@/components/questionnaires/types";

// Simple Tooltip component
function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-block">
      <HelpCircle className="h-4 w-4 text-slate-400 hover:text-slate-600 cursor-help" />
      <div className="invisible group-hover:visible absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
        {text}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
      </div>
    </div>
  );
}

type QuestionEditorProps = {
  question: QuestionDetail;
  index: number;
  totalQuestions: number;
  onUpdate: (updates: Partial<QuestionDetail>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function QuestionEditor({
  question,
  index,
  totalQuestions,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: QuestionEditorProps) {
  const addOption = () => {
    const currentOptions = Array.isArray(question.options) ? question.options : [];
    onUpdate({ options: [...currentOptions, ""] });
  };

  const updateOption = (index: number, value: string) => {
    const currentOptions = Array.isArray(question.options) ? [...question.options] : [];
    currentOptions[index] = value;
    onUpdate({ options: currentOptions });
  };

  const removeOption = (index: number) => {
    const currentOptions = Array.isArray(question.options) ? [...question.options] : [];
    currentOptions.splice(index, 1);
    onUpdate({ options: currentOptions });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div className="flex-shrink-0 mt-2">
          <GripVertical className="h-5 w-5 text-slate-400 cursor-move" />
        </div>

        {/* Question Number */}
        <div className="flex-shrink-0 mt-2">
          <span className="text-sm font-semibold text-slate-700">
            {index + 1}.
          </span>
        </div>

        {/* Question Content */}
        <div className="flex-1 space-y-3">
          {/* Question Text */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Soru Metni *
            </label>
            <input
              type="text"
              value={question.questionText}
              onChange={(e) => onUpdate({ questionText: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Soru metnini girin"
              required
            />
          </div>

          {/* Question Type and Required */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                Soru Tipi
                <Tooltip text="Serbest Metin: Uzun cevaplar için. Tek Seçim: Radyo butonları. Çoklu Seçim: Birden fazla seçenek işaretlenebilir." />
              </label>
              <select
                value={question.questionType}
                onChange={(e) => {
                  const newType = e.target.value as "FREE_TEXT" | "SINGLE_CHOICE" | "MULTI_CHOICE";
                  const updates: Partial<QuestionDetail> = { questionType: newType };
                  
                  // Initialize options array when switching to choice types
                  if ((newType === "SINGLE_CHOICE" || newType === "MULTI_CHOICE") && 
                      (!question.options || !Array.isArray(question.options) || question.options.length === 0)) {
                    updates.options = ["", ""];
                  }
                  
                  onUpdate(updates);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
              >
                <option value="FREE_TEXT">Serbest Metin</option>
                <option value="SINGLE_CHOICE">Tek Seçim</option>
                <option value="MULTI_CHOICE">Çoklu Seçim</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(e) => onUpdate({ required: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                />
                <span className="text-sm text-slate-700">Zorunlu</span>
                <Tooltip text="Zorunlu sorular cevaplanmadan anket gönderilemez." />
              </label>
            </div>
          </div>

          {/* Options for Choice Questions */}
          {(question.questionType === "SINGLE_CHOICE" || question.questionType === "MULTI_CHOICE") && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-2">
                Seçenekler *
                <Tooltip text="Her seçeneği ayrı bir satıra girin. En az 2 seçenek gereklidir." />
              </label>
              <div className="space-y-2">
                {Array.isArray(question.options) && question.options.map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-6">{idx + 1}.</span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      placeholder={`Seçenek ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Seçeneği kaldır"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-accent/10 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Seçenek Ekle
                </button>
              </div>
            </div>
          )}

          {/* Placeholder and Help Text */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                Placeholder
                <Tooltip text="Metin kutusunda görünecek örnek metin. Kullanıcıya ne yazması gerektiği hakkında ipucu verir." />
              </label>
              <input
                type="text"
                value={question.placeholder || ""}
                onChange={(e) => onUpdate({ placeholder: e.target.value || null })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="Örnek metin..."
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                Yardım Metni
                <Tooltip text="Sorunun altında küçük harflerle görünecek açıklama metni. Ek bilgi vermek için kullanılır." />
              </label>
              <input
                type="text"
                value={question.helpText || ""}
                onChange={(e) => onUpdate({ helpText: e.target.value || null })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="Ek bilgi..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Yukarı taşı"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalQuestions - 1}
            className="rounded p-1.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Aşağı taşı"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="my-1 border-t border-slate-300" />
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1.5 text-red-600 hover:bg-red-50"
            title="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
