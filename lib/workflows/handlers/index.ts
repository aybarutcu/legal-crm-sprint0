import { actionRegistry } from "../registry";
import { ApprovalActionHandler } from "./approval-lawyer";
import { ChecklistActionHandler } from "./checklist";
import { PaymentActionHandler } from "./payment-client";
import { PopulateQuestionnaireActionHandler } from "./populate-questionnaire";
import { RequestDocActionHandler } from "./request-doc-client";
import { SignatureActionHandler } from "./signature-client";
import { WriteTextActionHandler } from "./write-text";

export function registerDefaultWorkflowHandlers(): void {
  actionRegistry.override(new ApprovalActionHandler());
  actionRegistry.override(new SignatureActionHandler());
  actionRegistry.override(new RequestDocActionHandler());
  actionRegistry.override(new PaymentActionHandler());
  actionRegistry.override(new ChecklistActionHandler());
  actionRegistry.override(new WriteTextActionHandler());
  actionRegistry.override(new PopulateQuestionnaireActionHandler());
}

export { ApprovalActionHandler } from "./approval-lawyer";
export { SignatureActionHandler } from "./signature-client";
export { RequestDocActionHandler } from "./request-doc-client";
export { PaymentActionHandler } from "./payment-client";
export { ChecklistActionHandler } from "./checklist";
export { WriteTextActionHandler } from "./write-text";
export { PopulateQuestionnaireActionHandler } from "./populate-questionnaire";
