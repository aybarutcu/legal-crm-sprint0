"use client";

import { useEffect, useState } from "react";
import { FileQuestion, CheckCircle2, AlertCircle } from "lucide-react";

interface Question {
  id: string;
  questionText: string;
  questionType: "FREE_TEXT" | "SINGLE_CHOICE" | "MULTI_CHOICE";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any; // JSON from database
  required: boolean;
}

interface Answer {
  id: string;
  questionId: string;
  answerText: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answerJson: any; // JSON from database
  question: Question;
}

interface QuestionnaireResponse {
  id: string;
  status: string;
  completedAt: string | null;
  questionnaire: {
    id: string;
    title: string;
  };
  answers: Answer[];
  respondent: {
    id: string;
    name: string;
    email: string;
  };
}

interface QuestionnaireResponseViewerProps {
  responseId: string;
}

export function QuestionnaireResponseViewer({ responseId }: QuestionnaireResponseViewerProps) {
  const [response, setResponse] = useState<QuestionnaireResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to safely convert answerJson to array
  const getAnswerArray = (answerJson: string[] | null | unknown): string[] => {
    if (!answerJson) return [];
    if (Array.isArray(answerJson)) return answerJson as string[];
    if (typeof answerJson === 'string') return [answerJson];
    return [];
  };

  useEffect(() => {
    const fetchResponse = async () => {
      try {
        const res = await fetch(`/api/questionnaire-responses/${responseId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch response");
        }
        const data = await res.json();
        setResponse(data.response);
      } catch (err) {
        console.error("Error fetching questionnaire response:", err);
        setError(err instanceof Error ? err.message : "Failed to load response");
      } finally {
        setLoading(false);
      }
    };

    void fetchResponse();
  }, [responseId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <FileQuestion className="h-5 w-5 text-purple-600 animate-pulse" />
          <p className="text-sm text-slate-600">Loading questionnaire response...</p>
        </div>
      </div>
    );
  }

  if (error || !response) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error || "Response not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <FileQuestion className="h-5 w-5 text-purple-600" />
        <h4 className="font-semibold text-slate-900">{response.questionnaire.title}</h4>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-200">
          Completed
        </span>
      </div>

      {/* Answers */}
      <div className="space-y-3">
        {(response.answers as Answer[]).map((answer, idx) => (
          <div key={answer.id} className="bg-white rounded-lg border border-slate-200 p-3">
            <div className="flex items-start gap-3">
              {/* Question Number */}
              <div className="flex items-center justify-center w-6 h-6 bg-purple-100 text-purple-700 rounded-full font-semibold text-xs flex-shrink-0 mt-0.5">
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                {/* Question Text */}
                <p className="text-sm font-medium text-slate-900 mb-2">
                  {answer.question.questionText}
                  {answer.question.required && <span className="text-red-500 ml-1">*</span>}
                </p>

                {/* FREE_TEXT Answer */}
                {answer.answerText && (
                  <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{answer.answerText}</p>
                  </div>
                )}

                {/* SINGLE_CHOICE / MULTI_CHOICE Answer */}
                {answer.answerJson && (
                  <div className="mt-2 space-y-1.5">
                    {getAnswerArray(answer.answerJson).map(
                      (option: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-slate-700">{option}</span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Empty answer indicator */}
                {!answer.answerText && !answer.answerJson && (
                  <p className="text-sm text-slate-400 italic">No answer provided</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Metadata Footer */}
      <div className="mt-4 pt-3 border-t border-purple-200 flex items-center justify-between text-xs text-slate-500">
        <span>Completed by {response.respondent.name}</span>
        {response.completedAt && (
          <span>{new Date(response.completedAt).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
