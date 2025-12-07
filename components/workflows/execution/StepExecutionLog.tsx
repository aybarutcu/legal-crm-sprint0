"use client";

interface StepExecutionLogProps {
  step: {
    id: string;
    actionType: string;
    actionState: string;
    actionData: Record<string, unknown> | null;
    startedAt: string | Date | null;
    completedAt: string | Date | null;
  };
}

export function StepExecutionLog({ step }: StepExecutionLogProps) {
  const logs: Array<{ timestamp: Date; action: string; details?: string }> = [];
  
  // Add step lifecycle events
  if (step.startedAt) {
    logs.push({
      timestamp: new Date(step.startedAt),
      action: "Görev başlatıldı",
      details: undefined,
    });
  }
  
  if (step.completedAt) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actionData = step.actionData as any;
    let details = "";
    
    // Add action-specific completion details
    switch (step.actionType) {
      case "CHECKLIST":
        if (actionData?.payload?.checkedItems) {
          details = `${actionData.payload.checkedItems.length} madde tamamlandı`;
        }
        break;
      case "APPROVAL":
        if (actionData?.payload?.approved !== undefined) {
          details = actionData.payload.approved 
            ? `✓ Onaylandı${actionData.payload.comment ? `: "${actionData.payload.comment}"` : ""}`
            : `✗ Reddedildi${actionData.payload.comment ? `: "${actionData.payload.comment}"` : ""}`;
        }
        break;
      case "REQUEST_DOC":
        if (actionData?.payload?.uploadedFileId) {
          details = `Belge yüklendi: ${actionData.payload.originalFilename || actionData.payload.uploadedFileId}`;
        }
        break;
      case "SIGNATURE":
        if (actionData?.payload?.signedDocumentId) {
          details = `Belge imzalandı: ${actionData.payload.signedDocumentId}`;
        }
        break;
      case "PAYMENT":
        if (actionData?.payload?.transactionId) {
          details = `Ödeme tamamlandı: ${actionData.payload.amount} ${actionData.config?.currency || "TRY"}`;
        }
        break;
      case "WRITE_TEXT":
        if (actionData?.payload?.content) {
          const content = actionData.payload.content as string;
          const preview = content.length > 50 ? content.substring(0, 50) + "..." : content;
          details = `Metin yazıldı (${content.length} karakter): "${preview}"`;
        }
        break;
      case "POPULATE_QUESTIONNAIRE":
        if (actionData?.responseId) {
          const answerCount = actionData?.answerCount || 0;
          const questionnaireTitle = actionData?.questionnaireTitle || "Anket";
          details = `"${questionnaireTitle}" tamamlandı (${answerCount} soru yanıtlandı)`;
        }
        break;
    }
    
    logs.push({
      timestamp: new Date(step.completedAt),
      action: step.actionState === "COMPLETED" ? "Görev tamamlandı" : "Görev atlandı",
      details: details || undefined,
    });
  }
  
  if (logs.length === 0) {
    return (
      <div className="text-xs text-slate-400 italic">
        Henüz geçmiş yok
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {logs.map((log, idx) => (
        <div key={idx} className="text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">{log.action}</span>
            <span className="text-slate-400">
              {log.timestamp.toLocaleString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {log.details && (
            <div className="mt-0.5 text-slate-600 pl-2 border-l-2 border-slate-200">
              {log.details}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
