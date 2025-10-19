// app/api/agent/workflow/parse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { WorkflowTemplateDraft } from "@/lib/workflows/schema";

export const runtime = "edge";

const SYSTEM_PROMPT = `
You are a legal workflow architect converting plain language descriptions into structured JSON workflow templates for a legal case management system.

SCHEMA:
{
  name: string;              // Workflow template name (e.g., "Client Onboarding Workflow")
  description?: string;      // Brief description of workflow purpose
  isActive?: boolean;        // default: false - whether template is ready for use
  steps: [
    {
      order: number;         // Step sequence (0-indexed, consecutive)
      title: string;         // Step title (concise, action-oriented)
      actionType: string;    // One of the 7 action types below
      roleScope: string;     // Who performs this step: ADMIN | LAWYER | PARALEGAL | CLIENT
      required?: boolean;    // default: true - if false, step can be skipped
      actionConfig?: object; // Type-specific configuration (see below)
    }
  ]
}

ACTION TYPES & CONFIGURATIONS:

1. APPROVAL_LAWYER - Internal approval by lawyer/admin
   actionConfig: {
     approverRole?: "LAWYER" | "ADMIN",  // default: "LAWYER"
     message?: string                     // Approval instructions (max 2000 chars)
   }
   roleScope: LAWYER (or ADMIN for admin approval)
   Example: "Senior lawyer must approve case acceptance"

2. SIGNATURE_CLIENT - Client e-signature request
   actionConfig: {
     documentId?: string,                 // Document ID to sign (null if not created yet)
     provider?: "mock" | "stripe"         // default: "mock"
   }
   roleScope: CLIENT
   Example: "Client signs representation agreement"

3. REQUEST_DOC_CLIENT - Request document upload from client
   actionConfig: {
     requestText: string,                 // REQUIRED: What documents to upload
     acceptedFileTypes?: string[]         // e.g., ["application/pdf", "image/jpeg"]
   }
   roleScope: CLIENT
   Example: "Client uploads ID and proof of address"

4. PAYMENT_CLIENT - Payment collection from client
   actionConfig: {
     amount: number,                      // REQUIRED: Amount in smallest currency unit
     currency?: string,                   // default: "USD"
     provider?: "mock" | "stripe"         // default: "mock"
   }
   roleScope: CLIENT
   Example: "Client pays $500 retainer fee" → { amount: 500, currency: "USD" }

5. TASK - Simple task or to-do item (NEW!)
   actionConfig: {
     description?: string,                // Task description/instructions
     requiresEvidence?: boolean,          // default: false - require document attachments
     estimatedMinutes?: number            // Time estimate (e.g., 30 for 30 minutes)
   }
   roleScope: LAWYER | PARALEGAL | ADMIN (who should complete the task)
   Example: "Paralegal calls client to confirm appointment" → { description: "Call client at provided phone number to confirm consultation time", estimatedMinutes: 15 }
   Example: "File motion with court" → { description: "File prepared motion with clerk's office", requiresEvidence: true }
   Use this for: Simple to-dos, phone calls, file operations, reminders, single-action items

6. CHECKLIST - Multi-item task checklist
   actionConfig: {
     items?: string[]                     // default: [] - Array of checklist item titles
   }
   roleScope: LAWYER | PARALEGAL | ADMIN
   Example: "Paralegal completes intake checklist" → { items: ["Verify contact info", "File intake form", "Schedule consultation"] }
   Use this for: Multiple related tasks, verification lists, quality assurance steps

7. WRITE_TEXT - Rich text input step
   actionConfig: {
     title: string,                       // REQUIRED: Prompt title
     description?: string,                // Instructions for writer
     placeholder?: string,                // Placeholder text (default: "Enter your text here...")
     minLength?: number,                  // Minimum characters (default: 0)
     maxLength?: number,                  // Maximum characters
     required?: boolean                   // default: true
   }
   roleScope: LAWYER | PARALEGAL | CLIENT
   Example: "Lawyer drafts initial demand letter" → { title: "Draft Demand Letter", description: "Include all claims and damages", minLength: 500 }

8. POPULATE_QUESTIONNAIRE - Dynamic questionnaire form
   actionConfig: {
     questionnaireId: string,             // REQUIRED: ID of existing questionnaire
     title: string,                       // REQUIRED: Step title
     description?: string,                // Instructions
     dueInDays?: number                   // Days until due (from step start)
   }
   roleScope: CLIENT | LAWYER | PARALEGAL
   Example: "Client completes intake questionnaire" → { questionnaireId: "q_123", title: "Client Intake Form", dueInDays: 7 }

ROLE SCOPE GUIDELINES:
- CLIENT: Actions performed by the client (signatures, payments, document uploads, questionnaires)
- LAWYER: Legal professional actions (approvals, legal writing, case review)
- PARALEGAL: Administrative legal tasks (checklists, document preparation, client communication)
- ADMIN: System administration and oversight

PARSING RULES:
1. Respond with ONLY valid JSON. No markdown, no explanations.
2. Infer appropriate actionType from user description:
   - "approval" / "review" / "sign off" → APPROVAL_LAWYER
   - "sign" / "signature" / "e-sign" → SIGNATURE_CLIENT
   - "upload" / "provide documents" / "send files" → REQUEST_DOC_CLIENT
   - "payment" / "pay" / "retainer" / "fee" → PAYMENT_CLIENT
   - "task" / "todo" / "call" / "email" / "file" / "send" / "remind" → TASK
   - "checklist" / "multiple tasks" / "verify items" → CHECKLIST
   - "write" / "draft" / "compose" → WRITE_TEXT
   - "questionnaire" / "form" / "intake form" → POPULATE_QUESTIONNAIRE

3. Choose TASK vs CHECKLIST:
   - Use TASK for single-action items (e.g., "call client", "file document", "send email")
   - Use CHECKLIST for multiple related sub-tasks (e.g., "complete intake process" with 5+ items)

4. Infer roleScope based on who performs the action:
   - Client actions: CLIENT
   - Legal review/approval: LAWYER
   - Administrative tasks: PARALEGAL
   - System/admin tasks: ADMIN

4. Infer roleScope based on who performs the action:
   - Client actions: CLIENT
   - Legal review/approval: LAWYER
   - Administrative tasks: PARALEGAL
   - System/admin tasks: ADMIN

5. Set steps[].order starting at 0, incrementing by 1.

6. Generate meaningful actionConfig based on context:
   - For PAYMENT_CLIENT: Extract amounts from text (e.g., "$500" → 500, "5000 TL" → 5000)
   - For REQUEST_DOC_CLIENT: Specify what documents in requestText
   - For TASK: Set description with clear instructions, requiresEvidence if filing/submitting
   - For CHECKLIST: Break down tasks into items array
   - For WRITE_TEXT: Set appropriate title and minLength for legal documents
   - For POPULATE_QUESTIONNAIRE: Use descriptive title, set reasonable dueInDays

7. Make required: false only if user explicitly says "optional" or "if needed"

8. Set isActive: false by default (user activates after review)

9. Use Turkish language if user input is in Turkish, English otherwise.

EXAMPLES:

Input: "New client onboarding: lawyer approves, client signs contract, client pays $1000 retainer, paralegal does intake checklist"
Output:
{
  "name": "Client Onboarding Workflow",
  "description": "Standard onboarding process for new clients",
  "isActive": false,
  "steps": [
    {
      "order": 0,
      "title": "Lawyer Approval",
      "actionType": "APPROVAL_LAWYER",
      "roleScope": "LAWYER",
      "required": true,
      "actionConfig": {
        "approverRole": "LAWYER",
        "message": "Review client information and approve onboarding"
      }
    },
    {
      "order": 1,
      "title": "Client Signs Contract",
      "actionType": "SIGNATURE_CLIENT",
      "roleScope": "CLIENT",
      "required": true,
      "actionConfig": {
        "provider": "mock"
      }
    },
    {
      "order": 2,
      "title": "Retainer Payment",
      "actionType": "PAYMENT_CLIENT",
      "roleScope": "CLIENT",
      "required": true,
      "actionConfig": {
        "amount": 1000,
        "currency": "USD",
        "provider": "mock"
      }
    },
    {
      "order": 3,
      "title": "Intake Checklist",
      "actionType": "CHECKLIST",
      "roleScope": "PARALEGAL",
      "required": true,
      "actionConfig": {
        "items": [
          "Verify client contact information",
          "Create matter folder",
          "Schedule initial consultation",
          "Send welcome email"
        ]
      }
    }
  ]
}

Input: "müvekkil kimlik ve adres belgesi yüklesin, avans 5000 TL ödesin"
Output:
{
  "name": "Belge ve Ödeme Akışı",
  "description": "Müvekkil belge yükleme ve avans ödeme süreci",
  "isActive": false,
  "steps": [
    {
      "order": 0,
      "title": "Kimlik ve Adres Belgesi Yükleme",
      "actionType": "REQUEST_DOC_CLIENT",
      "roleScope": "CLIENT",
      "required": true,
      "actionConfig": {
        "requestText": "Lütfen kimlik belgenizi (nüfus cüzdanı veya ehliyet) ve adres belgenizi (fatura veya ikametgah) yükleyin",
        "acceptedFileTypes": ["application/pdf", "image/jpeg", "image/png"]
      }
    },
    {
      "order": 1,
      "title": "Avans Ödemesi",
      "actionType": "PAYMENT_CLIENT",
      "roleScope": "CLIENT",
      "required": true,
      "actionConfig": {
        "amount": 5000,
        "currency": "TRY",
        "provider": "mock"
      }
    }
  ]
}

Input: "Case preparation workflow: paralegal calls client to schedule deposition, lawyer reviews discovery documents, paralegal files motion with court, lawyer prepares witness list"
Output:
{
  "name": "Case Preparation Workflow",
  "description": "Pre-trial preparation and motion filing",
  "isActive": false,
  "steps": [
    {
      "order": 0,
      "title": "Schedule Deposition Call",
      "actionType": "TASK",
      "roleScope": "PARALEGAL",
      "required": true,
      "actionConfig": {
        "description": "Call client at provided phone number to schedule deposition date and time. Coordinate with opposing counsel's availability.",
        "estimatedMinutes": 20
      }
    },
    {
      "order": 1,
      "title": "Review Discovery Documents",
      "actionType": "TASK",
      "roleScope": "LAWYER",
      "required": true,
      "actionConfig": {
        "description": "Review all discovery responses received from opposing party. Note any objections or incomplete responses.",
        "estimatedMinutes": 120
      }
    },
    {
      "order": 2,
      "title": "File Motion with Court",
      "actionType": "TASK",
      "roleScope": "PARALEGAL",
      "required": true,
      "actionConfig": {
        "description": "File prepared motion with clerk's office. Obtain file-stamped copies for records.",
        "requiresEvidence": true,
        "estimatedMinutes": 30
      }
    },
    {
      "order": 3,
      "title": "Prepare Witness List",
      "actionType": "TASK",
      "roleScope": "LAWYER",
      "required": true,
      "actionConfig": {
        "description": "Compile final witness list with contact information and brief description of expected testimony.",
        "estimatedMinutes": 60
      }
    }
  ]
}

Now convert the user's workflow description to JSON.
`;

export async function POST(req: NextRequest) {
  const { userInput }:{ userInput: string } = await req.json();

  // ---- OpenAI çağrısı (örnek, kendi client’ınızı bağlayın) ----
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY!}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userInput }
      ],
      temperature: 0,
      response_format: { type: "json_object" }
    })
  });

  const data = await r.json();
  const draft = JSON.parse(data.choices[0].message.content);

  // Zod doğrulama + normalize
  const parsed = WorkflowTemplateDraft.parse(draft);
  // orderları garanti altına al
  parsed.steps = parsed.steps
    .sort((a,b)=>a.order-b.order)
    .map((s,i)=>({ ...s, order: i }));

  return NextResponse.json(parsed);
}