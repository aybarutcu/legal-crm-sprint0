import { actionRegistry } from "../registry";
import { ApprovalActionHandler } from "./approval-lawyer";
import { ChecklistActionHandler } from "./checklist";
import { PaymentActionHandler } from "./payment-client";
import { RequestDocActionHandler } from "./request-doc-client";
import { SignatureActionHandler } from "./signature-client";

export function registerDefaultWorkflowHandlers(): void {
  actionRegistry.override(new ApprovalActionHandler());
  actionRegistry.override(new SignatureActionHandler());
  actionRegistry.override(new RequestDocActionHandler());
  actionRegistry.override(new PaymentActionHandler());
  actionRegistry.override(new ChecklistActionHandler());
}

export { ApprovalActionHandler } from "./approval-lawyer";
export { SignatureActionHandler } from "./signature-client";
export { RequestDocActionHandler } from "./request-doc-client";
export { PaymentActionHandler } from "./payment-client";
export { ChecklistActionHandler } from "./checklist";
