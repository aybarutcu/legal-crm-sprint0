// app/(dashboard)/questionnaires/ai/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCheck, ArrowLeft, MessageSquare, ListChecks, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type QuestionType = "FREE_TEXT" | "SINGLE_CHOICE" | "MULTI_CHOICE";

type QuestionDraft = {
  order: number;
  questionText: string;
  questionType: QuestionType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  validation?: Record<string, unknown>;
};

type QuestionnaireDraft = {
  title: string;
  description?: string;
  isActive: boolean;
  questions: QuestionDraft[];
};

// Question type renderer
function renderQuestionPreview(question: QuestionDraft) {
  const typeIcons = {
    FREE_TEXT: <MessageSquare className="h-5 w-5 text-blue-500" />,
    SINGLE_CHOICE: <CheckCircle2 className="h-5 w-5 text-purple-500" />,
    MULTI_CHOICE: <ListChecks className="h-5 w-5 text-teal-500" />,
  };

  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="flex-shrink-0 mt-0.5">{typeIcons[question.questionType]}</div>
      <div className="flex-1 space-y-2">
        <div className="text-slate-900 font-medium">{question.questionText}</div>
        
        {question.helpText && (
          <div className="text-slate-600 text-xs italic">💡 {question.helpText}</div>
        )}
        
        {question.placeholder && (
          <div className="text-slate-500 text-xs">Placeholder: "{question.placeholder}"</div>
        )}

        {question.options && question.options.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-600 uppercase">Options:</div>
            <div className="flex flex-wrap gap-1.5">
              {question.options.map((option, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200"
                >
                  {option}
                </span>
              ))}
            </div>
          </div>
        )}

        {question.validation && Object.keys(question.validation).length > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
            Validation: {JSON.stringify(question.validation)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIQuestionnairePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<QuestionnaireDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function generate() {
    if (!input.trim()) {
      setError("Please enter a questionnaire description");
      return;
    }

    setGenerating(true);
    setError(null);
    setDraft(null);

    try {
      const r = await fetch("/api/agent/questionnaire/parse", {
        method: "POST",
        body: JSON.stringify({ userInput: input }),
        headers: { "Content-Type": "application/json" },
      });

      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${r.statusText}`);
      }

      const text = await r.text();
      if (!text) {
        throw new Error("API returned empty response");
      }

      const data = JSON.parse(text);
      setDraft(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!draft) return;

    setSaving(true);
    setError(null);

    try {
      const r = await fetch("/api/agent/questionnaire/save", {
        method: "POST",
        body: JSON.stringify(draft),
        headers: { "Content-Type": "application/json" },
      });

      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(errorData.error || `Save failed: ${r.statusText}`);
      }

      await r.json();
      setSuccess(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/questionnaires");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/questionnaires"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-3 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Questionnaires
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg">
                <Sparkles className="h-6 w-6" />
              </span>
              AI Questionnaire Generator
            </h1>
            <p className="text-slate-600 mt-2">
              Describe your questionnaire, AI will generate it automatically
            </p>
          </div>
        </div>

        {/* Input Section */}
        <div className="rounded-2xl border-2 border-white bg-white/80 backdrop-blur-sm p-6 shadow-xl">
          <label className="block mb-3">
            <span className="text-sm font-bold text-slate-900 mb-2 block">
              Questionnaire Description
            </span>
            <span className="text-xs text-slate-600 block mb-3">
              Describe the questions you want in your questionnaire using natural language
            </span>
            <textarea
              className="w-full border-2 border-slate-200 rounded-xl p-4 h-40 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
              placeholder={`Example:
"Client intake form: name, email, phone, case type (family/criminal/civil), describe the case, have you hired attorney before, how did you hear about us"

Or in Turkish:
"Boşanma formu: isim, telefon, evlilik tarihi, çocuk var mı (evet/hayır), mal rejimi (mal ayrılığı/paylaşım/edinilmiş)"`}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              disabled={generating}
            />
          </label>

          {error && (
            <div className="mb-4 rounded-lg border-2 border-red-200 bg-red-50 p-4 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border-2 border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-center gap-2">
              <CheckCheck className="h-5 w-5" />
              Questionnaire successfully created! Redirecting...
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={generate}
              disabled={generating || !input.trim()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-bold text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate Draft
                </>
              )}
            </button>

            {draft && !success && (
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-5 w-5" />
                    Approve & Save
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Generated Draft Preview */}
        {draft && (
          <div className="rounded-2xl border-2 border-white bg-white/80 backdrop-blur-sm p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{draft.title}</h2>
                {draft.description && (
                  <p className="text-sm text-slate-600 mt-1">{draft.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  {draft.questions.length} Question{draft.questions.length !== 1 ? "s" : ""}
                </span>
                {draft.isActive && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                    Active
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {draft.questions.map((question, index) => (
                <div
                  key={question.order}
                  className="relative flex flex-col rounded-lg border-2 border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm hover:border-slate-300 transition-colors"
                >
                  <div className="absolute -left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-xs font-bold text-white border-2 border-white shadow-md">
                    {index + 1}
                  </div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 pr-4">{renderQuestionPreview(question)}</div>
                    <div className="flex flex-wrap gap-1.5 text-xs flex-shrink-0">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700 border border-blue-200">
                        {question.questionType.replace(/_/g, " ")}
                      </span>
                      {question.required && (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700 border border-amber-200">
                          Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!draft && !generating && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 backdrop-blur-sm p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100">
                <Sparkles className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Describe your questionnaire
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  AI will automatically generate questions based on your description
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
