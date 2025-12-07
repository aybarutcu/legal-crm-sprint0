# Workflow Template Validation Error - Fix Summary

## Problem
When submitting a workflow template via PATCH request to `/api/workflows/templates/[id]`, the API returned a **422 Unprocessable Entity** error with the message:

```json
{
  "error": "Validation failed",
  "details": {
    "fieldErrors": {},
    "formErrors": [],
    "issues": [
      {
        "code": "invalid_type",
        "expected": "object",
        "received": "null",
        "path": ["dependencies", 0, "conditionConfig"],
        "message": "Expected object, received null"
      }
      // ... repeated for all dependencies
    ]
  }
}
```

## Root Cause
The `conditionConfig` field in the workflow dependencies was being sent as `null` in the payload, but the Zod validation schema expected it to be either:
- An object (`{}`)
- `undefined` (omitted field)

The schema was defined as:
```typescript
conditionConfig: z.record(z.any()).optional()
```

This `.optional()` modifier makes the field accept `object | undefined`, but **not `null`**.

## Solution
Updated the validation schema in `lib/validation/workflow.ts` to accept `null` values:

```typescript
// Before
conditionConfig: z.record(z.any()).optional()

// After  
conditionConfig: z.record(z.any()).optional().nullable()
```

Additionally, updated both API route handlers to convert `null` to `undefined` when saving to the database:

**In `app/api/workflows/templates/route.ts` (POST):**
```typescript
conditionConfig: dep.conditionConfig ?? undefined
```

**In `app/api/workflows/templates/[id]/route.ts` (PATCH):**
```typescript
conditionConfig: dep.conditionConfig ?? undefined
```

Also fixed the PATCH route to use proper Prisma relation connections:
```typescript
// Before
sourceStepId: dep.sourceStepId,
targetStepId: dep.targetStepId,

// After
sourceStep: { connect: { id: dep.sourceStepId } },
targetStep: { connect: { id: dep.targetStepId } },
```

## Files Modified
1. `lib/validation/workflow.ts` - Added `.nullable()` to `conditionConfig` in `workflowDependencySchema`
2. `app/api/workflows/templates/route.ts` - Convert `null` to `undefined` in POST handler
3. `app/api/workflows/templates/[id]/route.ts` - Convert `null` to `undefined` and use proper Prisma relations in PATCH handler

## Testing
After the fix, the workflow template can be submitted successfully with `conditionConfig: null` in dependencies. The validation now accepts:
- `conditionConfig: null` ✅
- `conditionConfig: {}` ✅
- `conditionConfig: { key: "value" }` ✅
- `conditionConfig: undefined` (omitted) ✅

## How to Interpret 422 Validation Errors
When you see a **422 Unprocessable Entity** response from the API:

1. **Check server logs** - The full error is logged to the console with the path:
   ```
   API handler error {
     path: '/api/workflows/templates/...',
     method: 'PATCH',
     error: ZodError: [...]
   }
   ```

2. **Look at the response body** - It contains flattened error details:
   ```json
   {
     "error": "Validation failed",
     "details": {
       "fieldErrors": { ... },
       "formErrors": [ ... ]
     }
   }
   ```

3. **Identify the path** - The `path` array shows exactly which field failed:
   - `["dependencies", 0, "conditionConfig"]` means the first dependency's `conditionConfig` field

4. **Check expected vs received** - The error shows what type was expected and what was received:
   - `expected: "object"` + `received: "null"` means you're sending `null` but the schema expects an object

## Prevention
- When defining optional JSON fields, consider if `null` is a valid value in addition to `undefined`
- Use `.nullable()` for fields that should accept `null`
- Use `.optional()` for fields that can be omitted
- Use `.optional().nullable()` for fields that accept both `null` and being omitted
- In Prisma operations, convert `null` to `undefined` explicitly: `value ?? undefined`

## Related Documentation
- Zod schema modifiers: https://zod.dev/?id=optional
- Prisma JSON fields: https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields
- Workflow dependency schema: `lib/validation/workflow.ts`
- Copilot instructions: `.github/copilot-instructions.md` (API & Auth section)
