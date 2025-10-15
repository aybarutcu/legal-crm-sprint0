// app/(dashboard)/workflows/ai/page.tsx
"use client";
import { useState } from "react";
import type { TWorkflowTemplateDraft } from "@/lib/workflows/schema";

export default function AIWorkflowPage() {
    const [input, setInput] = useState("");
    const [draft, setDraft] = useState<TWorkflowTemplateDraft | null>(null);
    const [saving, setSaving] = useState(false);

    async function generate() {
        const r = await fetch("/api/agent/workflow/parse", {
            method: "POST",
            body: JSON.stringify({ userInput: input }),
            headers: { "Content-Type": "application/json" }
        });

        if (!r.ok) {
            alert("API error: " + r.statusText);
            return;
        }

        const text = await r.text();
        if (!text) {
            alert("API returned empty response.");
            return;
        }

        try {
            const data = JSON.parse(text);
            setDraft(data);
        } catch (err) {
            alert("API response is not valid JSON.");
        }
    }

    async function save() {
        if (!draft) return;
        setSaving(true);
        const r = await fetch("/api/agent/workflow/save", {
            method: "POST",
            body: JSON.stringify(draft),
            headers: { "Content-Type": "application/json" }
        });
        setSaving(false);
        const created = await r.json();
        alert(`Template kaydedildi: ${created.name} v${created.version}`);
    }

    return (
        <div className="p-6 space-y-4 max-w-3xl">
            <h1 className="text-2xl font-semibold">Metinden Workflow Oluştur</h1>

            <textarea
                className="w-full border rounded p-3 h-40"
                placeholder={`Örn: 
"İlk görüşme sonrası: avukat onayı, müvekkil sözleşmeyi imzalasın, kimlik ve adres belgesi yüklensin, avans ödemesi alınsın, paralegal kontrol listesi çalışsın."`}
                value={input}
                onChange={e => setInput(e.target.value)}
            />
            <div className="flex gap-2">
                <button onClick={generate} className="px-4 py-2 border rounded">
                    Taslak Oluştur
                </button>
                {draft && (
                    <button onClick={save} disabled={saving} className="px-4 py-2 border rounded">
                        {saving ? "Kaydediliyor..." : "Onayla & Kaydet"}
                    </button>
                )}
            </div>

            {draft && (
                <div className="border rounded p-4">
                    <h2 className="font-semibold">{draft.name} {draft.isActive ? "(Aktif)" : ""}</h2>
                    {draft.description && <p className="text-sm opacity-80">{draft.description}</p>}
                    <ol className="mt-3 space-y-2 list-decimal pl-6">
                        {draft.steps.map(s => (
                            <li key={s.order}>
                                <div className="font-medium">{s.title}</div>
                                <div className="text-xs opacity-75">
                                    actionType: {s.actionType} • roleScope: {s.roleScope} • required: {String(s.required)}
                                </div>
                                {s.actionConfig && Object.keys(s.actionConfig).length > 0 && (
                                    <pre className="text-xs bg-gray-50 p-2 rounded mt-1">{JSON.stringify(s.actionConfig, null, 2)}</pre>
                                )}
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}