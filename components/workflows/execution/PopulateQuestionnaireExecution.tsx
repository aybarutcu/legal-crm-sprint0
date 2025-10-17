"use client";

import { useState, useEffect } from "react";
import { FileQuestion, CheckCircle, AlertCircle } from "lucide-react";

interface Question {
  id: string;
  questionText: string;
  questionType: "FREE_TEXT" | "SINGLE_CHOICE" | "MULTI_CHOICE";
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string[] | null | unknown; // Can be JSON from API
}

interface PopulateQuestionnaireExecutionProps {
  step: {
    id: string;
    actionData: Record<string, unknown> | null;
  };
  matterId: string;
  onComplete: (payload: { responseId: string }) => void;
  isLoading: boolean;
}

export function PopulateQuestionnaireExecution({
  step,
  matterId,
  onComplete,
  isLoading,
}: PopulateQuestionnaireExecutionProps) {
  const config = (step.actionData as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
  const questionnaireId = config?.questionnaireId as string | undefined;
  const questionnaireName = config?.questionnaireName as string | undefined;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Helper function to safely get options as array
  const getOptionsArray = (options: string[] | null | unknown): string[] => {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    // If it's a JSON object, try to parse or return empty
    if (typeof options === "object") {
      // It might already be parsed, try to extract array
      console.warn("Question options is an object but not an array:", options);
      return [];
    }
    return [];
  };

  useEffect(() => {
    if (!questionnaireId) {
      setError("No questionnaire configured");
      setLoading(false);
      return;
    }

    async function fetchQuestionnaire() {
      try {
        const response = await fetch(`/api/questionnaires/${questionnaireId}`);
        if (!response.ok) {
          throw new Error("Failed to load questionnaire");
        }
        const data = await response.json();
        setQuestions(data.questionnaire.questions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load questionnaire");
      } finally {
        setLoading(false);
      }
    }

    void fetchQuestionnaire();
  }, [questionnaireId]);

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // Clear validation error when user provides input
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const handleSubmit = async () => {
    // Validate all required questions are answered
    const errors: Record<string, string> = {};
    questions.forEach((q) => {
      if (q.required) {
        const answer = answers[q.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0) || (typeof answer === "string" && !answer.trim())) {
          errors[q.id] = "This question is required";
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      // Format answers for API
      const formattedAnswers = questions.map((q) => {
        const answer = answers[q.id];
        if (q.questionType === "FREE_TEXT") {
          return {
            questionId: q.id,
            answerText: typeof answer === "string" ? answer : "",
          };
        } else {
          return {
            questionId: q.id,
            answerJson: answer || [],
          };
        }
      });

      // Step 1: Create questionnaire response
      const createResponse = await fetch("/api/questionnaire-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaireId,
          matterId,
        }),
      });

      if (!createResponse.ok) {
        const data = await createResponse.json().catch(() => null);
        throw new Error(data?.error || "Failed to create questionnaire response");
      }

      const { response: createdResponse } = await createResponse.json();

      // Step 2: Save answers
      const saveAnswersResponse = await fetch(`/api/questionnaire-responses/${createdResponse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: formattedAnswers,
        }),
      });

      if (!saveAnswersResponse.ok) {
        const data = await saveAnswersResponse.json().catch(() => null);
        throw new Error(data?.error || "Failed to save answers");
      }

      // Step 3: Mark as completed
      const completeResponse = await fetch(`/api/questionnaire-responses/${createdResponse.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!completeResponse.ok) {
        const data = await completeResponse.json().catch(() => null);
        throw new Error(data?.error || "Failed to complete questionnaire");
      }
      
      // Pass the responseId to the completion handler
      onComplete({ responseId: createdResponse.id });
    } catch (err) {
      console.error("Failed to submit questionnaire:", err);
      setError(err instanceof Error ? err.message : "Failed to submit questionnaire");
      setSubmitting(false);
    }
  };

  const allRequiredAnswered = questions
    .filter((q) => q.required)
    .every((q) => {
      const answer = answers[q.id];
      return answer && (Array.isArray(answer) ? answer.length > 0 : answer.trim().length > 0);
    });

  if (loading) {
    return (
      <div className="mt-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
        <p className="text-sm text-blue-700">Loading questionnaire...</p>
      </div>
    );
  }

  if (error || !questionnaireId) {
    return (
      <div className="mt-3 rounded-lg border-2 border-red-200 bg-red-50/50 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error || "Questionnaire not configured"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileQuestion className="h-5 w-5 text-blue-600" />
        <h5 className="font-semibold text-blue-900">{questionnaireName || "Questionnaire"}</h5>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="rounded-lg border border-blue-200 bg-white p-4">
            {/* Question Header */}
            <div className="flex items-start gap-2 mb-2">
              <span className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded-full font-semibold text-xs flex-shrink-0">
                {index + 1}
              </span>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-900">
                  {question.questionText}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {question.helpText && (
                  <p className="mt-1 text-xs text-slate-600">{question.helpText}</p>
                )}
              </div>
            </div>

            {/* Question Input */}
            <div className="ml-8">
              {question.questionType === "FREE_TEXT" && (
                <textarea
                  value={(answers[question.id] as string) || ""}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder={question.placeholder || "Enter your answer..."}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              )}

              {question.questionType === "SINGLE_CHOICE" && (
                <div className="space-y-2">
                  {getOptionsArray(question.options).length > 0 ? (
                    getOptionsArray(question.options).map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 p-2 rounded border border-slate-200 hover:bg-blue-50 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={(answers[question.id] as string) === option}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="h-4 w-4 text-blue-600 border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    ))
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                      ⚠️ No options configured for this question. Please contact an administrator.
                    </div>
                  )}
                </div>
              )}

              {question.questionType === "MULTI_CHOICE" && (
                <div className="space-y-2">
                  {getOptionsArray(question.options).length > 0 ? (
                    getOptionsArray(question.options).map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 p-2 rounded border border-slate-200 hover:bg-blue-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          value={option}
                          checked={((answers[question.id] as string[]) || []).includes(option)}
                          onChange={(e) => {
                            const currentAnswers = (answers[question.id] as string[]) || [];
                            const newAnswers = e.target.checked
                              ? [...currentAnswers, option]
                              : currentAnswers.filter((a) => a !== option);
                            handleAnswerChange(question.id, newAnswers);
                          }}
                          className="h-4 w-4 text-blue-600 border-slate-300 rounded"
                        />
                        <span className="text-sm text-slate-700">{option}</span>
                      </label>
                    ))
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                      ⚠️ No options configured for this question. Please contact an administrator.
                    </div>
                  )}
                </div>
              )}

              {validationErrors[question.id] && (
                <p className="mt-2 text-xs text-red-600">{validationErrors[question.id]}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-xs text-blue-700">
          {questions.filter((q) => q.required).length} required questions
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allRequiredAnswered || isLoading || submitting}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle className="h-4 w-4" />
          {submitting ? "Submitting..." : isLoading ? "Processing..." : "Submit Questionnaire"}
        </button>
      </div>
    </div>
  );
}
