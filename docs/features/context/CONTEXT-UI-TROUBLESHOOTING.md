# Troubleshooting: Workflow Context UI

## Common Issues and Solutions

### Issue 1: "Unknown field `contextData`" Error

**Error Message:**
```
Invalid `prisma.workflowInstance.findUnique()` invocation
Unknown field `contextData` for select statement on model `WorkflowInstance`
```

**Cause:** Prisma Client not regenerated after schema changes

**Solution:**
```bash
npx prisma generate
```

**Why:** The `contextData` field exists in `schema.prisma` but the TypeScript types in `@prisma/client` are stale. Running `prisma generate` rebuilds the client with the latest schema.

---

### Issue 2: Migration Not Applied

**Error Message:**
```
Column "contextData" does not exist
```

**Cause:** Database migration not applied

**Solution:**
```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy

# Or create and apply new migration (dev only)
npx prisma migrate dev --name add_context_data
```

---

### Issue 3: Context Panel Not Visible

**Symptom:** Can't see "Workflow Context" panel in matter detail page

**Possible Causes:**
1. **No workflow instance** - Panel only appears for workflow instances
2. **Wrong page** - Make sure you're on `/matters/:id`, not `/matters` (list page)
3. **Component not imported** - Check `MatterDetailClient.tsx` has the import

**Solution:**
```bash
# 1. Check if matter has workflow instances
npx tsx scripts/test-context-ui.ts

# 2. Navigate to the URL shown by script

# 3. Scroll down to "Workflows" section

# 4. Look for collapsible "Workflow Context" panel
```

---

### Issue 4: Context Panel Empty

**Symptom:** Panel shows "No context data yet"

**Cause:** Context data not set for this workflow instance

**Solution:**
```bash
# Run test script to populate sample data
npx tsx scripts/test-context-ui.ts

# Or manually add values via UI:
# 1. Click "+ Add" button
# 2. Enter key/value
# 3. Click "Add"
```

---

### Issue 5: JSON Validation Error

**Symptom:** "Invalid JSON format" error when editing array/object

**Cause:** Malformed JSON in textarea

**Solution:**
- Ensure proper JSON syntax:
  - Arrays: `["item1", "item2"]`
  - Objects: `{"key": "value"}`
  - Strings must be quoted: `"text"` not `text`
  - No trailing commas
  - No comments

**Valid JSON Examples:**
```json
// Array
["contract.pdf", "addendum.pdf"]

// Object
{
  "amount": 5000,
  "currency": "USD",
  "status": "pending"
}

// Nested
{
  "client": {
    "name": "John Doe",
    "approved": true
  },
  "documents": ["doc1.pdf", "doc2.pdf"]
}
```

---

### Issue 6: 401 Unauthorized Error

**Symptom:** API returns 401 when trying to view/edit context

**Cause:** Not logged in or session expired

**Solution:**
```bash
# 1. Go to /login
# 2. Sign in with credentials
# 3. Try again
```

---

### Issue 7: 403 Forbidden Error

**Symptom:** API returns 403 when trying to edit context

**Cause:** Insufficient permissions for this matter

**Solution:**
- Ensure your user has access to the matter
- Check RBAC rules in `/lib/authorization.ts`
- Admin and lawyers should have full access

---

### Issue 8: Context Not Persisting

**Symptom:** Context values disappear after page refresh

**Possible Causes:**
1. API request failing silently
2. Database transaction rolling back
3. Cache issue

**Debug:**
```bash
# 1. Check browser console for errors
# 2. Check network tab for API response
# 3. Check server logs

# 4. Query database directly
npx prisma studio
# Navigate to WorkflowInstance table
# Check contextData column
```

---

### Issue 9: Dev Server Not Running

**Symptom:** Can't access http://localhost:3000

**Solution:**
```bash
# Start dev server
npm run dev

# Or with debugging
npm run dev -- --turbo
```

---

### Issue 10: TypeScript Errors After Update

**Symptom:** Red squiggles in VS Code after adding context UI

**Cause:** TypeScript server not restarted

**Solution:**
1. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
2. Type "TypeScript: Restart TS Server"
3. Press Enter
4. Wait 5-10 seconds for reload

---

## Quick Health Check

Run this checklist if context UI isn't working:

```bash
# 1. Check Prisma Client is up to date
npx prisma generate

# 2. Check migrations are applied
npx prisma migrate status

# 3. Check dev server is running
curl http://localhost:3000

# 4. Check workflow instance exists
npx tsx scripts/test-context-ui.ts

# 5. Check API endpoint works
curl http://localhost:3000/api/workflows/instances/:id/context

# 6. Check browser console for errors
# Open DevTools > Console tab
```

---

## Debug Mode

Enable detailed logging for troubleshooting:

```typescript
// In useWorkflowContext.ts, add:
console.log("Loading context for instance:", instanceId);
console.log("Response status:", response.status);
console.log("Context data:", data);

// In WorkflowContextPanel.tsx, add:
console.log("Context panel mounted for:", instanceId);
console.log("Current context:", context);
console.log("Loading state:", loading);
console.log("Error state:", error);
```

---

## Getting Help

If issues persist:

1. Check documentation:
   - `docs/CONTEXT-UI-IMPLEMENTATION.md`
   - `docs/CONTEXT-UI-QUICKSTART.md`
   - `docs/workflow-context-guide.md`

2. Check server logs:
   - Terminal running `npm run dev`
   - Look for error messages

3. Check browser console:
   - Open DevTools (F12 / Cmd+Opt+I)
   - Look for red errors

4. Check database:
   - Run `npx prisma studio`
   - Verify WorkflowInstance has contextData column
   - Check if data is actually stored

5. Create minimal reproduction:
   - Run test script
   - Try single operation (e.g., just "Add")
   - Note exact error message

---

## Common Fixes Summary

| Issue | Quick Fix |
|-------|-----------|
| Unknown field error | `npx prisma generate` |
| Column not found | `npx prisma migrate deploy` |
| Panel not visible | Run test script, check URL |
| Panel empty | Click "+ Add" to add data |
| JSON error | Fix JSON syntax |
| 401 error | Log in again |
| 403 error | Check permissions |
| Not persisting | Check console/network tab |
| Server down | `npm run dev` |
| TypeScript errors | Restart TS Server |

---

**Last Updated:** 15 October 2025
