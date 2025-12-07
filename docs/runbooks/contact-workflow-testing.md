# Contact Workflow Testing Guide

## Overview
This guide walks through manual testing of the LEAD contact workflow system.

## Prerequisites
1. Development server running: `npm run dev`
2. Test LEAD contact created with workflow (use test script)

## Test Contact Details
- **ID**: `cmgxmy9r000018yc5l7d9xbsg`
- **Name**: Test Lead
- **Email**: test-lead@example.com
- **Type**: LEAD
- **Workflow**: Client Intake Process (7 steps)

## Test Scripts

### 1. Create/Reset Test Data
```bash
# Run the test workflow setup
npx tsx scripts/test-lead-workflow.ts
```

### 2. Complete Individual Steps
```bash
# Complete the next READY step
npx tsx scripts/complete-lead-workflow-step.ts cmgxmy9r000018yc5l7d9xbsg

# Run multiple times to progress through workflow
```

### 3. View Current State
```bash
# Query workflow state from database
npx prisma studio
# Navigate to WorkflowInstance and WorkflowInstanceStep tables
```

## Manual UI Testing Checklist

### Test 1: Contact Page - Workflows Tab

**Steps**:
1. Start dev server: `npm run dev`
2. Login as admin: http://localhost:3000/login
   - Email: `admin@legalcrm.test`
   - Password: `admin123`
3. Navigate to contact: http://localhost:3000/contacts/cmgxmy9r000018yc5l7d9xbsg
4. Click "Workflows" tab

**Expected**:
- ✅ Horizontal workflow timeline displays
- ✅ "Client Intake Process" workflow visible
- ✅ 7 steps shown in timeline
- ✅ Completed steps show checkmark (green)
- ✅ READY step highlighted (blue/green border)
- ✅ PENDING steps grayed out
- ✅ Progress indicator shows "X/7 steps"

**Screenshot locations**: Document any issues

---

### Test 2: Step Selection and Detail Panel

**Steps**:
1. From Workflows tab (Test 1)
2. Click on a READY step in the timeline
3. Observe the detail panel below

**Expected**:
- ✅ Detail panel appears below timeline
- ✅ Step title displayed prominently
- ✅ Action type badge shows (e.g., "Document Request")
- ✅ Role scope shows ("CLIENT" or "LAWYER")
- ✅ Status badge shows current state
- ✅ Action-specific UI renders:
  - **CHECKLIST**: List of items with checkboxes
  - **APPROVAL**: Approve/Reject buttons + comment field
  - **REQUEST_DOC**: File upload interface
  - **POPULATE_QUESTIONNAIRE**: Dynamic form
  - **SIGNATURE**: Signature pad
  - **PAYMENT**: Payment details form
  - **WRITE_TEXT**: Rich text editor

---

### Test 3: Step Execution - Checklist

**Steps**:
1. Navigate to Test Lead contact workflows tab
2. If Step 0 (Initial Contact Checklist) is READY:
   - Click on the step
   - Check all 5 checklist items
   - Click "Complete" button
3. If already completed, reset using script

**Expected**:
- ✅ Checkboxes are interactive
- ✅ Complete button enabled only when items checked
- ✅ On click, API call succeeds (check Network tab)
- ✅ Step updates to COMPLETED state
- ✅ Next step (Step 1) becomes READY
- ✅ Progress bar updates to "1/7"
- ✅ Timeline auto-scrolls to next step

**Validation**:
```bash
# Check database
npx prisma studio
# Verify:
# - Step 0: actionState = COMPLETED, completedAt filled
# - Step 1: actionState = READY
```

---

### Test 4: Step Execution - Approval

**Steps**:
1. Ensure Step 1 (Conflict Check Approval) is READY
   - If not, complete previous steps
2. Click on Step 1 in timeline
3. Enter approval comment: "All conflicts cleared"
4. Click "Approve" button

**Expected**:
- ✅ Comment field accepts text
- ✅ Approve button triggers API call
- ✅ Step updates to COMPLETED
- ✅ Step 2 becomes READY
- ✅ Progress: "2/7"
- ✅ `actionData` includes approval comment

---

### Test 5: Unified Tasks Page Integration

**Steps**:
1. From dashboard, click "Tasks" in sidebar
2. Look for contact workflow steps in task list

**Expected**:
- ✅ READY/IN_PROGRESS workflow steps appear
- ✅ Task card shows:
  - Step title
  - Workflow name
  - Contact name (Test Lead)
  - Due date (if set)
  - Priority badge
- ✅ Task card has "LEAD" or contact type indicator
- ✅ Clicking task card redirects to `/contacts/{id}`
- ✅ After redirect, Workflows tab is auto-selected
- ✅ Clicked step is highlighted in timeline

---

### Test 6: Task Completion from Tasks Page

**Steps**:
1. Go to `/tasks`
2. Find a READY contact workflow task
3. Click the task card → redirects to contact page
4. Complete the step from the detail panel
5. Observe URL and state

**Expected**:
- ✅ Redirect maintains contact page context
- ✅ Workflow timeline visible immediately
- ✅ Selected step shows in detail panel
- ✅ After completion, state updates
- ✅ User can continue with next step without navigating away

