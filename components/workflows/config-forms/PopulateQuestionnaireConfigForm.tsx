"use client";

import { useState, useEffect } from "react";
import { FileQuestion } from "lucide-react";

interface QuestionnaireOption {
  id: string;
  title: string;
  questionCount: number;
  isActive: boolean;
}

interface PopulateQuestionnaireConfigFormProps {
  initialConfig: {
    questionnaireId?: string | null;
    title?: string;
    description?: string;
    dueInDays?: number;
  };
  onChange: (config: { 
    questionnaireId: string; 
    title: string;
    description?: string;
    dueInDays?: number;
  }) => void;
}

export function PopulateQuestionnaireConfigForm({
  initialConfig,
  onChange,
}: PopulateQuestionnaireConfigFormProps) {
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(initialConfig.questionnaireId || "");
  const [title, setTitle] = useState(initialConfig.title || "");
  const [description, setDescription] = useState(initialConfig.description || "");
  const [dueInDays, setDueInDays] = useState<number | undefined>(initialConfig.dueInDays);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuestionnaires() {
      try {
        const response = await fetch("/api/questionnaires?isActive=true");
        if (!response.ok) {
          throw new Error("Failed to load questionnaires");
        }
        const data = await response.json();
        const items = data.questionnaires.map((q: {
          id: string;
          title: string;
          isActive: boolean;
          _count: { questions: number };
        }) => ({
          id: q.id,
          title: q.title,
          questionCount: q._count.questions,
          isActive: q.isActive,
        }));
        setQuestionnaires(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load questionnaires");
      } finally {
        setLoading(false);
      }
    }

    void fetchQuestionnaires();
  }, []);

  // Trigger onChange when any field changes
  useEffect(() => {
    if (selectedId && title) {
      onChange({
        questionnaireId: selectedId,
        title,
        description: description || undefined,
        dueInDays: dueInDays && dueInDays > 0 ? dueInDays : undefined,
      });
    }
  }, [selectedId, title, description, dueInDays, onChange]);

  const handleSelectionChange = (questionnaireId: string) => {
    setSelectedId(questionnaireId);
    const selected = questionnaires.find((q) => q.id === questionnaireId);
    if (selected && !title) {
      // Auto-populate title if empty
      setTitle(`Complete ${selected.title}`);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">Questionnaires loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (questionnaires.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          No active questionnaires available. Create a questionnaire first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Questionnaire Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Select Questionnaire <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedId}
          onChange={(e) => handleSelectionChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">-- Select a questionnaire --</option>
          {questionnaires.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title} ({q.questionCount} questions)
            </option>
          ))}
        </select>
      </div>

      {/* Title Field */}
      <div>
        <label htmlFor="questionnaireTitle" className="block text-sm font-medium text-slate-700 mb-1">
          Step Title <span className="text-red-500">*</span>
        </label>
        <input
          id="questionnaireTitle"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Complete Client Intake Form"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          The title shown to users for this workflow step
        </p>
      </div>

      {/* Description Field */}
      <div>
        <label htmlFor="questionnaireDesc" className="block text-sm font-medium text-slate-700 mb-1">
          Description
        </label>
        <textarea
          id="questionnaireDesc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional guidance for completing this questionnaire..."
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <p className="mt-1 text-xs text-slate-500">
          Optional instructions or context for the user
        </p>
      </div>

      {/* Due In Days Field */}
      <div>
        <label htmlFor="questionnaireDue" className="block text-sm font-medium text-slate-700 mb-1">
          Due In Days
        </label>
        <input
          id="questionnaireDue"
          type="number"
          min="0"
          value={dueInDays ?? ""}
          onChange={(e) => setDueInDays(e.target.value ? parseInt(e.target.value, 10) : undefined)}
          placeholder="e.g., 7"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <p className="mt-1 text-xs text-slate-500">
          Number of days from step start until due (optional)
        </p>
      </div>

      {/* Preview */}
      {selectedId && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <FileQuestion className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-900">
              {questionnaires.find((q) => q.id === selectedId)?.title}
            </p>
            <p className="mt-1 text-xs text-purple-700">
              {questionnaires.find((q) => q.id === selectedId)?.questionCount} questions · 
              Client will complete this questionnaire
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
