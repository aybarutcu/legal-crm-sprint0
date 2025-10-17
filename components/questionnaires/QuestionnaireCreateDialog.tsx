"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Plus, Trash2, GripVertical, X, HelpCircle } from "lucide-react";
import type { QuestionnaireListItem, CreateQuestionInput } from "@/components/questionnaires/types";

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

type QuestionnaireCreateDialogProps = {
  onCreated: (questionnaire: QuestionnaireListItem) => void;
};

type QuestionFormData = CreateQuestionInput & {
  tempId: string;
};

export function QuestionnaireCreateDialog({ onCreated }: QuestionnaireCreateDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);

  const addQuestion = () => {
    const newQuestion: QuestionFormData = {
      tempId: `temp-${Date.now()}`,
      questionText: "",
      questionType: "FREE_TEXT",
      order: questions.length,
      required: true,
      placeholder: "",
      helpText: "",
      options: [],
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (tempId: string) => {
    setQuestions((prev) => {
      const filtered = prev.filter((q) => q.tempId !== tempId);
      return filtered.map((q, index) => ({ ...q, order: index }));
    });
  };

  const updateQuestion = (tempId: string, updates: Partial<QuestionFormData>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.tempId === tempId ? { ...q, ...updates } : q))
    );
  };

  const addOption = (tempId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.tempId === tempId) {
          const currentOptions = Array.isArray(q.options) ? q.options : [];
          return { ...q, options: [...currentOptions, ""] };
        }
        return q;
      })
    );
  };

  const updateOption = (tempId: string, index: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.tempId === tempId) {
          const currentOptions = Array.isArray(q.options) ? [...q.options] : [];
          currentOptions[index] = value;
          return { ...q, options: currentOptions };
        }
        return q;
      })
    );
  };

  const removeOption = (tempId: string, index: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.tempId === tempId) {
          const currentOptions = Array.isArray(q.options) ? [...q.options] : [];
          currentOptions.splice(index, 1);
          return { ...q, options: currentOptions };
        }
        return q;
      })
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Anket başlığı gereklidir");
      return;
    }

    if (questions.length === 0) {
      setError("En az bir soru eklemelisiniz");
      return;
    }

    for (const q of questions) {
      if (!q.questionText.trim()) {
        setError("Tüm soruların metni doldurulmalıdır");
        return;
      }
      if ((q.questionType === "SINGLE_CHOICE" || q.questionType === "MULTI_CHOICE") && (!q.options || q.options.length === 0)) {
        setError("Seçim soruları için seçenekler gereklidir");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        questions: questions.map((q) => ({
          questionText: q.questionText.trim(),
          questionType: q.questionType,
          order: q.order,
          required: q.required,
          placeholder: q.placeholder?.trim() || undefined,
          helpText: q.helpText?.trim() || undefined,
          options: q.options && q.options.length > 0 ? q.options : undefined,
        })),
      };

      const res = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Anket oluşturulamadı");
      }

      const data = await res.json();
      
      const questionnaire: QuestionnaireListItem = {
        id: data.questionnaire.id,
        title: data.questionnaire.title,
        description: data.questionnaire.description,
        isActive: data.questionnaire.isActive,
        createdAt: data.questionnaire.createdAt,
        updatedAt: data.questionnaire.updatedAt,
        createdBy: data.questionnaire.createdBy,
        _count: {
          questions: data.questionnaire.questions?.length || 0,
          responses: 0,
        },
      };

      onCreated(questionnaire);
      setIsOpen(false);
      resetForm();
    } catch (err) {
      console.error("Create error:", err);
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setQuestions([]);
    setError(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    resetForm();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
      >
        <Plus className="h-4 w-4" />
        Yeni Anket
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h3 className="text-xl font-semibold text-slate-900">Yeni Anket Oluştur</h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Anket Başlığı *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="Örnek: Müşteri Giriş Formu"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Açıklama
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="Anketin amacını açıklayın..."
                rows={2}
              />
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-slate-900">Sorular</h4>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Soru Ekle
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
                Henüz soru eklenmedi. "Soru Ekle" butonuna tıklayarak başlayın.
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div
                    key={question.tempId}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-2">
                        <GripVertical className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 mt-2 text-sm font-semibold text-slate-700">
                            {index + 1}.
                          </span>
                          <div className="flex-1 space-y-3">
                            <input
                              type="text"
                              value={question.questionText}
                              onChange={(e) =>
                                updateQuestion(question.tempId, { questionText: e.target.value })
                              }
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                              placeholder="Soru metnini girin"
                              required
                            />

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
                                    const updates: Partial<QuestionFormData> = { questionType: newType };
                                    
                                    // Initialize options array when switching to choice types
                                    if ((newType === "SINGLE_CHOICE" || newType === "MULTI_CHOICE") && 
                                        (!question.options || !Array.isArray(question.options) || question.options.length === 0)) {
                                      updates.options = ["", ""];
                                    }
                                    
                                    updateQuestion(question.tempId, updates);
                                  }}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                >
                                  <option value="FREE_TEXT">Serbest Metin</option>
                                  <option value="SINGLE_CHOICE">Tek Seçim</option>
                                  <option value="MULTI_CHOICE">Çoklu Seçim</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-2 mt-6">
                                <input
                                  type="checkbox"
                                  id={`required-${question.tempId}`}
                                  checked={question.required}
                                  onChange={(e) =>
                                    updateQuestion(question.tempId, { required: e.target.checked })
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                                />
                                <label
                                  htmlFor={`required-${question.tempId}`}
                                  className="text-sm text-slate-700"
                                >
                                  Zorunlu
                                </label>
                                <Tooltip text="Zorunlu sorular cevaplanmadan anket gönderilemez." />
                              </div>
                            </div>

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
                                        onChange={(e) => updateOption(question.tempId, idx, e.target.value)}
                                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                        placeholder={`Seçenek ${idx + 1}`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeOption(question.tempId, idx)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Seçeneği kaldır"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addOption(question.tempId)}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Seçenek Ekle
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                                  Placeholder
                                  <Tooltip text="Metin kutusunda görünecek örnek metin. Kullanıcıya ne yazması gerektiği hakkında ipucu verir." />
                                </label>
                                <input
                                  type="text"
                                  value={question.placeholder || ""}
                                  onChange={(e) =>
                                    updateQuestion(question.tempId, { placeholder: e.target.value })
                                  }
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
                                  onChange={(e) =>
                                    updateQuestion(question.tempId, { helpText: e.target.value })
                                  }
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                  placeholder="Ek bilgi..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(question.tempId)}
                        className="flex-shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || questions.length === 0}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {isSubmitting ? "Oluşturuluyor..." : "Anket Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
