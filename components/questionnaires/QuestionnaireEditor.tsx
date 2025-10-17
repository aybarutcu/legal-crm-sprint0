"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Eye, EyeOff, Plus } from "lucide-react";
import { QuestionEditor } from "@/components/questionnaires/QuestionEditor";
import { QuestionnairePreview } from "@/components/questionnaires/QuestionnairePreview";
import type { QuestionnaireDetail, QuestionDetail } from "@/components/questionnaires/types";

type QuestionnaireEditorProps = {
  questionnaire: QuestionnaireDetail;
};

export function QuestionnaireEditor({ questionnaire }: QuestionnaireEditorProps) {
  const router = useRouter();
  const [isPreview, setIsPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(questionnaire.title);
  const [description, setDescription] = useState(questionnaire.description || "");
  const [isActive, setIsActive] = useState(questionnaire.isActive);
  const [questions, setQuestions] = useState<QuestionDetail[]>(questionnaire.questions);

  // Track changes
  useEffect(() => {
    const hasBasicChanges = 
      title !== questionnaire.title ||
      description !== (questionnaire.description || "") ||
      isActive !== questionnaire.isActive;

    const hasQuestionChanges = 
      questions.length !== questionnaire.questions.length ||
      questions.some((q, i) => {
        const original = questionnaire.questions[i];
        if (!original) return true;
        return (
          q.questionText !== original.questionText ||
          q.questionType !== original.questionType ||
          q.required !== original.required ||
          q.placeholder !== original.placeholder ||
          q.helpText !== original.helpText ||
          JSON.stringify(q.options) !== JSON.stringify(original.options) ||
          q.order !== original.order
        );
      });

    setHasChanges(hasBasicChanges || hasQuestionChanges);
  }, [title, description, isActive, questions, questionnaire]);

  // Warn on page leave with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: globalThis.BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addQuestion = () => {
    const newQuestion: QuestionDetail = {
      id: `new-${Date.now()}`,
      questionnaireId: questionnaire.id,
      questionText: "",
      questionType: "FREE_TEXT",
      order: questions.length,
      required: true,
      placeholder: null,
      helpText: null,
      options: null,
      validation: null,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<QuestionDetail>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => {
      const filtered = prev.filter((q) => q.id !== id);
      return filtered.map((q, index) => ({ ...q, order: index }));
    });
  };

  const moveQuestion = (id: string, direction: "up" | "down") => {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.id === id);
      if (index === -1) return prev;
      
      if (direction === "up" && index === 0) return prev;
      if (direction === "down" && index === prev.length - 1) return prev;

      const newQuestions = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
      
      return newQuestions.map((q, i) => ({ ...q, order: i }));
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Anket başlığı gereklidir");
      return;
    }

    if (questions.length === 0) {
      setError("En az bir soru gereklidir");
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

    setIsSaving(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        isActive,
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

      const res = await fetch(`/api/questionnaires/${questionnaire.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Güncelleme başarısız");
      }

      const data = await res.json();
      
      // Update local state with server response
      setTitle(data.questionnaire.title);
      setDescription(data.questionnaire.description || "");
      setIsActive(data.questionnaire.isActive);
      setQuestions(data.questionnaire.questions.map((q: QuestionDetail) => ({
        ...q,
        options: q.options as string[] | null,
        validation: q.validation as Record<string, unknown> | null,
      })));
      
      setToast("Anket başarıyla güncellendi");
      setHasChanges(false);
      
      // Refresh the page data
      router.refresh();
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!hasChanges || window.confirm("Kaydedilmemiş değişiklikler kaybolacak. Devam etmek istiyor musunuz?")) {
      setTitle(questionnaire.title);
      setDescription(questionnaire.description || "");
      setIsActive(questionnaire.isActive);
      setQuestions(questionnaire.questions);
      setHasChanges(false);
      setError(null);
    }
  };

  if (isPreview) {
    return (
      <div className="space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        )}

        {/* Preview Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/questionnaires"
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Anketler
            </Link>
            <span className="text-slate-300">/</span>
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={() => setIsPreview(false)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <EyeOff className="h-4 w-4" />
            Düzenlemeye Dön
          </button>
        </div>

        {/* Preview Content */}
        <QuestionnairePreview
          title={title}
          description={description}
          questions={questions}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/questionnaires"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Anketler
          </Link>
          <span className="text-slate-300">/</span>
          <h2 className="text-2xl font-semibold text-slate-900">Anket Düzenle</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPreview(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <Eye className="h-4 w-4" />
            Önizle
          </button>
          {hasChanges && (
            <>
              <button
                onClick={handleDiscard}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
          Kaydedilmemiş değişiklikleriniz var. Değişiklikleri kaydetmek için "Kaydet" butonuna tıklayın.
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Meta Info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Oluşturan
            </div>
            <div className="text-sm text-slate-700">
              {questionnaire.createdBy.name || questionnaire.createdBy.email}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Oluşturulma
            </div>
            <div className="text-sm text-slate-700">
              {new Date(questionnaire.createdAt).toLocaleDateString("tr-TR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Cevap Sayısı
            </div>
            <div className="text-sm text-slate-700">
              {questionnaire._count.responses} cevap
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Durum
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700 cursor-pointer">
                {isActive ? "Aktif" : "Pasif"}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Basic Info Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Temel Bilgiler</h3>
          
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
              rows={3}
            />
          </div>
        </div>

        {/* Questions Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Sorular ({questions.length})
            </h3>
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
                <QuestionEditor
                  key={question.id}
                  question={question}
                  index={index}
                  totalQuestions={questions.length}
                  onUpdate={(updates: Partial<QuestionDetail>) => updateQuestion(question.id, updates)}
                  onRemove={() => removeQuestion(question.id)}
                  onMoveUp={() => moveQuestion(question.id, "up")}
                  onMoveDown={() => moveQuestion(question.id, "down")}
                />
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
