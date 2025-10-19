# LEAD Workflow Template: Client Intake Process

## Overview
A comprehensive 7-step workflow template designed specifically for managing the client intake process for new leads, from initial contact through engagement.

**Template Name**: Client Intake Process  
**Version**: 1  
**Status**: Active ✅  
**Created**: October 18, 2025  

---

## Workflow Steps

### Step 0: Initial Contact Checklist
**Action Type**: `CHECKLIST`  
**Role**: `LAWYER`  
**Purpose**: Document and verify initial contact information

**Checklist Items**:
- ✓ Record initial contact details
- ✓ Verify contact information (phone, email)
- ✓ Document nature of legal issue
- ✓ Check for conflicts of interest
- ✓ Set follow-up reminder

**When to Complete**: Immediately upon first contact with lead

---

### Step 1: Conflict Check Approval
**Action Type**: `APPROVAL_LAWYER`  
**Role**: `LAWYER`  
**Purpose**: Review conflict check results and approve proceeding with intake

**Approval Message**: "Review conflict check results and approve to proceed with client intake."

**Approver Role**: LAWYER

**When to Complete**: After initial contact checklist is completed and conflicts are checked

**What Happens Next**: Upon approval, automated document request is sent to client

---

### Step 2: Request Initial Documents from Client
**Action Type**: `REQUEST_DOC_CLIENT`  
**Role**: `CLIENT`  
**Purpose**: Collect essential documents from the potential client

**Request Text**:
```
Please upload the following documents to begin your case evaluation:
- Government-issued ID
- Any relevant contracts or agreements
- Supporting documentation related to your legal matter
```

**Accepted File Types**:
- PDF (application/pdf)
- PNG images (image/png)
- JPEG images (image/jpeg)

**Client Action**: Upload required documents through portal

---

### Step 3: Client Intake Questionnaire
**Action Type**: `POPULATE_QUESTIONNAIRE`  
**Role**: `CLIENT`  
**Purpose**: Gather detailed background information about the client and their legal matter

**Questionnaire Details**:
- **Title**: Client Background Information
- **Description**: Please provide detailed information about yourself and your legal matter

**Dynamic Generation**: System generates relevant questions based on matter type and case details

**Client Action**: Complete questionnaire through portal

---

### Step 4: Engagement Letter Signature
**Action Type**: `SIGNATURE_CLIENT`  
**Role**: `CLIENT`  
**Purpose**: Obtain client signature on engagement letter

**Configuration**:
- **Provider**: Mock (for development/testing)
- **Document**: Engagement letter document ID from seed data

**Client Action**: Review and electronically sign engagement letter

**Legal Binding**: Creates attorney-client relationship upon completion

---

### Step 5: Collect Retainer Payment
**Action Type**: `PAYMENT_CLIENT`  
**Role**: `CLIENT`  
**Purpose**: Collect initial retainer payment to secure services

**Payment Details**:
- **Amount**: $2,500.00 USD
- **Currency**: USD
- **Provider**: Mock (for development/testing)

**Client Action**: Submit payment through secure portal

**Note**: Amount can be adjusted per case basis in production

---

### Step 6: Final Intake Review
**Action Type**: `WRITE_TEXT`  
**Role**: `LAWYER`  
**Purpose**: Document intake summary and next steps for case team

**Prompt**: "Summarize the client intake process and any special notes or action items for the case team."

**Requirements**:
- Minimum length: 100 characters
- Should include:
  - Key takeaways from intake
  - Special considerations
  - Recommended next steps
  - Any red flags or concerns

**When to Complete**: After all client-facing steps are completed

**Output**: Serves as case opening memo for internal team

---

## Workflow Execution Flow

```
[Start] → Initial Contact Checklist (Lawyer)
           ↓
       Conflict Check Approval (Lawyer)
           ↓
       Request Documents (Client Portal)
           ↓
       Intake Questionnaire (Client Portal)
           ↓
       Sign Engagement Letter (Client Portal)
           ↓
       Pay Retainer (Client Portal)
           ↓
       Final Review Summary (Lawyer)
           ↓
        [Complete] → Ready to convert LEAD to CLIENT and create Matter
```

---

## Use Cases

### Perfect For:
- ✅ New leads from marketing campaigns
- ✅ Referrals from existing clients
- ✅ Prospective clients from consultations
- ✅ Cold inquiries requiring intake process
- ✅ Any contact type: LEAD, WITNESS, EXPERT being converted to CLIENT

### Not Suitable For:
- ❌ Existing clients (already completed intake)
- ❌ Opposing parties or adversarial contacts
- ❌ Emergency matters requiring immediate action
- ❌ Pro bono cases with waived retainer

---

## Integration with Contact Management

### Starting the Workflow

1. Navigate to contact detail page (`/contacts/{contactId}`)
2. Click "Workflows" tab
3. Click "Start Workflow" button
4. Select "Client Intake Process (v1)" from dropdown
5. Click "Start Workflow" to initiate

### Monitoring Progress

