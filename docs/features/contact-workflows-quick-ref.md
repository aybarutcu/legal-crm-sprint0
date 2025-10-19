# Contact Workflows - Quick Reference

## 🎯 What Was Built
A complete workflow management system for LEAD contacts (contacts without associated matters).

## 📁 Key Files

### Database & API
- `prisma/schema.prisma` - Added `contactId` to WorkflowInstance
- `app/api/contacts/[id]/workflows/route.ts` - Create/get workflows for contact

### UI Components
- `app/(dashboard)/contacts/[id]/page.tsx` - Contact detail page (server)
- `app/(dashboard)/contacts/[id]/_components/contact-detail-client.tsx` - Tabs UI
- `app/(dashboard)/contacts/[id]/_components/contact-workflows-section.tsx` - Workflow timeline
- `app/(dashboard)/contacts/[id]/_components/start-workflow-dialog.tsx` - Create workflow

### Testing
- `scripts/test-lead-workflow.ts` - Create test LEAD with workflow
- `scripts/complete-lead-workflow-step.ts` - Complete next READY step  
- `tests/e2e/contact-workflows.spec.ts` - E2E tests
- `docs/runbooks/contact-workflow-testing.md` - Manual testing checklist

## ⚡ Quick Commands

```bash
# Start dev server
npm run dev

# Create test LEAD with workflow
npx tsx scripts/test-lead-workflow.ts

# Complete next workflow step
npx tsx scripts/complete-lead-workflow-step.ts cmgxmy9r000018yc5l7d9xbsg

# Run E2E tests (server must be running)
npm run e2e -- tests/e2e/contact-workflows.spec.ts

# Regenerate Prisma client (if types are stale)
npx prisma generate

# Open database GUI
npx prisma studio
```

## 🧪 Test Contact

- **ID**: `cmgxmy9r000018yc5l7d9xbsg`
- **Name**: Test Lead
- **Email**: test-lead@example.com
- **Type**: LEAD
- **URL**: http://localhost:3000/contacts/cmgxmy9r000018yc5l7d9xbsg

## 📋 Test Workflow: "Client Intake Process"

1. ✅ Initial Contact Checklist (LAWYER) - **COMPLETED**
2. ✅ Conflict Check Approval (LAWYER) - **COMPLETED**
3. 🟢 Request Initial Documents (CLIENT) - **READY**
4. ⏸️ Client Intake Questionnaire (CLIENT) - PENDING
5. ⏸️ Engagement Letter Signature (CLIENT) - PENDING
6. ⏸️ Collect Retainer Payment (CLIENT) - PENDING
7. ⏸️ Final Intake Review (LAWYER) - PENDING

## 👤 Test Credentials

```
Admin:
  Email: admin@legalcrm.test
  Password: admin123

Lawyer:
  Email: lawyer1@legalcrm.test
  Password: lawyer123

Paralegal:
  Email: paralegal1@legalcrm.test
  Password: paralegal123
```

## 🔍 How to Test

### 1. Visual Test (Manual)
```
1. npm run dev
2. Login → http://localhost:3000/login (admin@legalcrm.test / admin123)
3. Navigate → http://localhost:3000/contacts/cmgxmy9r000018yc5l7d9xbsg
4. Click "Workflows" tab
5. Click on a READY step (green indicator)
6. Execute the step using action buttons
7. Verify next step becomes READY
8. Check progress bar updates
```

See `docs/runbooks/contact-workflow-testing.md` for full testing guide.

### 2. Tasks Integration Test
```
1. Go to http://localhost:3000/tasks
2. Find contact workflow tasks (should show Step 3: Request Initial Documents)
3. Click the task card
4. Should redirect to contact page with Workflows tab selected
5. Should highlight the clicked step
6. Complete the step
7. Return to tasks page - should show next step
```

### 3. API Test
```bash
# Get workflows for contact
curl http://localhost:3000/api/contacts/cmgxmy9r000018yc5l7d9xbsg/workflows \
  -H "Cookie: <your-session-cookie>"

# Create new workflow
curl -X POST http://localhost:3000/api/contacts/cmgxmy9r000018yc5l7d9xbsg/workflows \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"templateId": "cmgwptcr50014sw17k965136e"}'
```

## 🐛 Troubleshooting

### "Cannot read properties of undefined (reading 'toISOString')"
- **Fix**: Field name mismatch - should use `createdAt` not `startedAt`
- **Status**: ✅ FIXED

### TypeScript errors in scripts
- **Cause**: Stale Prisma types in VSCode
- **Fix**: Run `npx prisma generate` or use `npx tsx` (bypasses TS check)

### E2E tests fail with connection refused
- **Cause**: Dev server not running
- **Fix**: Start server first: `npm run dev`

### Workflow not showing on contact page
- **Check**: Contact has `workflowInstances` in query
- **Fix**: Verify query includes workflow relations

### Step won't complete
- **Check**: Role permissions (LAWYER can do LAWYER steps, etc.)
- **Check**: Step is in READY or IN_PROGRESS state
- **Check**: Required fields filled (checklist items, approval comments, etc.)

## 📊 Database Queries

### Check workflow state
```sql
SELECT * FROM "WorkflowInstance" 
WHERE "contactId" = 'cmgxmy9r000018yc5l7d9xbsg';
```

### Check step details
```sql
SELECT "order", title, actionType, actionState, "completedAt"
FROM "WorkflowInstanceStep"
WHERE "instanceId" = '<workflow-id>'
ORDER BY "order";
```

### Find READY tasks
```sql
SELECT ws.*, wi."contactId", c."firstName", c."lastName"
FROM "WorkflowInstanceStep" ws
JOIN "WorkflowInstance" wi ON ws."instanceId" = wi.id
LEFT JOIN "Contact" c ON wi."contactId" = c.id
WHERE ws.actionState IN ('READY', 'IN_PROGRESS')
  AND wi."contactId" IS NOT NULL;
```

## 📚 Documentation

- **Full Summary**: `docs/features/CONTACT-WORKFLOWS-SUMMARY.md`
- **Testing Guide**: `docs/runbooks/contact-workflow-testing.md`
- **Master Docs**: `docs/MASTER-SYSTEM-DOCUMENTATION.md`
- **API Spec**: `docs/openapi.yaml` or http://localhost:3000/api/openapi

## ✅ What's Done

- ✅ Database schema with contactId
- ✅ API endpoints for contact workflows
- ✅ UI with workflow timeline (reused from matters)
- ✅ Step execution interface (all 7 action types)
- ✅ Tasks page integration
- ✅ Test scripts for data creation
- ✅ E2E test suite scaffolded
- ✅ Comprehensive testing guide

## ⏭️ What's Next

- ⏸️ Manual UI testing (follow testing guide)
- ⏸️ Add `data-testid` attributes for E2E tests
- ⏸️ Run and fix E2E tests based on actual UI
- ⏸️ Polish UI (loading states, error messages)
- ⏸️ Performance testing with many workflows

## 🎉 Ready to Test!

Open your browser to:
**http://localhost:3000/contacts/cmgxmy9r000018yc5l7d9xbsg**

Click "Workflows" tab and start testing! 🚀
