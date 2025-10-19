# Workflow System - Current Limitations

> **Quick Reference**: What workflows CAN'T do (yet)  
> **Date**: October 19, 2025  
> **Status**: Baseline before enhancements

---

## 🚫 What Workflows Currently Cannot Do

### 1. **No Branching/Decision Trees**
❌ **Can't**: Make decisions based on previous step outcomes  
✅ **Can**: Execute steps in linear order only

**Example of what's NOT possible**:
```
Step 1: Lawyer approval
  ├─ If approved → Step 2A: Send to client
  └─ If rejected → Step 2B: Request revision
```

**Current workaround**: Create separate workflows for each path

---

### 2. **No Parallel Execution**
❌ **Can't**: Run multiple steps simultaneously  
✅ **Can**: Execute steps one after another only

**Example of what's NOT possible**:
```
Step 1: Initial review
   ├─ Step 2A: Lawyer review    (parallel)
   ├─ Step 2B: Paralegal check  (parallel)
   └─ Step 2C: Admin filing     (parallel)
Step 3: Proceed when all complete
```

**Current workaround**: Create sequential steps and manually coordinate

---

### 3. **No Flexible Dependencies**
❌ **Can't**: Define custom step prerequisites  
✅ **Can**: Only wait for previous step in sequence

**Example of what's NOT possible**:
```
Step 5 waits for Step 2 AND Step 4 (not just Step 4)
Step 7 waits for Step 3 OR Step 6 (whichever finishes first)
```

**Current workaround**: Careful manual ordering

---

### 4. **No Timeout/SLA Enforcement**
❌ **Can't**: Auto-escalate or fail on deadline  
✅ **Can**: Track when steps started/completed

**Example of what's NOT possible**:
```
- Send reminder if step not started in 2 days
- Escalate to supervisor if not done in 7 days
- Auto-fail if legal deadline passes
```

**Current workaround**: Manual monitoring and follow-up

---

### 5. **No Email Automation**
❌ **Can't**: Send automated emails as workflow steps  
✅ **Can**: Manually send emails outside workflow

**Example of what's NOT possible**:
```
Step 3: Send contract to client via email
  - To: {{clientEmail}}
  - Subject: Your contract for case {{caseNumber}}
  - Attach: Generated document
```

**Current workaround**: Manual email sending

---

### 6. **No Document Generation**
❌ **Can't**: Generate documents from templates  
✅ **Can**: Request document uploads

**Example of what's NOT possible**:
```
Step 2: Generate contract from template
  - Template: standard_contract.docx
  - Variables: clientName, caseNumber, date
  - Output: PDF attached to matter
```

**Current workaround**: Manual document creation

---

### 7. **No Calendar Integration**
❌ **Can't**: Auto-create calendar events  
✅ **Can**: Create events separately

**Example of what's NOT possible**:
```
Step 5: Schedule follow-up meeting
  - Date: 7 days from today
  - Attendees: lawyer, client
  - Auto-add to calendars
```

**Current workaround**: Manually create events

---

### 8. **No Task Integration**
❌ **Can't**: Auto-create tasks in task system  
✅ **Can**: Create tasks separately

**Example of what's NOT possible**:
```
Step 3: Create task "Review documents"
  - Assign to: {{assignedLawyer}}
  - Due: 3 days from now
  - Priority: HIGH
```

**Current workaround**: Manually create tasks

---

### 9. **No Rollback/Compensation**
❌ **Can't**: Undo completed steps on failure  
✅ **Can**: Mark workflow as failed

**Example of what's NOT possible**:
```
Step 3 fails
  → Rollback Step 2: Delete generated invoice
  → Rollback Step 1: Refund payment
```

**Current workaround**: Manual cleanup

---

### 10. **No Sub-Workflows**
❌ **Can't**: Call other workflows as nested processes  
✅ **Can**: Start separate workflows manually

**Example of what's NOT possible**:
```
Step 4: Execute "Document Collection" sub-workflow
  - Pass data: clientId, caseNumber
  - Wait for completion
  - Continue with results
```

**Current workaround**: Copy steps between workflows

---

### 11. **No External API Calls**
❌ **Can't**: Call third-party APIs as workflow steps  
✅ **Can**: Manually integrate outside workflow

**Example of what's NOT possible**:
```
Step 6: Call court e-filing API
  - Endpoint: https://court-api.gov/file
  - Method: POST
  - Auth: API key
  - Store response in workflow context
```

**Current workaround**: Manual API integration

---

### 12. **No Loops/Iteration**
❌ **Can't**: Repeat steps until condition met  
✅ **Can**: Execute each step once only

**Example of what's NOT possible**:
```
Loop: For each document in list
  - Step 1: Request review
  - Step 2: Wait for approval
  - Step 3: Store result
Continue when all documents reviewed
```

**Current workaround**: Create multiple workflow instances

---

## 📊 Impact Assessment

### High Impact (Work Blocked)
- ❌ Branching/Decisions → Many legal workflows need conditional paths
- ❌ SLA/Timeouts → Legal deadlines are critical
- ❌ Email Automation → Communication is key to workflows
- ❌ Document Generation → Core legal function

### Medium Impact (Manual Workarounds)
- ⚠️ Parallel Execution → Reduces efficiency
- ⚠️ Task Integration → Extra manual work
- ⚠️ Calendar Integration → Scheduling friction
- ⚠️ Flexible Dependencies → Limits workflow complexity

### Low Impact (Nice to Have)
- 💡 Sub-Workflows → Can copy steps instead
- 💡 Rollback → Manual cleanup works
- 💡 External APIs → Can integrate outside workflow
- 💡 Loops → Can create multiple instances

---

## 🎯 Recommended Reading Order

1. **Current Limitations** (this doc) - Understand constraints
2. **WORKFLOW-BACKLOG.md** - See planned enhancements
3. **WORKFLOW-ANALYSIS.md** - Deep dive into gaps
4. **workflow-context-guide.md** - Learn available features

---

## 💡 Tips for Working Within Limitations

### Use Workflow Context Effectively
Store data between steps using `ctx.updateContext()`:
```typescript
// Step 1: Collect data
ctx.updateContext({ clientApproved: true, amount: 50000 });

// Step 2: Use data
const approved = ctx.context.clientApproved;
if (approved) { /* manual conditional in handler */ }
```

### Design Atomic Workflows
Create smaller, focused workflows instead of complex ones:
- ✅ "Client Onboarding" (5 steps)
- ✅ "Document Review" (3 steps)
- ❌ "Complete Case Management" (50 steps with conditions)

### Use Manual Coordination
For complex dependencies:
1. Complete Workflow A
2. Manually start Workflow B with data from A
3. Use workflow context to pass data

### Leverage CHECKLIST for Parallel-ish Work
Break parallel work into checklist items:
```typescript
{
  actionType: "CHECKLIST",
  items: [
    "Lawyer review (John)",
    "Paralegal check (Sarah)",
    "Admin filing (Mary)"
  ]
}
```

---

## 🚀 When Will These Be Fixed?

See **WORKFLOW-BACKLOG.md** for implementation roadmap:
- **Phase 1** (2-3 weeks): Conditional logic, dependencies, SLA tracking
- **Phase 2** (2-3 weeks): Email, document generation, calendar integration
- **Phase 3** (2 weeks): Parallel execution, sub-workflows
- **Phase 4** (1-2 weeks): Rollback, external APIs

---

**Last Updated**: October 19, 2025  
**Review After**: Each backlog phase completion
