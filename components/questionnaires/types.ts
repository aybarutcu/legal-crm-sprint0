import type { QuestionType } from "@prisma/client";

export type QuestionnaireListItem = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  _count: {
    questions: number;
    responses: number;
  };
};

export type QuestionnaireDetail = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  questions: QuestionDetail[];
  _count: {
    responses: number;
  };
};

export type QuestionDetail = {
  id: string;
  questionnaireId: string;
  questionText: string;
  questionType: QuestionType;
  order: number;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string[] | null;
  validation: Record<string, unknown> | null;
};

export type CreateQuestionnaireInput = {
  title: string;
  description?: string;
  questions: CreateQuestionInput[];
};

export type CreateQuestionInput = {
  questionText: string;
  questionType: QuestionType;
  order: number;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  validation?: Record<string, unknown>;
};

export type UpdateQuestionnaireInput = {
  title?: string;
  description?: string;
  isActive?: boolean;
  questions?: CreateQuestionInput[];
};
