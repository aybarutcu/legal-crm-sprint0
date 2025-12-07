"use client";

import { CheckCircle2, XCircle, User } from "lucide-react";

type ApprovalDecision = {
  approved: boolean;
  comment?: string;
  decidedAt?: string;
  decidedBy?: string;
};

interface ApprovalViewerProps {
  decision?: ApprovalDecision;
}

export function ApprovalViewer({ decision }: ApprovalViewerProps) {
  const isApproved = decision?.approved === true;
  const statusIcon = isApproved ? (
    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
  ) : (
    <XCircle className="h-5 w-5 text-rose-600" />
  );
  const statusLabel = decision
    ? isApproved
      ? "Approved"
      : "Rejected"
    : "Decision Pending";
  const statusColor = decision
    ? isApproved
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : "text-rose-700 bg-rose-50 border-rose-200"
    : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        {statusIcon}
        <h4 className="text-sm font-semibold text-slate-900">Approval Outcome</h4>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {decision ? (
        <div className="space-y-3 rounded-lg border border-white/60 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="h-4 w-4 text-slate-400" />
            <span>
              {decision.decidedBy ? `Actor ID: ${decision.decidedBy}` : "Actor unknown"}
              {decision.decidedAt && (
                <>
                  {" "}
                  • {new Date(decision.decidedAt).toLocaleString("tr-TR")}
                </>
              )}
            </span>
          </div>
          {decision.comment ? (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900 mb-1">Reviewer Comment</p>
              <p className="whitespace-pre-wrap">{decision.comment}</p>
            </div>
          ) : (
            <p className="text-xs italic text-slate-500">No comment provided.</p>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-purple-200 bg-white/70 p-3 text-sm text-slate-500">
          Awaiting reviewer decision. This step will unblock its branch once a decision is submitted.
        </p>
      )}
    </div>
  );
}
