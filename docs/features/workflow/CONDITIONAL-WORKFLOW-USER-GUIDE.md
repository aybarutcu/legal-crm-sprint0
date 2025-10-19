# Conditional Workflow Logic - User Guide

**Version**: 1.0  
**Last Updated**: October 19, 2025  
**Audience**: Lawyers, Paralegals, Admins creating workflow templates

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Creating Simple Conditions](#creating-simple-conditions)
4. [Creating Compound Conditions (AND/OR)](#creating-compound-conditions-andor)
5. [Workflow Branching](#workflow-branching)
6. [Common Use Cases](#common-use-cases)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Introduction

### What is Conditional Logic?

Conditional logic allows workflow steps to execute only when certain conditions are met. This enables dynamic, branching workflows that adapt to different client types, matter statuses, or other runtime data.

### Why Use Conditional Logic?

**Without Conditional Logic**:
- All clients go through the same steps
- Manual intervention needed to skip irrelevant steps
- Extra work for staff to manage exceptions

**With Conditional Logic**:
- Corporate clients automatically get corporate-specific steps
- Pre-approved clients skip manual approval
- Workflows adapt automatically based on data
- Reduced manual work and errors

### Example Scenario

**Before**:
```
1. Collect Info
2. Request Corporate Docs     ← Everyone gets this (wrong for individuals)
3. Request Individual ID      ← Everyone gets this (wrong for corporates)
4. Review
```

**After**:
```
1. Collect Info
2. Request Corporate Docs     ← IF contactType == "CORPORATE"
3. Request Individual ID      ← IF contactType != "CORPORATE"
4. Review
```

Now corporate clients only see step 2, individuals only see step 3!

---

## Getting Started

### Accessing the Workflow Template Editor

1. Navigate to **Dashboard** → **Workflows** → **Templates**
2. Click **"+ Create Template"** or **"Edit"** an existing draft template
3. You'll see the template editor with steps listed

### Anatomy of a Conditional Step

Each step has:

1. **Basic Info** (always present):
   - Step Title
   - Action Type (TASK, APPROVAL, etc.)
   - Role Scope (who executes it)
   - Required (must be completed?)

2. **Conditional Logic** (new section):
   - Execution Condition (ALWAYS, IF TRUE, IF FALSE)
   - Condition Configuration (what to check)
   - Branching (where to go next)

---

## Creating Simple Conditions

### Step-by-Step: Make a Step Conditional

1. **Scroll to the "Conditional Logic" section** in the step editor

2. **Change "Execution Condition"** from "Always Execute" to "Execute if Condition is True"

3. **You'll see a condition editor appear**:
   ```
   ┌────────────────────────────────────────┐
   │ Condition                              │
   │                                        │
   │ Field Path:  [contactType      ▼]     │
   │ Operator:    [equals           ▼]     │
   │ Value:       [CORPORATE         ]     │
   └────────────────────────────────────────┘
   ```

4. **Fill in the condition**:
   - **Field Path**: The data field to check (e.g., `contactType`, `approvalDecision`)
   - **Operator**: How to compare (equals, greater than, contains, etc.)
   - **Value**: What to compare against (e.g., `"CORPORATE"`, `true`, `5`)

5. **Save the template**

### Example: Corporate Document Request

**Goal**: Only request corporate documents from corporate clients.

**Configuration**:
```
Step Title: Request Corporate Documents
Action Type: REQUEST_DOC_CLIENT
Execution Condition: Execute if Condition is True
Condition:
  ├─ Field Path: contactType
  ├─ Operator: equals
  └─ Value: CORPORATE
```

**Result**: This step only runs when `contactType` equals `"CORPORATE"`. Individual clients will skip it automatically.

### Field Autocomplete

When you type in the Field Path, you'll see suggestions:

```
Contact Type (contactType)
  Type of contact (LEAD, CLIENT, etc.)

Matter Status (matterStatus)
  Current matter status

Approval Decision (approvalDecision)
  Result of approval step (APPROVED/REJECTED)

Document Count (documentCount)
  Number of documents collected

Is Pre-Approved (isPreApproved)
  Whether contact is pre-approved
```

Click any suggestion to auto-fill the field path.

### Available Operators

#### Comparison (for numbers and dates)
- **equals (==)** - Exact match
- **not equals (!=)** - Not a match
- **greater than (>)** - Numeric comparison
- **less than (<)** - Numeric comparison
- **greater or equal (>=)** - Numeric comparison
- **less or equal (<=)** - Numeric comparison

#### String (for text)
- **contains** - Substring match (`"John Doe"` contains `"John"`)
- **starts with** - Prefix match (`"Mr. Smith"` starts with `"Mr."`)
- **ends with** - Suffix match (`"file.pdf"` ends with `".pdf"`)

#### Array (for lists)
- **in list** - Value is in the array (`"TX"` in `["TX", "CA", "NY"]`)
- **not in list** - Value is not in the array

#### Existence (check if field has a value)
- **exists** - Field is not null/undefined (no value needed)
- **is empty** - Field is null/undefined/empty (no value needed)
- **is not empty** - Field has a value (no value needed)

**Note**: Existence operators don't require a value - the value input will be hidden.

---

## Creating Compound Conditions (AND/OR)

### When to Use Compound Conditions

Use **AND** when ALL conditions must be true:
- "Collect payment if approved AND documents complete"
- "Send to lawyer if urgent AND high-value"

Use **OR** when ANY condition can be true:
- "Request signature if payment received OR waived"
- "Skip step if pre-approved OR referral client"

### Step-by-Step: Create AND Condition

1. **Set execution condition** to "Execute if Condition is True"

2. **Click "AND/OR" button** (top right of condition configuration)

3. **You'll see a compound condition editor**:
   ```
   ┌──────────────────────────────────────────────┐
   │ Compound Condition  [AND (all must match) ▼]│
   ├──────────────────────────────────────────────┤
   │ Condition 1                                  │
   │ approvalDecision  [equals ▼]  APPROVED       │
   │                                              │
   │ Condition 2                                  │
   │ documentCount     [>= ▼]      3              │
   │                                              │
   │ [+ Add Condition] [+ Add AND/OR Group]       │
   └──────────────────────────────────────────────┘
   ```

4. **Fill in both conditions**:
   - First condition: `approvalDecision == "APPROVED"`
   - Second condition: `documentCount >= 3`

5. **Save the template**

### Example: Payment Collection

**Goal**: Only collect payment if approved AND documents are complete.

**Configuration**:
```
Step Title: Collect Payment
Action Type: PAYMENT_CLIENT
Execution Condition: Execute if Condition is True
Compound Condition (AND):
  ├─ Condition 1: approvalDecision equals "APPROVED"
  └─ Condition 2: documentCount >= 3
```

**Result**: Payment step only runs when BOTH conditions are true.

### Nested Compound Conditions

You can nest AND/OR groups up to 3 levels deep:

```
AND
├─ contactType equals "CORPORATE"
├─ OR
│  ├─ isUrgent equals true
│  └─ matterValue > 50000
└─ documentCount >= 2
```

**Reads as**: "Corporate client AND (urgent OR high-value) AND 2+ documents"

**To Add Nesting**:
1. Click **"+ Add AND/OR Group"** in the compound condition
2. A new nested group appears
3. Fill in sub-conditions
4. Change AND/OR operator as needed

**Limit**: Maximum 3 levels of nesting to prevent overly complex logic.

---

## Workflow Branching

### What is Branching?

By default, steps execute sequentially (1 → 2 → 3 → 4). **Branching** lets you skip steps based on conditions:

```
     ┌─ TRUE ─→ Step 5 (skip 3-4)
Step 2
     └─ FALSE → Step 3 (continue)
```

### Step-by-Step: Add Branching

1. **Create a conditional step** (IF TRUE or IF FALSE)

2. **Scroll to "Branching" section** (below condition configuration)

3. **You'll see two dropdowns**:
   ```
   ┌─────────────────────────────────────────┐
   │ Branching (Optional)                    │
   │                                         │
   │ ✓ If Condition TRUE → Go to Step:      │
   │   [Step 5 ▼]                            │
   │                                         │
   │ ✗ If Condition FALSE → Go to Step:     │
   │   [Next Step ▼]                         │
   └─────────────────────────────────────────┘
   ```

4. **Set target steps**:
   - **If TRUE**: Where to jump if condition is true (or "Next Step" for sequential)
   - **If FALSE**: Where to jump if condition is false (or "Next Step" for sequential)

5. **Save the template**

### Example: Skip Manual Approval for Pre-Approved Clients

**Goal**: Pre-approved clients skip manual review and go straight to payment.

**Workflow Steps**:
```
1. Collect Info
2. Check Pre-Approval Status
3. Manual Review
4. Additional Verification
5. Payment
```

**Step 2 Configuration**:
```
Step Title: Check Pre-Approval Status
Action Type: WRITE_TEXT (just checks the flag)
Execution Condition: Execute if Condition is True
Condition:
  ├─ Field Path: isPreApproved
  ├─ Operator: equals
  └─ Value: true

Branching:
  ├─ If TRUE → Go to Step: 5 (skip to payment)
  └─ If FALSE → Next Step (continue to step 3)
```

**Execution Flow**:
- **Pre-approved client**: Steps 1 → 2 → 5 (skips 3-4)
- **Regular client**: Steps 1 → 2 → 3 → 4 → 5 (all steps)

### When Steps Are Skipped

Skipped steps show as **SKIPPED** in the workflow instance with a reason:
```
Step 3: Manual Review
Status: SKIPPED
Reason: Step 2 condition evaluated to TRUE, branched to Step 5
```

This appears in the audit trail for transparency.

---

## Common Use Cases

### Use Case 1: Different Documents for Different Client Types

**Scenario**: Corporate clients need incorporation docs, individuals need ID.

**Solution**:
```
Step 2: Request Corporate Docs
  Condition: IF TRUE
    ├─ contactType == "CORPORATE"

Step 3: Request Individual ID
  Condition: IF FALSE
    ├─ contactType == "CORPORATE"
```

**Execution**:
- Corporate: Step 2 runs, Step 3 skipped
- Individual: Step 2 skipped, Step 3 runs

---

### Use Case 2: Skip Steps for Referrals

**Scenario**: Referral clients skip verification because they're trusted.

**Solution**:
```
Step 3: Background Verification
  Condition: IF FALSE
    ├─ source == "REFERRAL"

Step 4: Additional Checks
  Condition: IF FALSE
    ├─ source == "REFERRAL"
```

**Execution**:
- Referral: Steps 3-4 skipped
- Other sources: Steps 3-4 run

---

### Use Case 3: Urgent Matter Fast Track

**Scenario**: Urgent matters skip non-critical steps and go straight to lawyer.

**Solution**:
```
Step 2: Initial Review
  Condition: IF TRUE
    ├─ isUrgent == true
  Branching:
    ├─ If TRUE → Step 5 (lawyer review)
    └─ If FALSE → Next Step

Step 3: Detailed Analysis (skipped for urgent)
Step 4: Risk Assessment (skipped for urgent)
Step 5: Lawyer Review
```

**Execution**:
- Urgent: Steps 1 → 2 → 5 (fast track)
- Normal: Steps 1 → 2 → 3 → 4 → 5 (full process)

---

### Use Case 4: Payment Only After Approval and Docs

**Scenario**: Collect payment only when approved AND all docs received.

**Solution**:
```
Step 5: Payment Collection
  Condition: IF TRUE (AND)
    ├─ approvalDecision == "APPROVED"
    └─ documentCount >= 3
```

**Execution**:
- Approved + 3 docs: Payment runs
- Any other state: Payment skipped

---

### Use Case 5: Multi-Language Support

**Scenario**: Send Spanish instructions if client prefers Spanish.

**Solution**:
```
Step 3: Send English Instructions
  Condition: IF FALSE
    ├─ preferredLanguage == "SPANISH"

Step 4: Send Spanish Instructions
  Condition: IF TRUE
    ├─ preferredLanguage == "SPANISH"
```

**Execution**:
- English-speaking: Step 3 runs, Step 4 skipped
- Spanish-speaking: Step 3 skipped, Step 4 runs

---

## Troubleshooting

### Problem: Condition Not Working

**Symptom**: Step runs when it shouldn't, or doesn't run when it should.

**Solutions**:
1. **Check field spelling**: Field names are case-sensitive (`contactType` ≠ `ContactType`)
2. **Check value type**: Use `5` for numbers, `"5"` for strings, `true` for booleans
3. **Check context**: Use browser console to inspect workflow context (advanced)
4. **Test condition**: Use validation API to test with sample data (developer feature)

### Problem: All Steps Being Skipped

**Symptom**: Workflow completes with all steps marked SKIPPED.

**Solutions**:
1. **Check branching**: Ensure at least one path leads to remaining steps
2. **Check required steps**: Required steps with conditions can cause issues
3. **Verify context data**: Ensure workflow context has the fields you're checking

### Problem: Can't Save Template

**Symptom**: Save button does nothing or shows error.

**Solutions**:
1. **Check validation**: Look for red error messages in the form
2. **IF_TRUE/IF_FALSE needs config**: You must provide a condition configuration
3. **Compound needs 2+ conditions**: AND/OR must have at least 2 sub-conditions
4. **Invalid operator**: Make sure operator exists (check dropdown)

### Problem: Value Input Not Showing

**Symptom**: Value field disappears when selecting operator.

**Solution**: This is correct behavior for existence operators (`exists`, `isEmpty`, `isNotEmpty`). These operators don't need a value.

### Problem: Field Suggestions Not Showing

**Symptom**: Autocomplete dropdown doesn't appear.

**Solutions**:
1. **Start typing**: Dropdown only shows when you've typed at least one character
2. **Click the input**: Make sure the field is focused
3. **Clear and retype**: Sometimes need to delete and start over

---

## FAQ

### Q: Can I use conditional logic with all action types?

**A**: Yes! All action types (TASK, APPROVAL, CHECKLIST, PAYMENT, etc.) support conditional execution.

### Q: What happens to required steps with conditions?

**A**: If a required step's condition is FALSE, it's marked SKIPPED. The workflow can still complete because the system knows it was skipped due to conditions, not skipped manually.

**Best Practice**: Avoid making conditional steps required. Use required=false for flexibility.

### Q: How do I know which fields are available?

**A**: When you type in the Field Path input, you'll see autocomplete suggestions showing available fields. Common fields:
- `contactType`
- `matterType`
- `approvalDecision`
- `documentCount`
- `isPreApproved`
- `paymentStatus`

Workflow handlers can add custom fields to the context.

### Q: Can I test a condition before saving?

**A**: Currently, condition testing is only available via API (`POST /api/workflows/validate-condition`). UI testing is on the roadmap.

**Workaround**: Save the template as a draft, create a test workflow instance, and verify execution.

### Q: What's the difference between IF_TRUE and IF_FALSE?

**A**:
- **IF_TRUE**: "Run this step if condition is true"
- **IF_FALSE**: "Run this step if condition is false"

They're opposites. Use whichever reads more naturally:
- `IF_TRUE: contactType == "CORPORATE"` ← Run for corporates
- `IF_FALSE: contactType == "CORPORATE"` ← Run for non-corporates

### Q: Can I change conditions on an active template?

**A**: No. Active templates can't be edited (to protect running workflow instances).

**Workflow**:
1. Click "New Version" on the active template
2. Edit the new draft version
3. Publish when ready (becomes new active version)

### Q: How deep can I nest compound conditions?

**A**: Maximum 3 levels to prevent overly complex logic. Example:
```
AND (Level 1)
├─ Condition
└─ OR (Level 2)
   ├─ Condition
   └─ AND (Level 3) ← Max depth
      ├─ Condition
      └─ Condition
```

### Q: What operators should I use for text fields?

**A**: Depends on use case:
- **Exact match**: `equals` (`contactType == "CORPORATE"`)
- **Partial match**: `contains` (`clientName contains "LLC"`)
- **Prefix**: `startsWith` (`matterNumber startsWith "2025-"`)
- **Suffix**: `endsWith` (`documentName endsWith ".pdf"`)

### Q: Can conditions check multiple fields?

**A**: Yes! Use compound conditions (AND/OR):
```
AND
├─ contactType == "CORPORATE"
└─ matterValue > 50000
```

This checks both fields.

### Q: What if a field doesn't exist in the context?

**A**: The condition evaluates based on the operator:
- **equals, contains, etc.**: Evaluates to FALSE (field treated as null/undefined)
- **exists**: FALSE (field doesn't exist)
- **isEmpty**: TRUE (field is undefined, which is empty)

**Best Practice**: Use `exists` first to check if a field is available, then check its value in a nested condition.

### Q: Can I see why a step was skipped?

**A**: Yes! In the workflow instance view, skipped steps show a reason:
```
Step 2: Corporate Documents
Status: SKIPPED
Reason: Condition evaluated to FALSE (contactType: "INDIVIDUAL" != "CORPORATE")
```

This appears in the step details and audit log.

---

## Getting Help

### Documentation
- **Technical Docs**: `/docs/MASTER-SYSTEM-DOCUMENTATION.md`
- **Phase 5 Completion**: `/docs/features/workflow/P0.1-PHASE5-COMPLETION.md`
- **API Reference**: `http://localhost:3000/api/openapi`

### Support
- **In-App**: Use the help icon (?) in the workflow editor
- **Email**: support@legalcrm.local (if configured)
- **Developer**: Check browser console for detailed error messages

### Tips for Success
1. **Start Simple**: Begin with ALWAYS steps, add conditions later
2. **Use Descriptive Titles**: Include condition summary (e.g., "Corporate Docs (if corporate)")
3. **Test Thoroughly**: Create test workflow instances with different data
4. **Document Context**: Add comments in template description explaining available fields
5. **Avoid Over-Nesting**: Prefer simple conditions over 3-level nested AND/OR logic

---

**Happy Workflow Building!** 🎉
