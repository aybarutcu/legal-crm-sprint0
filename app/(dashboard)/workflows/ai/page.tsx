// app/(dashboard)/workflows/ai/page.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TWorkflowTemplateDraft } from "@/lib/workflows/schema";
import { Sparkles, Loader2, CheckCheck, ArrowLeft, Scale, Heart, Users, Home, Briefcase, Car, Gavel, FileText, Send, Edit3, Eye, MessageSquare } from "lucide-react";
import Link from "next/link";
import { WorkflowTemplatePreview } from "@/components/workflows/WorkflowTemplatePreview";
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas";
import type { WorkflowStep as CanvasWorkflowStep } from "@/components/workflows/WorkflowCanvas";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ViewMode = "preview" | "edit";

// Pre-generated workflow templates
const WORKFLOW_TEMPLATES = [
  {
    icon: Scale,
    title: "Client Onboarding",
    description: "Standard new client intake process",
    prompt: `Client onboarding workflow: lawyer reviews and approves new client, client signs engagement letter via e-signature, client uploads ID and proof of address documents, collect retainer payment, paralegal completes intake checklist (verify contact info, setup file, enter into system, schedule kickoff meeting), send welcome email`,
    color: "from-blue-500 to-indigo-600"
  },
  {
    icon: Heart,
    title: "Divorce Case",
    description: "Family law divorce proceedings workflow",
    prompt: `Divorce case workflow: client completes divorce questionnaire (marriage details, assets, children), lawyer reviews questionnaire and approves case direction, draft petition for divorce, lawyer reviews and approves petition, client reviews and approves petition via e-signature, file petition with court, client pays court filing fees, serve spouse with divorce papers, wait 30 days for response, checklist for discovery documents (financial statements, property deeds, bank statements, retirement accounts), negotiate settlement or prepare for trial`,
    color: "from-pink-500 to-rose-600"
  },
  {
    icon: Car,
    title: "Personal Injury Claim",
    description: "PI case from intake to settlement",
    prompt: `Personal injury workflow: client completes accident questionnaire, collect evidence (photos, police report, medical records, witness statements), lawyer reviews case and approves representation, client signs retainer agreement, send demand letter to insurance company, checklist for medical treatment documentation, negotiate settlement with insurance adjuster, lawyer approves settlement amount, client approves settlement via e-signature, receive settlement payment, distribute settlement funds (lawyer fees, medical liens, client portion), close case`,
    color: "from-orange-500 to-red-600"
  },
  {
    icon: Gavel,
    title: "Criminal Defense",
    description: "Criminal case representation workflow",
    prompt: `Criminal defense workflow: client completes intake questionnaire (charges, arrest details, court dates), collect retainer payment, lawyer reviews discovery from prosecutor, schedule client meeting to discuss strategy, checklist for evidence gathering (witness contacts, alibi information, character references), file pretrial motions if needed, lawyer approval for plea bargain or trial strategy, prepare client testimony if going to trial, court appearance checklist (prepare exhibits, witness list, opening statement), post-trial follow-up (sentencing, appeal options)`,
    color: "from-purple-500 to-violet-600"
  },
  {
    icon: Home,
    title: "Real Estate Closing",
    description: "Property purchase/sale transaction",
    prompt: `Real estate closing workflow: review purchase agreement, client completes property questionnaire, order title search, review title report and resolve any issues, schedule property inspection, review inspection report with client, lawyer approves contract terms, coordinate with lender for financing, client signs closing documents via e-signature, collect closing costs payment, final walkthrough checklist (utilities transferred, keys received, property condition verified), record deed with county, distribute funds, provide final closing package to client`,
    color: "from-teal-500 to-cyan-600"
  },
  {
    icon: Briefcase,
    title: "Business Formation",
    description: "New business entity setup",
    prompt: `Business formation workflow: client completes business questionnaire (entity type, owners, purpose), lawyer reviews and approves entity structure, draft articles of incorporation or LLC operating agreement, client reviews and approves documents, file formation documents with state, obtain EIN from IRS, checklist for post-formation tasks (business licenses, bank account, registered agent, business insurance), draft bylaws or operating agreement, client signs all formation documents, collect formation fees, deliver corporate book and completed documents`,
    color: "from-emerald-500 to-green-600"
  },
  {
    icon: Users,
    title: "Estate Planning",
    description: "Will and trust preparation workflow",
    prompt: `Estate planning workflow: client completes estate questionnaire (assets, beneficiaries, wishes), review existing documents if any, lawyer reviews questionnaire and recommends estate plan structure, draft will and/or trust documents, draft power of attorney and healthcare directive, lawyer reviews all documents, client reviews draft documents, schedule signing meeting, client signs all documents with witnesses and notary, checklist for post-signing (fund trust with assets, notify financial institutions, update beneficiaries, provide copies to executor and trustee), deliver final estate plan binder`,
    color: "from-indigo-500 to-blue-600"
  },
  {
    icon: FileText,
    title: "Contract Review",
    description: "Simple contract review and approval",
    prompt: `Contract review workflow: client uploads contract document, client provides context and concerns via questionnaire, lawyer reviews contract and identifies issues, lawyer prepares markup and comments, schedule meeting with client to discuss findings, negotiate revisions with other party, client approves final version via e-signature, deliver executed contract to all parties`,
    color: "from-slate-500 to-gray-600"
  }
];

