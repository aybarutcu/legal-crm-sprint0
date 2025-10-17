// app/api/agent/workflow/parse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { WorkflowTemplateDraft } from "@/lib/workflows/schema";

export const runtime = "edge";

const SYSTEM_PROMPT = `
You convert plain legal workflow descriptions into strict JSON matching this TypeScript schema:

type Draft = {
  name: string;
  description?: string;
  isActive?: boolean; // default false
  steps: {
    order: number; // start at 0, consecutive
    title: string;
    actionType: "APPROVAL_LAWYER" | "SIGNATURE_CLIENT" | "REQUEST_DOC_CLIENT" | "PAYMENT_CLIENT" | "CHECKLIST" | "WRITE_TEXT";
    roleScope: "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";
    required?: boolean; // default true
    actionConfig?: Record<string, any>;
  }[];
}

Rules:
- Respond with JSON only. No commentary.
- actionType MUST be one of the allowed values.
- roleScope MUST be one of the allowed values.
- steps[].order must be consecutive starting at 0. If not provided, infer.
- Use concise step titles; put extra parameters into actionConfig.
- For WRITE_TEXT action type, actionConfig should include: title (required), description, placeholder, minLength, maxLength, required.
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