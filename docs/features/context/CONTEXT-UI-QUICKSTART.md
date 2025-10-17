# Workflow Context UI - Quick Start Guide

## What We Built

The **Workflow Context UI** allows you to manage shared data between workflow steps directly from the browser. No more "black box" context!

---

## Features at a Glance

### 🔍 View Context
- See all key-value pairs
- Color-coded type badges
- Pretty-printed JSON for objects/arrays
- Collapsible panel (saves space)

### ✏️ Edit Context
- Add new keys with type selection
- Edit existing values
- Type-safe inputs (no invalid JSON)
- Real-time validation

### 🗑️ Delete Context
- Remove single keys
- Clear all context data
- Confirmation dialogs (prevent accidents)

### 📤 Export Context
- Download context as JSON file
- Perfect for debugging or documentation

---

## How to Use

### 1. Navigate to Matter Detail Page

```
http://localhost:3000/matters/:id
```

### 2. Find Workflow Section

Scroll down to "Workflows" section. Each workflow instance has a collapsible context panel.

### 3. Expand Context Panel

Click the "▶ Workflow Context" button to expand.

### 4. Manage Context

**Add Value:**
1. Click "+ Add" button
2. Enter key name (e.g., `clientApproved`)
3. Select type (string, number, boolean, array, object)
4. Enter value
5. Click "Add"

**Edit Value:**
1. Click "Edit" button on any key
2. Modify type or value
3. Click "Update"

**Delete Value:**
1. Click "Delete" button on any key
2. Confirm deletion

**Export:**
1. Click "Export" button
2. JSON file downloads automatically

**Clear All:**
1. Click "Clear All" button
2. Confirm deletion
3. All context data removed

---

## Testing the UI

### Quick Test (30 seconds)

1. Run the test script:
   ```bash
   npx tsx scripts/test-context-ui.ts
   ```

2. Script will:
   - Find a workflow instance
   - Set 7 sample context values
   - Display the matter URL

3. Open the URL in browser

4. Expand "Workflow Context" panel

5. You should see:
   - `clientApproved` (boolean)
   - `documentCount` (number)
   - `approverName` (string)
   - `documents` (array)
   - `paymentDetails` (object)
   - `completedSteps` (number)
   - `notes` (string)

6. Try editing, deleting, exporting!

---

## Component Architecture

```
WorkflowContextPanel (Main UI)
    ↓
useWorkflowContext (API Hook)
    ↓
/api/workflows/instances/:id/context (REST API)
    ↓
lib/workflows/context.ts (Backend Helpers)
    ↓
Prisma (Database)
```

---

## Type Support

| Type | Input | Example | Display |
|------|-------|---------|---------|
| **string** | Text input | `"John Doe"` | Plain text |
| **number** | Number input | `42` | Plain number |
| **boolean** | Dropdown | `true` / `false` | Plain boolean |
| **array** | JSON textarea | `["a", "b"]` | Syntax-highlighted JSON |
| **object** | JSON textarea | `{"key": "value"}` | Syntax-highlighted JSON |

---

## API Usage

### Get Context
```bash
curl http://localhost:3000/api/workflows/instances/:id/context
```

### Update Context (Merge)
```bash
curl -X PATCH http://localhost:3000/api/workflows/instances/:id/context \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {"clientApproved": true},
    "mode": "merge"
  }'
```

### Clear Context
```bash
curl -X PATCH http://localhost:3000/api/workflows/instances/:id/context \
  -H "Content-Type: application/json" \
  -d '{"mode": "clear"}'
```

---

## Files Created

```
components/matters/detail/
├── WorkflowContextPanel.tsx       # Main panel UI
├── ContextEditModal.tsx           # Edit modal
└── hooks/
    └── useWorkflowContext.ts      # API integration

scripts/
└── test-context-ui.ts             # Test script

docs/
├── CONTEXT-UI-IMPLEMENTATION.md   # Full implementation doc
└── CONTEXT-UI-QUICKSTART.md       # This file
```

---

## Troubleshooting

### Panel is empty
- **Check:** Is there a workflow instance on this matter?
- **Fix:** Click "Add Workflow" to instantiate a template

### Can't see context panel
- **Check:** Did you scroll to "Workflows" section?
- **Fix:** Scroll down past Parties and Documents sections

### Context not loading
- **Check:** Is dev server running?
- **Fix:** Run `npm run dev`

### Can't edit context
- **Check:** Are you logged in?
- **Fix:** Go to `/login` and authenticate

### JSON validation error
- **Check:** Is your JSON valid?
- **Fix:** Use a JSON validator (e.g., jsonlint.com)

---

## Next Steps

1. ✅ **Test the UI** - Run the test script and play with context
2. 📚 **Read Full Docs** - See `CONTEXT-UI-IMPLEMENTATION.md`
3. 🎯 **Use in Workflows** - Start using context in your action handlers
4. 🔍 **Debug Workflows** - Use context to track workflow state
5. 📈 **Track Progress** - Store step counters, completion rates, etc.

---

## Example Use Cases

### Use Case 1: Approval Tracking
```json
{
  "approvedBy": "John Doe",
  "approvedAt": "2025-10-15T10:30:00Z",
  "comments": "Looks good, proceed"
}
```

### Use Case 2: Document Collection
```json
{
  "requiredDocs": ["ID", "Proof of Address", "Contract"],
  "receivedDocs": ["ID", "Contract"],
  "missingDocs": ["Proof of Address"]
}
```

### Use Case 3: Payment Tracking
```json
{
  "totalAmount": 5000,
  "paidAmount": 2000,
  "remainingAmount": 3000,
  "paymentStatus": "partial"
}
```

### Use Case 4: Multi-Step Form
```json
{
  "step1Complete": true,
  "step2Complete": false,
  "formData": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

---

## Tips & Tricks

### Tip 1: Use Descriptive Keys
✅ Good: `clientApprovedDate`, `documentCount`, `lastUpdatedBy`  
❌ Bad: `d1`, `count`, `user`

### Tip 2: Store Metadata
Store not just the value, but also *when* and *who*:
```json
{
  "clientApproved": true,
  "clientApprovedBy": "John Doe",
  "clientApprovedAt": "2025-10-15T10:30:00Z"
}
```

### Tip 3: Use Arrays for Collections
```json
{
  "completedSteps": [1, 2, 3],
  "assignedUsers": ["user1", "user2"],
  "documents": ["doc1.pdf", "doc2.pdf"]
}
```

### Tip 4: Export Before Clearing
Always export context before clicking "Clear All" - there's no undo!

### Tip 5: Use Objects for Structured Data
```json
{
  "payment": {
    "amount": 5000,
    "currency": "USD",
    "status": "pending",
    "dueDate": "2025-11-01"
  }
}
```

---

## What's Next?

### Already Implemented ✅
- View context
- Add/edit/delete values
- Export context
- Clear all context
- Type-safe inputs
- Error handling
- Toast notifications

### Coming Soon 🚀
- **Context History** - See which step last modified each key
- **Context Validation** - Define schemas for context values
- **Context Templates** - Save and reuse common patterns
- **Real-time Sync** - See changes from other users instantly
- **Optimistic Updates** - Instant UI feedback

---

## Support

Need help? Check:
1. 📖 Full docs: `docs/CONTEXT-UI-IMPLEMENTATION.md`
2. 📖 Backend docs: `docs/workflow-context-guide.md`
3. 🔧 Test script: `scripts/test-context-ui.ts`
4. 🎯 Analysis: `docs/MATTERS-UI-ANALYSIS.md`

---

**Happy context managing! 🎉**