export default function AIWorkflowPage() {
    const router = useRouter();
    const [input, setInput] = useState("");
    const [draft, setDraft] = useState<TWorkflowTemplateDraft | null>(null);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("preview");
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [refining, setRefining] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // Handler to use a template
    const useTemplate = (prompt: string) => {
        setInput(prompt);
        setError(null);
        setDraft(null);
        setChatMessages([]);
    };

    async function generate() {
        if (!input.trim()) {
            setError("Lütfen bir workflow açıklaması girin");
            return;
        }

        setGenerating(true);
        setError(null);
        setDraft(null);
        setChatMessages([]);

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
            setChatMessages([
                {
                    role: "user",
                    content: input,
                    timestamp: new Date(),
                },
                {
                    role: "assistant",
                    content: `"${data.name}" workflow'u oluşturdum. ${data.steps.length} adım ve ${data.dependencies?.length || 0} bağlantı içeriyor. İstersen düzenleyebilir veya değişiklik isteyebilirsin.`,
                    timestamp: new Date(),
                }
            ]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Bir hata oluştu");
        } finally {
            setGenerating(false);
        }
    }

    async function refineWorkflow() {
        if (!chatInput.trim() || !draft) return;

        setRefining(true);
        setError(null);

        const userMessage: ChatMessage = {
            role: "user",
            content: chatInput,
            timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, userMessage]);
        setChatInput("");

        try {
            // Build detailed current state including IDs and dependencies
            const currentStepsDetail = draft.steps.map(s => 
                `  - id: "${s.id}", title: "${s.title}", type: ${s.actionType}, role: ${s.roleScope}`
            ).join('\n');
            
            const currentDepsDetail = (draft.dependencies ?? []).map(d =>
                `  - "${d.sourceStepId}" → "${d.targetStepId}" (${d.dependencyType})`
            ).join('\n');

            const refinementPrompt = `I have a workflow that needs modification. Here is the CURRENT structure:

Workflow Name: ${draft.name}
Description: ${draft.description}

Current Steps (PRESERVE THESE IDs):
${currentStepsDetail}

Current Dependencies:
${currentDepsDetail || '  (none)'}

USER REQUEST: ${chatInput}

IMPORTANT INSTRUCTIONS:
1. When modifying existing steps, PRESERVE their original step IDs (e.g., "step_0", "step_1")
2. Only generate NEW step IDs for NEW steps you're adding
3. Update dependencies to use the correct step IDs
4. Maintain the same positionX/positionY for existing steps where possible
5. Return a complete updated workflow with ALL steps (modified + new + preserved)

Generate the updated workflow JSON.`;

            const r = await fetch("/api/agent/workflow/parse", {
                method: "POST",
                body: JSON.stringify({ userInput: refinementPrompt }),
                headers: { "Content-Type": "application/json" }
            });

            if (!r.ok) {
                throw new Error(`API error: ${r.statusText}`);
            }

            const data = JSON.parse(await r.text());
            setDraft(data);

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: `Workflow'u güncelledim. Artık ${data.steps.length} adım ve ${data.dependencies?.length || 0} bağlantı var. Başka bir değişiklik ister misin?`,
                timestamp: new Date(),
            };
            setChatMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Güncelleme başarısız");
            // Remove user message on error
            setChatMessages(prev => prev.slice(0, -1));
        } finally {
            setRefining(false);
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
        <div className="space-y-6 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 min-h-screen p-6">
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

                {/* Quick Templates */}
                <div className="rounded-2xl border-2 border-white bg-white/80 backdrop-blur-sm p-6 shadow-xl">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-slate-900 mb-1">Quick Start Templates</h2>
                        <p className="text-sm text-slate-600">Click any template to generate a pre-configured workflow</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {WORKFLOW_TEMPLATES.map((template, index) => {
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
                                        <Sparkles className="h-4 w-4 text-purple-600" />
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
                    </div>
                </div>

                {/* Generated Draft Preview/Editor */}
                {draft && (
                    <div className="rounded-2xl border-2 border-white bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden">
                        {/* Header with View Toggle */}
                        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b-2 border-slate-200">
                            <div className="flex-1 space-y-3">
                                {/* Editable Template Name */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Template Adı
                                    </label>
                                    <input
                                        type="text"
                                        value={draft.name}
                                        onChange={(e) => setDraft(prev => prev ? { ...prev, name: e.target.value } : null)}
                                        className="w-full text-2xl font-bold text-slate-900 border-2 border-slate-200 rounded-lg px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                                        placeholder="Workflow adını girin..."
                                    />
                                </div>
                                {/* Editable Description */}
                                {draft.description !== undefined && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">
                                            Açıklama (Opsiyonel)
                                        </label>
                                        <input
                                            type="text"
                                            value={draft.description || ''}
                                            onChange={(e) => setDraft(prev => prev ? { ...prev, description: e.target.value } : null)}
                                            className="w-full text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                                            placeholder="Template açıklaması..."
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                                        {draft.steps.length} Adım
                                    </span>
                                    {draft.dependencies && draft.dependencies.length > 0 && (
                                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                                            {draft.dependencies.length} Bağlantı
                                        </span>
                                    )}
                                    {draft.isActive && (
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                            Aktif
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                    <button
                                        onClick={() => setViewMode("preview")}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                            viewMode === "preview"
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                        Önizleme
                                    </button>
                                    <button
                                        onClick={() => setViewMode("edit")}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                            viewMode === "edit"
                                                ? "bg-white text-slate-900 shadow-sm"
                                                : "text-slate-600 hover:text-slate-900"
                                        }`}
                                    >
                                        <Edit3 className="h-3.5 w-3.5" />
                                        Düzenle
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Canvas Area */}
                        <div className="p-6">
                            {viewMode === "preview" ? (
                                <WorkflowTemplatePreview
                                    steps={draft.steps.map(s => ({
                                        id: s.id || `step_${s.order}`,
                                        title: s.title,
                                        order: s.order,
                                        actionType: s.actionType,
                                        roleScope: s.roleScope,
                                        required: s.required,
                                        actionConfig: s.actionConfig,
                                        positionX: s.positionX,
                                        positionY: s.positionY,
                                    }))}
                                    dependencies={draft.dependencies?.map(d => ({
                                        id: d.id || `dep_${d.sourceStepId}_${d.targetStepId}`,
                                        sourceStepId: d.sourceStepId,
                                        targetStepId: d.targetStepId,
                                        dependencyType: d.dependencyType,
                                        dependencyLogic: d.dependencyLogic,
                                        conditionType: d.conditionType,
                                        conditionConfig: d.conditionConfig,
                                    }))}
                                    height={500}
                                />
                            ) : (
                                <div className="rounded-xl border-2 border-slate-200 bg-slate-50" style={{ height: 500 }}>
                                    <WorkflowCanvas
                                        steps={draft.steps.map(s => {
                                            const stepId = s.id || `step_${s.order}`;
                                            return {
                                                id: stepId,
                                                title: s.title,
                                                actionType: s.actionType as any,
                                                roleScope: s.roleScope as any,
                                                required: s.required ?? true,
                                                actionConfig: s.actionConfig ?? {},
                                                positionX: s.positionX ?? 0,
                                                positionY: s.positionY ?? 0,
                                                notificationPolicies: s.notificationPolicies ?? [],
                                            };
                                        })}
                                        dependencies={(draft.dependencies ?? []).map(d => {
                                            const depId = d.id || `dep_${d.sourceStepId}_${d.targetStepId}`;
                                            return {
                                                id: depId,
                                                sourceStepId: d.sourceStepId,
                                                targetStepId: d.targetStepId,
                                                dependencyType: d.dependencyType,
                                                dependencyLogic: d.dependencyLogic,
                                                conditionType: d.conditionType,
                                                conditionConfig: d.conditionConfig,
                                            };
                                        })}
                                        onChange={(steps, deps) => {
                                            setDraft(prev => {
                                                if (!prev) return null;
                                                return {
                                                    ...prev,
                                                    steps: steps.map((s, idx) => ({
                                                        id: s.id,
                                                        order: idx,
                                                        title: s.title,
                                                        actionType: s.actionType as any,
                                                        roleScope: s.roleScope as any,
                                                        required: s.required ?? true,
                                                        actionConfig: s.actionConfig as any ?? {},
                                                        positionX: s.positionX ?? 0,
                                                        positionY: s.positionY ?? 0,
                                                        notificationPolicies: s.notificationPolicies as any ?? [],
                                                    })),
                                                    dependencies: (deps ?? []).map(d => ({
                                                        id: d.id,
                                                        sourceStepId: d.sourceStepId,
                                                        targetStepId: d.targetStepId,
                                                        dependencyType: d.dependencyType as any,
                                                        dependencyLogic: d.dependencyLogic as any,
                                                        conditionType: d.conditionType as any,
                                                        conditionConfig: d.conditionConfig as any,
                                                    }))
                                                } as any;
                                            });
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Chat Interface */}
                        {chatMessages.length > 0 && (
                            <div className="border-t-2 border-slate-200 bg-slate-50/50">
                                <div className="p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <MessageSquare className="h-4 w-4 text-slate-600" />
                                        <h3 className="text-sm font-semibold text-slate-900">AI ile İyileştir</h3>
                                    </div>
                                    
                                    {/* Chat Messages */}
                                    <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                                        {chatMessages.map((msg, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                                                        msg.role === "user"
                                                            ? "bg-purple-600 text-white"
                                                            : "bg-white border border-slate-200 text-slate-900"
                                                    }`}
                                                >
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>

                                    {/* Chat Input */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    refineWorkflow();
                                                }
                                            }}
                                            placeholder="Değişiklik iste... (örn: 'bir ödeme adımı ekle' veya 'ilk adımı kaldır')"
                                            disabled={refining}
                                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50"
                                        />
                                        <button
                                            onClick={refineWorkflow}
                                            disabled={refining || !chatInput.trim()}
                                            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {refining ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Güncelleniyor...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="h-4 w-4" />
                                                    <span>Gönder</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Save Button - Fixed at Bottom */}
                        {!success && (
                            <div className="border-t-2 border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-600">
                                        Workflow hazır mı? Kaydet ve kullanmaya başla!
                                    </p>
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
                                </div>
                            </div>
                        )}
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
    );
}