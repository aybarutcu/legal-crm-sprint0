// app/(dashboard)/questionnaires/ai/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCheck, ArrowLeft, MessageSquare, ListChecks, CheckCircle2, FileText, Scale, Users, Heart, Car, Home, Briefcase } from "lucide-react";
import Link from "next/link";

type QuestionType = "FREE_TEXT" | "SINGLE_CHOICE" | "MULTI_CHOICE";

// Pre-generated questionnaire templates
const QUESTIONNAIRE_TEMPLATES = [
  {
    icon: FileText,
    title: "Client Intake Form",
    description: "General client onboarding questionnaire",
    prompt: `Client intake form: full name, email address, phone number, mailing address (street, city, state, zip), how did you hear about us (referral/online search/social media/advertisement/other), case type (family law/criminal defense/civil litigation/personal injury/real estate/business law/estate planning/other), brief description of your case or legal issue, have you consulted with or hired an attorney before (yes/no), if yes please explain, urgency level (immediate/within a week/within a month/no rush), preferred contact method (email/phone/text message), best time to contact you (morning/afternoon/evening/any time)`,
    color: "from-blue-500 to-indigo-600"
  },
  {
    icon: Heart,
    title: "Divorce/Family Law",
    description: "Divorce and custody questionnaire",
    prompt: `Divorce questionnaire: full name, spouse's full name, date of marriage, marriage location (city, state, country), current marital status (separated/living together/living apart), date of separation if applicable, do you have minor children from this marriage (yes/no), if yes list children's names and birthdates, are you seeking custody (sole/joint/primary/no preference), property ownership (who owns the house/cars/other major assets), is there a prenuptial agreement (yes/no), grounds for divorce (irreconcilable differences/adultery/abandonment/other), property division preference (equal split/keep separate/negotiate), spousal support request (seeking/not seeking/unsure), are there any domestic violence issues (yes/no), attorneys already contacted (yes/no), additional concerns or questions`,
    color: "from-pink-500 to-rose-600"
  },
  {
    icon: Car,
    title: "Personal Injury",
    description: "Accident and injury intake form",
    prompt: `Personal injury intake: full name, date of birth, contact phone and email, date of incident, time of incident, location of incident (street address, city, state), type of incident (car accident/slip and fall/workplace injury/medical malpractice/product liability/other), describe what happened in detail, injuries sustained, did you receive medical treatment (yes/no), if yes list hospitals or doctors visited, are you still receiving treatment (yes/no), was a police report filed (yes/no), if yes provide report number, witnesses present (yes/no), if yes list witness names and contact info, other parties involved, insurance information (your insurance company and policy number), have you contacted the other party's insurance (yes/no), lost time from work (yes/no), if yes how many days, vehicle damage if applicable, photos or evidence available (yes/no), prior injuries or medical conditions in same area (yes/no), have you spoken to other attorneys (yes/no)`,
    color: "from-orange-500 to-red-600"
  },
  {
    icon: Scale,
    title: "Criminal Defense",
    description: "Criminal case intake questionnaire",
    prompt: `Criminal defense intake: full name, date of birth, contact information, date of arrest or citation, location of arrest (city, state), charges filed (if known), arresting agency (police department/sheriff/state police/federal), case number or citation number, have you been arraigned (yes/no), if yes what is your bail status (released on own recognizance/bail posted/still in custody/no bail set), court date if scheduled, assigned court location, do you have a public defender (yes/no), prior criminal history (yes/no), if yes please describe, employment status, are you a student (yes/no), military service (yes/no), describe the incident from your perspective, were there witnesses (yes/no), if yes list names and contact info, evidence or documentation you have, statements made to police (yes/no), did you sign anything (yes/no), immediate concerns or questions`,
    color: "from-purple-500 to-violet-600"
  },
  {
    icon: Home,
    title: "Real Estate Transaction",
    description: "Property purchase or sale questionnaire",
    prompt: `Real estate transaction: your name, are you buying or selling, property address, property type (single family/condo/townhouse/multi-family/commercial/land), purchase price or asking price, financing method (cash/conventional mortgage/FHA/VA/other), pre-approved for financing (yes/no), if yes approval amount, down payment amount, desired closing date, property inspection completed (yes/no), inspection contingencies, appraisal contingency (yes/no), selling current home (yes/no), real estate agent involved (yes/no), if yes agent name and contact, title company preference (if any), homeowners association (yes/no), if yes HOA name and fees, known property issues or disclosures, additional terms or requests, urgency level (flexible/moderate/urgent), questions or concerns`,
    color: "from-teal-500 to-cyan-600"
  },
  {
    icon: Briefcase,
    title: "Business Formation",
    description: "New business setup questionnaire",
    prompt: `Business formation: your name and contact information, proposed business name (first choice and alternates), business type (LLC/corporation/partnership/sole proprietorship), state of formation, business purpose or industry, number of owners or partners, ownership percentages, will you have employees initially (yes/no), expected number of employees, anticipated annual revenue, business location or address, home-based business (yes/no), funding source (personal savings/investors/loans/other), do you need an EIN (yes/no), special licenses or permits needed (yes/no), intellectual property to protect (trademarks/patents/copyrights/none), existing business or starting new, fiscal year preference (calendar year/other), registered agent needed (yes/no), additional services needed (operating agreement/bylaws/contracts/other), questions or special requirements`,
    color: "from-emerald-500 to-green-600"
  },
  {
    icon: Users,
    title: "Estate Planning",
    description: "Will and estate planning intake",
    prompt: `Estate planning intake: full name, date of birth, marital status (single/married/divorced/widowed), spouse name if married, spouse date of birth, children names and birthdates, grandchildren (yes/no), if yes list names, total estate value estimate, primary assets (real estate/investments/business/retirement accounts/life insurance), real property locations (list states), do you have existing will (yes/no), if yes date created, do you have existing trust (yes/no), if yes type of trust, executor preference (who should manage your estate), guardian for minor children if applicable, beneficiaries and their relationship to you, specific bequests or gifts, charitable giving intentions (yes/no), healthcare directive or living will (yes/no), power of attorney designated (yes/no), if yes who, funeral or burial preferences, special instructions or concerns, family dynamics or potential disputes, questions about estate planning`,
    color: "from-indigo-500 to-blue-600"
  }
];


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

  // Handler to use a template
  const useTemplate = (prompt: string) => {
    setInput(prompt);
    setError(null);
    setDraft(null);
  };

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

        {/* Quick Templates */}
        <div className="rounded-2xl border-2 border-white bg-white/80 backdrop-blur-sm p-6 shadow-xl">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Quick Start Templates</h2>
            <p className="text-sm text-slate-600">Click any template to generate a pre-configured questionnaire</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {QUESTIONNAIRE_TEMPLATES.map((template, index) => {
              const Icon = template.icon;
              return (
                <button
                  key={index}
                  onClick={() => useTemplate(template.prompt)}
                  disabled={generating}
                  className="group relative flex flex-col items-start gap-3 rounded-xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-left transition-all hover:border-slate-300 hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${template.color} text-white shadow-md group-hover:shadow-lg transition-shadow`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 text-sm mb-1">{template.title}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{template.description}</p>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                  </div>
                </button>
              );
            })}
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
