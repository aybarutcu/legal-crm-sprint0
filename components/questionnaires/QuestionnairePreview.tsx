"use client";

import React from "react";
import type { QuestionnaireDetail } from "./types";
import { FileText, CheckSquare, ListChecks } from "lucide-react";

interface QuestionnairePreviewProps {
  questionnaire: QuestionnaireDetail;
}

/**
 * QuestionnairePreview Component
 * 
 * Displays a read-only preview of a questionnaire showing how it will appear
 * to clients when they fill it out. Renders all questions with their types
 * and options in a form-like layout.
 */
export function QuestionnairePreview({ questionnaire }: QuestionnairePreviewProps) {
  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "FREE_TEXT":
        return <FileText className="w-4 h-4" />;
      case "SINGLE_CHOICE":
        return <CheckSquare className="w-4 h-4" />;
      case "MULTI_CHOICE":
        return <ListChecks className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "FREE_TEXT":
        return "Free Text";
      case "SINGLE_CHOICE":
        return "Single Choice";
      case "MULTI_CHOICE":
        return "Multiple Choice";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          {questionnaire.title}
        </h2>
        {questionnaire.description && (
          <p className="text-gray-600 whitespace-pre-wrap">
            {questionnaire.description}
          </p>
        )}
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
          <span>{questionnaire.questions.length} questions</span>
          <span>•</span>
          <span>Preview Mode</span>
        </div>
      </div>

      {/* Questions Section */}
      <div className="space-y-6">
        {questionnaire.questions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No questions in this questionnaire</p>
          </div>
        ) : (
          questionnaire.questions.map((question, index) => (
            <div
              key={question.id}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            >
              {/* Question Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="flex items-center justify-center w-8 h-8 bg-accent/10 text-accent rounded-full font-semibold text-sm flex-shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {question.questionText}
                    </h3>
                    {question.required && (
                      <span className="text-red-500 text-sm">*</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {getQuestionTypeIcon(question.questionType)}
                    <span>{getQuestionTypeLabel(question.questionType)}</span>
                  </div>
                </div>
              </div>

              {/* Help Text */}
              {question.helpText && (
                <p className="text-sm text-gray-600 mb-4 ml-11">
                  {question.helpText}
                </p>
              )}

              {/* Question Input Based on Type */}
              <div className="ml-11">
                {question.questionType === "FREE_TEXT" && (
                  <div>
                    <textarea
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 resize-none focus:outline-none cursor-not-allowed"
                      rows={4}
                      placeholder={question.placeholder || "Enter your answer here..."}
                      disabled
                    />
                  </div>
                )}

                {question.questionType === "SINGLE_CHOICE" && (
                  <div className="space-y-3">
                    {Array.isArray(question.options) && question.options.length > 0 ? (
                      question.options.map((option, optIndex) => (
                        <label
                          key={optIndex}
                          className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            className="w-4 h-4 text-accent border-gray-300 cursor-not-allowed"
                            disabled
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No options configured
                      </p>
                    )}
                  </div>
                )}

                {question.questionType === "MULTI_CHOICE" && (
                  <div className="space-y-3">
                    {Array.isArray(question.options) && question.options.length > 0 ? (
                      question.options.map((option, optIndex) => (
                        <label
                          key={optIndex}
                          className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-accent border-gray-300 rounded cursor-not-allowed"
                            disabled
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No options configured
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Information */}
      <div className="border-t border-gray-200 pt-6 text-sm text-gray-500">
        <p>
          This is a preview. Clients will see this questionnaire when assigned
          as part of a workflow task.
        </p>
      </div>
    </div>
  );
}
