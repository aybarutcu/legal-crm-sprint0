import { CheckCircle, FileText, CreditCard, Upload, UserCheck, FileEdit, FileQuestion, CheckCheck } from "lucide-react";

type ActionConfigDisplayProps = {
  actionType: string;
  config: Record<string, unknown>;
  variant?: "compact" | "default";
};

/**
 * Shared component for displaying action configurations.
 * Used in both workflow templates and workflow instances.
 * 
 * Supports all action types:
 * - TASK: Shows task description, time estimate, and evidence requirement
 * - CHECKLIST: Shows list of items with checkmarks
 * - APPROVAL_LAWYER: Shows approver role and message
 * - SIGNATURE_CLIENT: Shows provider and document ID
 * - REQUEST_DOC_CLIENT: Shows request text and document names
 * - PAYMENT_CLIENT: Shows amount, currency, and provider
 * - WRITE_TEXT: Shows title, description, and length requirements
 * - POPULATE_QUESTIONNAIRE: Shows questionnaire title and description
 */
export function ActionConfigDisplay({ 
  actionType, 
  config, 
  variant = "default" 
}: ActionConfigDisplayProps) {
  
  // Return null if no config provided
  if (!config || Object.keys(config).length === 0) {
    return (
      <div className="text-xs text-slate-400 italic">
        No configuration
      </div>
    );
  }

  switch (actionType) {
    case "TASK": {
      const description = config.description as string;
      const requiresEvidence = config.requiresEvidence as boolean;
      const estimatedMinutes = config.estimatedMinutes as number;
      
      return (
        <div className={`flex items-start gap-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
          <CheckCheck className={`${variant === "compact" ? "h-4 w-4" : "h-5 w-5"} text-cyan-500 flex-shrink-0 mt-0.5`} />
          <div className="space-y-1">
            {description && (
              <div className="text-slate-700">{description}</div>
            )}
            {(estimatedMinutes || requiresEvidence) && (
              <div className="flex flex-wrap gap-1.5">
                {estimatedMinutes && (
                  <span 
                    className={`inline-flex items-center rounded-md bg-cyan-50 px-2 py-0.5 font-medium text-cyan-700 border border-cyan-200 ${
                      variant === "compact" ? "text-[10px]" : "text-xs"
                    }`}
                  >
                    ~{estimatedMinutes} min
                  </span>
                )}
                {requiresEvidence && (
                  <span 
                    className={`inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700 border border-amber-200 ${
                      variant === "compact" ? "text-[10px]" : "text-xs"
                    }`}
                  >
                    Evidence Required
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    case "CHECKLIST": {
      const items = (config.items as Array<{ title: string; completed?: boolean }> | string[]) || [];
      
      if (items.length === 0) {
        return (
          <div className="text-xs text-slate-400 italic">
            No checklist items defined
          </div>
        );
      }
      
      return (
        <div className="space-y-1.5">
          {items.map((item, i) => {
            const title = typeof item === "string" ? item : item.title;
            return (
              <div key={i} className="flex items-start gap-2 text-slate-700">
                <CheckCircle className={`${variant === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"} mt-0.5 text-slate-400 flex-shrink-0`} />
                <span className={variant === "compact" ? "text-xs" : "text-sm"}>
                  {title}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    
    case "APPROVAL_LAWYER": {
      const message = config.message as string;
      const approverRole = (config.approverRole as string) || "LAWYER";
      
      return (
        <div className={`flex items-start gap-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
          <UserCheck className={`${variant === "compact" ? "h-4 w-4" : "h-5 w-5"} text-blue-500 flex-shrink-0 mt-0.5`} />
          <div className="space-y-1">
            <div className="text-slate-700">
              <span className="font-medium text-slate-900">Approver:</span>{" "}
              <span className="text-blue-600 font-medium">{approverRole}</span>
            </div>
            {message && (
              <div className="text-slate-600 italic">"{message}"</div>
            )}
          </div>
        </div>
      );
    }
    
    case "SIGNATURE_CLIENT": {
      const provider = (config.provider as string) || "mock";
      const documentId = config.documentId as string;
      
      return (
        <div className={`flex items-start gap-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
          <FileText className={`${variant === "compact" ? "h-4 w-4" : "h-5 w-5"} text-purple-500 flex-shrink-0 mt-0.5`} />
          <div className="space-y-1">
            <div className="text-slate-700">
              <span className="font-medium text-slate-900">Provider:</span>{" "}
              <span className="text-purple-600 font-medium">{provider}</span>
            </div>
            {documentId && (
              <div className={`text-slate-600 font-mono ${variant === "compact" ? "text-[10px]" : "text-xs"}`}>
                Document: {documentId}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    case "REQUEST_DOC_CLIENT": {
      const requestText = config.requestText as string;
      const documentNames = (config.documentNames as string[]) || [];
      
      return (
        <div className={`flex items-start gap-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
          <Upload className={`${variant === "compact" ? "h-4 w-4" : "h-5 w-5"} text-orange-500 flex-shrink-0 mt-0.5`} />
          <div className="space-y-1">
            {requestText && (
              <div className="text-slate-700">{requestText}</div>
            )}
            {documentNames.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {documentNames.map((name, i) => (
                  <span 
                    key={i} 
                    className={`inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 font-medium text-orange-700 border border-orange-200 ${
                      variant === "compact" ? "text-[10px]" : "text-xs"
                    }`}
                  >
                    {name}
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
        <div className={`flex items-start gap-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
          <CreditCard className={`${variant === "compact" ? "h-4 w-4" : "h-5 w-5"} text-green-500 flex-shrink-0 mt-0.5`} />
          <div className="space-y-1">
            <div className="text-slate-700">
              <span className="font-medium text-slate-900">Amount:</span>{" "}
              <span className={`text-green-600 font-semibold ${variant === "compact" ? "text-sm" : "text-base"}`}>
                {new Intl.NumberFormat('en-US', { 
                  style: 'currency', 
                  currency: currency 
                }).format(amount || 0)}
              </span>
            </div>
            {provider && (
              <div className={`text-slate-600 ${variant === "compact" ? "text-[10px]" : "text-xs"}`}>
                Provider: <span className="font-medium">{provider}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    case "WRITE_TEXT": {
      const title = config.title as string;
      const description = config.description as string;
      const minLength = config.minLength as number | undefined;
      const maxLength = config.maxLength as number | undefined;
      const required = config.required !== false;
      
      return (
        <div className={`flex items-start gap-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
          <FileEdit className={`${variant === "compact" ? "h-4 w-4" : "h-5 w-5"} text-indigo-500 flex-shrink-0 mt-0.5`} />
          <div className="space-y-1">
            <div className="text-slate-700">
              <span className="font-medium text-slate-900">
                {title || "Text Writing"}
              </span>
              {required && <span className="text-red-500 ml-1">*</span>}
            </div>
            {description && (
              <div className="text-slate-600">{description}</div>
            )}
            {(minLength || maxLength) && (
              <div className={`text-slate-500 ${variant === "compact" ? "text-[10px]" : "text-xs"}`}>
                Length: {minLength && maxLength
                  ? `${minLength} - ${maxLength} chars`
                  : minLength
                  ? `min ${minLength} chars`
                  : `max ${maxLength} chars`}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    case "POPULATE_QUESTIONNAIRE": {
      const title = config.title as string | undefined;
      const description = config.description as string | undefined;
      
      return (
        <div className={`flex items-start gap-3 ${variant === "compact" ? "text-xs" : "text-sm"}`}>
          <FileQuestion className={`${variant === "compact" ? "h-4 w-4" : "h-5 w-5"} text-purple-500 flex-shrink-0 mt-0.5`} />
          <div className="space-y-1">
            <div className="text-slate-700">
              <span className="font-medium text-slate-900">
                {title || "Questionnaire"}
              </span>
            </div>
            {description && (
              <div className="text-slate-600">{description}</div>
            )}
            <div className={`text-slate-500 ${variant === "compact" ? "text-[10px]" : "text-xs"}`}>
              Client will complete questionnaire
            </div>
          </div>
        </div>
      );
    }
    
    default:
      return (
        <div className="text-xs text-slate-400 italic">
          Unknown action type: {actionType}
        </div>
      );
  }
}