---

### Test 7: Multiple Workflows on Same Contact

**Steps**:
1. On Test Lead contact, click "Start Workflow" button
2. Select "Client Intake Process" again (if available)
3. Create second workflow instance

**Expected**:
- ✅ Both workflows display in separate timelines
- ✅ Each workflow has independent progress
- ✅ Clicking steps from different workflows works
- ✅ Detail panel updates based on selected workflow/step
- ✅ No cross-contamination of state

---

### Test 8: Role-Based Access

**Steps**:
1. Login as different roles:
   - LAWYER: `lawyer1@legalcrm.test` / `lawyer123`
   - PARALEGAL: `paralegal1@legalcrm.test` / `paralegal123`
   - CLIENT: (should not access contact workflows)
2. Navigate to Test Lead contact
3. Try to execute steps with different `roleScope`

**Expected**:
- ✅ LAWYER can execute LAWYER-scoped steps
- ✅ LAWYER can execute CLIENT-scoped steps (on behalf)
- ✅ CLIENT role redirects to portal (cannot access /contacts)
- ✅ PARALEGAL sees workflows but may have limited actions
- ✅ Action buttons disabled if role doesn't match

---

### Test 9: Workflow Progress Visualization

**Steps**:
1. Complete 0 steps → Progress: 0/7 (0%)
2. Complete 1 step → Progress: 1/7 (14%)
3. Complete 3 steps → Progress: 3/7 (43%)
4. Complete all 7 → Progress: 7/7 (100%), Workflow COMPLETED

**Expected**:
- ✅ Progress bar fills proportionally
- ✅ Percentage shown or calculated correctly
- ✅ Visual feedback clear (color change?)
- ✅ Final step completion updates workflow status
- ✅ Workflow status badge shows "COMPLETED"

---

### Test 10: Error Handling

**Steps**:
1. Try to complete step with missing required data
2. Try to access step for different user's contact
3. Try to complete already-completed step
4. Network failure simulation (disconnect wifi mid-action)

**Expected**:
- ✅ Validation errors shown (required fields)
- ✅ Permission errors handled gracefully
- ✅ Completed steps show as disabled/read-only
- ✅ Network errors show toast notification
- ✅ No data corruption on partial failures
- ✅ State rollback on errors

---

## Automated Test Execution

### E2E Tests
```bash
# Run all contact workflow E2E tests
npm run e2e -- tests/e2e/contact-workflows.spec.ts

# Run with UI (watch mode)
npm run e2e -- tests/e2e/contact-workflows.spec.ts --ui

# Run specific test
npm run e2e -- tests/e2e/contact-workflows.spec.ts --grep "timeline"
```

### Unit Tests
```bash
# Test workflow API endpoints
npm test -- tests/api/contacts

# Test workflow utilities
npm test -- tests/unit/workflows
```

## Database Validation Queries

### Check Workflow State
```sql
-- In Prisma Studio or psql
SELECT 
  wi.id,
  wi.status,
  wi.contactId,
  wt.name as template_name,
  COUNT(ws.id) as total_steps,
  COUNT(CASE WHEN ws.actionState = 'COMPLETED' THEN 1 END) as completed_steps
FROM "WorkflowInstance" wi
JOIN "WorkflowTemplate" wt ON wi."templateId" = wt.id
LEFT JOIN "WorkflowInstanceStep" ws ON wi.id = ws."instanceId"
WHERE wi."contactId" = 'cmgxmy9r000018yc5l7d9xbsg'
GROUP BY wi.id, wi.status, wi.contactId, wt.name;
```

### Check Step Details
```sql
SELECT 
  "order",
  title,
  actionType,
  actionState,
  "startedAt",
  "completedAt"
FROM "WorkflowInstanceStep"
WHERE "instanceId" = '<workflow-instance-id>'
ORDER BY "order";
```

## Success Criteria

All tests pass when:
- [x] Contact workflow timeline displays all steps correctly
- [x] Step selection shows detail panel with action UI
- [x] Each action type (7 total) can be executed
- [x] Step state transitions work (PENDING → READY → IN_PROGRESS → COMPLETED)
- [x] Next step automatically becomes READY after completion
- [x] Progress bar updates accurately
- [x] Tasks page shows contact workflow steps
- [x] Redirect from tasks page to contact page works
- [x] Multiple workflows on same contact are isolated
- [x] Role-based permissions enforced
- [x] Error handling prevents invalid states
- [x] Database state matches UI state

## Known Issues / Limitations

Document any bugs found during testing:

1. **Issue**: [Description]
   - **Severity**: Critical / High / Medium / Low
   - **Steps to Reproduce**: 
   - **Expected**: 
   - **Actual**: 
   - **Workaround**: 

## Performance Notes

Monitor these metrics during testing:
- Page load time for contact page with workflows
- Timeline render time with 10+ steps
- API response time for step execution
- Memory usage with multiple workflow instances

## Next Steps

After completing all manual tests:
1. Update E2E tests to match actual UI structure
2. Add data-testid attributes for reliable selectors
3. Create automated regression test suite
4. Document any UI improvements needed
5. Plan for additional action types