**Tasks Page Integration**:
- All workflow steps appear in `/tasks` page
- Filter by "Contact Workflows" to see LEAD-related tasks
- Click task → redirects to contact detail page
- Complete steps directly from task cards

**Contact Page Tracking**:
- Progress bar shows completion percentage
- Step indicators show status (✓ ⏱ ✗ ○)
- See assigned users for each step
- View detailed step information

---

## Auto-Assignment Logic

Steps are automatically assigned based on `roleScope`:

| Step | Role Scope | Auto-Assigned To |
|------|-----------|------------------|
| 0. Initial Contact Checklist | LAWYER | Contact owner |
| 1. Conflict Check Approval | LAWYER | Contact owner |
| 2. Request Documents | CLIENT | Contact's linked user (if exists) |
| 3. Intake Questionnaire | CLIENT | Contact's linked user (if exists) |
| 4. Sign Engagement Letter | CLIENT | Contact's linked user (if exists) |
| 5. Pay Retainer | CLIENT | Contact's linked user (if exists) |
| 6. Final Review | LAWYER | Contact owner |

**Note**: Contact must have an `ownerId` for lawyer steps to be auto-assigned. Client steps require portal user account.

---

## Portal Access Requirements

### For Client Steps (2-5):
Contact must have:
1. ✅ Valid email address
2. ✅ Portal user account (`User.role = CLIENT`)
3. ✅ Account activated (not pending)
4. ✅ Linked to contact record (`Contact.userId`)

### Setup Process:
1. From contact page, click "Invite to Portal"
2. System sends activation email
3. Client activates account via link
4. Client can now complete workflow steps in portal

**Portal URL**: `/portal/workflows` or `/portal/tasks`

---

## Customization Options

### Adjusting Retainer Amount
Edit Step 5 action config:
```typescript
actionConfig: {
  amount: 5000, // Change to your standard retainer
  currency: "USD",
  provider: "stripe" // Change to real payment provider
}
```

### Modifying Document Requirements
Edit Step 2 action config:
```typescript
actionConfig: {
  requestText: "Custom request message...",
  acceptedTypes: ["application/pdf", "application/msword", "image/*"]
}
```

### Adding/Removing Checklist Items
Edit Step 0 action config:
```typescript
actionConfig: {
  items: [
    "Your custom checklist item",
    "Another item",
    // Add or remove as needed
  ]
}
```

---

## Performance Metrics

Track workflow effectiveness:

| Metric | Description | Goal |
|--------|-------------|------|
| **Completion Rate** | % of workflows completed | >80% |
| **Average Duration** | Time from start to finish | <7 days |
| **Drop-off Point** | Most common step where clients abandon | Monitor Step 2-3 |
| **Conversion Rate** | LEADs → CLIENTs via this workflow | >60% |

**Query Example**:
```sql
SELECT 
  COUNT(*) as total_workflows,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
  AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt"))/86400) as avg_days
FROM "WorkflowInstance"
WHERE "templateId" = 'client-intake-template-id'
  AND "createdAt" > NOW() - INTERVAL '30 days';
```

---

## Troubleshooting

### Issue: Client can't see workflow steps in portal
**Solution**: 
1. Verify contact has `userId` linked
2. Check user role is `CLIENT`
3. Confirm account is activated
4. Ensure workflow is in `ACTIVE` status

### Issue: Steps not auto-assigning
**Solution**:
1. Check contact has `ownerId` set
2. Verify owner user exists and is active
3. Ensure roleScope matches available users
4. Manually assign if auto-assignment fails

### Issue: Payment step fails
**Solution**:
1. For mock provider: Should always succeed (testing)
2. For real provider: Check API keys and configuration
3. Verify amount is positive and currency is valid
4. Check client has payment method on file

---

## Related Documentation

- **Contact Workflows Implementation**: `/docs/features/LEAD-WORKFLOWS-IMPLEMENTATION.md`
- **Workflow System Overview**: `/docs/MASTER-SYSTEM-DOCUMENTATION.md` (Section: Workflows)
- **Action Handler Registry**: `/lib/workflows/handlers/index.ts`
- **Portal Access Setup**: `/docs/features/PORTAL-ACCESS.md`
- **API Documentation**: `/docs/openapi.yaml` (Workflow endpoints)

---

## Next Steps After Workflow Completion

Once all 7 steps are completed:

1. **Review Final Summary**: Check lawyer's notes from Step 6
2. **Convert Contact**: Change type from LEAD to CLIENT
3. **Create Matter**: Open new matter for the case
4. **Assign Team**: Add paralegals, associate lawyers to matter
5. **Start Case Workflow**: Begin matter-specific workflows (Discovery, Litigation, etc.)
6. **Archive Intake Docs**: Move intake documents to matter folder
7. **Send Welcome Packet**: Email client with case information and next steps

**Automation Opportunity**: Consider creating a "LEAD → CLIENT Conversion" workflow to handle these steps automatically.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1 | Oct 18, 2025 | Initial template created with 7 steps | System Admin |

---

**Status**: ✅ Ready for Production  
**Last Updated**: October 18, 2025  
**Maintained By**: Legal CRM Development Team
