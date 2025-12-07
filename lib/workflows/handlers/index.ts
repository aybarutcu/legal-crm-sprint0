import { actionRegistry } from "../registry";
import { ApprovalActionHandler } from "./approval";
import { TaskActionHandler } from "./task";
import { ChecklistActionHandler } from "./checklist";
import { PaymentActionHandler } from "./payment-client";
import { PopulateQuestionnaireActionHandler } from "./populate-questionnaire";
import { RequestDocActionHandler } from "./request-doc";
import { SignatureActionHandler } from "./signature-client";
import { WriteTextActionHandler } from "./write-text";
import { AutomationEmailActionHandler, AutomationWebhookActionHandler } from "./automation";

export function registerDefaultWorkflowHandlers(): void {
  actionRegistry.override(new ApprovalActionHandler());
  actionRegistry.override(new SignatureActionHandler());
  actionRegistry.override(new RequestDocActionHandler());
  actionRegistry.override(new PaymentActionHandler());
  actionRegistry.override(new TaskActionHandler());
  actionRegistry.override(new ChecklistActionHandler());
  actionRegistry.override(new WriteTextActionHandler());
  actionRegistry.override(new PopulateQuestionnaireActionHandler());
  actionRegistry.override(new AutomationEmailActionHandler());
  actionRegistry.override(new AutomationWebhookActionHandler());
}

export { ApprovalActionHandler } from "./approval";
export { SignatureActionHandler } from "./signature-client";
export { RequestDocActionHandler } from "./request-doc";
export { PaymentActionHandler } from "./payment-client";
export { TaskActionHandler } from "./task";
export { ChecklistActionHandler } from "./checklist";
export { WriteTextActionHandler } from "./write-text";
export { PopulateQuestionnaireActionHandler } from "./populate-questionnaire";
export { AutomationEmailActionHandler, AutomationWebhookActionHandler } from "./automation";
