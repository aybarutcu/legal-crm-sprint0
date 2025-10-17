// app/(dashboard)/workflows/ai/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TWorkflowTemplateDraft } from "@/lib/workflows/schema";
import { CheckCircle, UserCheck, FileText, Upload, CreditCard, Sparkles, Loader2, CheckCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Action config renderer (same as TemplateCard)
function renderActionConfig(actionType: string, config: Record<string, unknown>) {
  switch (actionType) {
    case "CHECKLIST": {
      const items = (config.items as { title: string; completed?: boolean }[]) || [];
      if (items.length === 0) return null;
      
      return (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-slate-700">
              <CheckCircle className="h-4 w-4 mt-0.5 text-slate-400 flex-shrink-0" />
              <span className="text-sm">{item.title}</span>
            </div>
          ))}
        </div>
      );
    }
    
    case "APPROVAL_LAWYER": {
      const message = config.message as string;
      const approverRole = config.approverRole as string;
      
      return (
        <div className="flex items-start gap-3 text-sm">
          <UserCheck className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-slate-700">
              <span className="font-medium text-slate-900">Approver:</span>{" "}
              <span className="text-blue-600 font-medium">{approverRole || "LAWYER"}</span>
            </div>
            {message && (
              <div className="text-slate-600 italic">"{message}"</div>
            )}
          </div>
        </div>
      );
    }
    
    case "SIGNATURE_CLIENT": {
      const provider = config.provider as string;
      const documentId = config.documentId as string;
      
      return (
        <div className="flex items-start gap-3 text-sm">
          <FileText className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-slate-700">
              <span className="font-medium text-slate-900">Provider:</span>{" "}
              <span className="text-purple-600 font-medium">{provider || "mock"}</span>
            </div>
            {documentId && (
              <div className="text-slate-600 text-xs font-mono">
                Document: {documentId}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    case "REQUEST_DOC_CLIENT": {
      const requestText = config.requestText as string;
      const acceptedTypes = (config.acceptedTypes as string[]) || [];
      
      return (
        <div className="flex items-start gap-3 text-sm">
          <Upload className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            {requestText && (
              <div className="text-slate-700">{requestText}</div>
            )}
            {acceptedTypes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {acceptedTypes.map((type, i) => (
                  <span key={i} className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 border border-orange-200">
                    {type}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    case "PAYMENT_CLIENT": {
      const amount = config.amount as number;
      const currency = (config.currency as string) || "USD";
      const provider = config.provider as string;
      
      return (
        <div className="flex items-start gap-3 text-sm">
          <CreditCard className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-slate-700">
              <span className="font-medium text-slate-900">Amount:</span>{" "}
              <span className="text-green-600 font-semibold text-base">
                {new Intl.NumberFormat('en-US', { 
                  style: 'currency', 
                  currency: currency 
                }).format(amount || 0)}
              </span>
            </div>
            {provider && (
              <div className="text-slate-600 text-xs">
                Provider: <span className="font-medium">{provider}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    default:
      return null;
  }
}

export default function AIWorkflowPage() {
    const router = useRouter();
    const [input, setInput] = useState("");
    const [draft, setDraft] = useState<TWorkflowTemplateDraft | null>(null);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    async function generate() {
        if (!input.trim()) {
            setError("Lütfen bir workflow açıklaması girin");
            return;
        }

        setGenerating(true);
        setError(null);
        setDraft(null);

        try {
            const r = await fetch("/api/agent/workflow/parse", {
                method: "POST",
                body: JSON.stringify({ userInput: input }),
                headers: { "Content-Type": "application/json" }
            });

            if (!r.ok) {
                throw new Error(`API error: ${r.statusText}`);
            }

            const text = await r.text();
            if (!text) {
                throw new Error("API returned empty response");
            }

            const data = JSON.parse(text);
            setDraft(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Bir hata oluştu");
        } finally {
            setGenerating(false);
        }
    }

    async function save() {
        if (!draft) return;
        
        setSaving(true);
        setError(null);

        try {
            const r = await fetch("/api/agent/workflow/save", {
                method: "POST",
                body: JSON.stringify(draft),
                headers: { "Content-Type": "application/json" }
            });

            if (!r.ok) {
                throw new Error(`Save failed: ${r.statusText}`);
            }

            await r.json(); // Template created successfully
            setSuccess(true);
            
            // Redirect after 2 seconds
            setTimeout(() => {
                router.push("/workflows/templates");
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Kaydetme başarısız");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <Link 
                            href="/workflows/templates"
                            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-3 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Workflow Templates'e Dön
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg">
                                <Sparkles className="h-6 w-6" />
                            </span>
                            AI ile Workflow Oluştur
                        </h1>
                        <p className="text-slate-600 mt-2">
                            Workflow'unuzu açıklayın, AI sizin için otomatik olarak oluştursun
                        </p>
                    </div>
                </div>

                {/* Input Section */}
                <div className="rounded-2xl border-2 border-white bg-white/80 backdrop-blur-sm p-6 shadow-xl">
                    <label className="block mb-3">
                        <span className="text-sm font-bold text-slate-900 mb-2 block">
                            Workflow Açıklaması
                        </span>
                        <span className="text-xs text-slate-600 block mb-3">
                            Workflow'unuzda hangi adımların olmasını istediğinizi doğal dille açıklayın
                        </span>
                        <textarea
                            className="w-full border-2 border-slate-200 rounded-xl p-4 h-40 text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                            placeholder={`Örnek:
"İlk görüşme sonrası: avukat onayı, müvekkil sözleşmeyi imzalasın, kimlik ve adres belgesi yüklensin, avans ödemesi alınsın, paralegal kontrol listesi çalışsın."`}
                            value={input}
                            onChange={e => {
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
                            Template başarıyla kaydedildi! Yönlendiriliyorsunuz...
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={generate} 
                            disabled={generating || !input.trim()}
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 text-sm font-bold text-white hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Oluşturuluyor...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-5 w-5" />
                                    Taslak Oluştur
                                </>
                            )}
                        </button>

                        {draft && !success && (
                            <button 
                                onClick={save} 
                                disabled={saving}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    <>
                                        <CheckCheck className="h-5 w-5" />
                                        Onayla & Kaydet
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
                                <h2 className="text-2xl font-bold text-slate-900">{draft.name}</h2>
                                {draft.description && (
                                    <p className="text-sm text-slate-600 mt-1">{draft.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                                    {draft.steps.length} Adım
                                </span>
                                {draft.isActive && (
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                        Aktif
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {draft.steps.map((step, index) => (
                                <div
                                    key={step.order}
                                    className="relative flex flex-col rounded-lg border-2 border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm hover:border-slate-300 transition-colors"
                                >
                                    <div className="absolute -left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-xs font-bold text-white border-2 border-white shadow-md">
                                        {index + 1}
                                    </div>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-semibold text-slate-900 text-base">{step.title}</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700 border border-blue-200">
                                                    {step.actionType.replace(/_/g, " ")}
                                                </span>
                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200">
                                                    {step.roleScope}
                                                </span>
                                                {step.required && (
                                                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700 border border-amber-200">
                                                        Required
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {step.actionConfig && Object.keys(step.actionConfig).length > 0 && renderActionConfig(step.actionType, step.actionConfig) && (
                                        <div className="mt-3 pt-3 border-t border-slate-200">
                                            {renderActionConfig(step.actionType, step.actionConfig)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!draft && !generating && (
                    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 backdrop-blur-sm p-12 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-blue-100">
                                <Sparkles className="h-8 w-8 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Workflow'unuzu açıklayın</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    AI, açıklamanıza göre otomatik olarak bir workflow template oluşturacak
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}