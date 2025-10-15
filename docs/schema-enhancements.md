# Schema Enhancement Changes

## Migration: `20251015083049_enhanced_schema_improvements`

This migration implements recommendations 1-7 from the schema review to improve data tracking, querying performance, and soft delete capabilities.

---

## 1. Soft Deletes (Audit Trail)

Added soft delete support to maintain data integrity and compliance requirements for legal documents.

### Models Updated:
- **User**: `deletedAt`, `deletedBy`
- **Contact**: `deletedAt`, `deletedBy`
- **Matter**: `deletedAt`, `deletedBy`
- **Document**: `deletedAt`, `deletedBy`
- **Task**: `deletedAt`, `deletedBy`
- **Event**: `deletedAt`, `deletedBy`

**Usage:**
```typescript
// Soft delete a contact
await prisma.contact.update({
  where: { id: contactId },
  data: {
    deletedAt: new Date(),
    deletedBy: userId
  }
});

// Query non-deleted contacts only
const activeContacts = await prisma.contact.findMany({
  where: { deletedAt: null }
});
```

---

## 2. Document Model Enhancements

### New Fields:
- **`metadata`** (Json?): Store custom properties and document-specific data
- **`parentDocumentId`** (String?): Track document versions and revisions
- **Self-relation**: `versions` and `parentDocument` for version history

**Usage:**
```typescript
// Create a new version of a document
const newVersion = await prisma.document.create({
  data: {
    filename: "contract-v2.pdf",
    parentDocumentId: originalDoc.id,
    version: originalDoc.version + 1,
    metadata: {
      changedBy: userId,
      changeReason: "Client requested amendments"
    },
    // ... other fields
  }
});

// Get all versions of a document
const versions = await prisma.document.findMany({
  where: { parentDocumentId: documentId },
  orderBy: { version: 'desc' }
});
```

---

## 3. Matter Model Improvements

### New Fields:
- **`closedAt`** (DateTime?): Track when matter was closed
- **`closedBy`** (String?): Track who closed the matter
- **`estimatedValue`** (Decimal?): Financial estimates for matter
- **`actualValue`** (Decimal?): Actual financial value/billing
- **`createdAt`** (DateTime): Creation timestamp
- **`updatedAt`** (DateTime): Last update timestamp

**Usage:**
```typescript
// Close a matter
await prisma.matter.update({
  where: { id: matterId },
  data: {
    status: 'CLOSED',
    closedAt: new Date(),
    closedBy: userId,
    actualValue: new Decimal(45000.00)
  }
});

// Report on matter values
const matters = await prisma.matter.findMany({
  where: {
    status: 'CLOSED',
    closedAt: {
      gte: new Date('2025-01-01'),
      lte: new Date('2025-12-31')
    }
  },
  select: {
    title: true,
    estimatedValue: true,
    actualValue: true
  }
});
```

---

## 4. Contact Model Extensions

### New Fields:
- **`address`** (String?): Street address
- **`city`** (String?): City
- **`state`** (String?): State/Province
- **`zip`** (String?): Postal/ZIP code
- **`country`** (String?): Country
- **`notes`** (String?): General notes about contact
- **`preferredLanguage`** (String?): Communication preference

**Usage:**
```typescript
// Create contact with full address
const contact = await prisma.contact.create({
  data: {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "USA",
    preferredLanguage: "en",
    notes: "Prefers email communication"
  }
});
```

---

## 5. Workflow Enhancements

### WorkflowInstanceStep - New Fields:
- **`dueDate`** (DateTime?): When the step should be completed
- **`priority`** (TaskPriority?): LOW, MEDIUM, HIGH priority
- **`notes`** (String?): Step-specific notes or comments

**Usage:**
```typescript
// Create workflow step with due date and priority
await prisma.workflowInstanceStep.create({
  data: {
    instanceId: workflowId,
    title: "Review and approve contract",
    dueDate: new Date('2025-10-20'),
    priority: 'HIGH',
    notes: "Client requested expedited review",
    // ... other required fields
  }
});

// Query overdue high-priority steps
const overdueSteps = await prisma.workflowInstanceStep.findMany({
  where: {
    dueDate: { lt: new Date() },
    priority: 'HIGH',
    actionState: { in: ['PENDING', 'IN_PROGRESS'] }
  },
  include: {
    instance: { include: { matter: true } },
    assignedTo: true
  }
});
```

---

## 6. Performance Indexes

### New Indexes Added:

#### User
- `email` - Faster user lookups

#### Contact
- `type` - Filter by contact type
- `status` - Filter by status
- `createdAt` - Chronological sorting

#### Matter
- `status` - Filter by matter status
- `type` - Filter by matter type
- `openedAt` - Filter by opening date
- `createdAt` - Chronological sorting

#### Document
- `parentDocumentId` - Version history queries
- `createdAt` - Chronological sorting

#### Task
- `createdAt` - Chronological sorting

#### Event
- `createdAt` - Chronological sorting

#### WorkflowInstanceStep
- `dueDate` - Due date queries

**Performance Impact:**
These indexes significantly improve query performance for common operations:
- Dashboard views (recent items)
- Status-based filtering
- Date range queries
- Version history lookups

---

## 7. Cascade Delete Strategy Review

All existing `onDelete` strategies were preserved:
- **Cascade**: User sessions, matter parties, task checklists, workflow steps
- **SetNull**: Contact users, document contacts, workflow assignees
- **Restrict**: Workflow templates (prevent deletion if instances exist)

---

## Migration File

Location: `prisma/migrations/20251015083049_enhanced_schema_improvements/migration.sql`

The migration includes:
- ALTER TABLE statements for all new columns
- CREATE INDEX statements for performance
- Foreign key constraints for document versioning

---

## Next Steps

### Recommended Code Updates:

1. **Update queries to exclude soft-deleted records:**
```typescript
// Add to common query functions
const activeFilter = { deletedAt: null };

// Example
const contacts = await prisma.contact.findMany({
  where: { ...activeFilter, ...otherFilters }
});
```

2. **Create utility functions for soft deletes:**
```typescript
// lib/soft-delete.ts
export async function softDelete<T>(
  model: any,
  id: string,
  userId: string
) {
  return model.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy: userId
    }
  });
}
```

3. **Update UI to show document versions:**
```typescript
// components/documents/DocumentVersionHistory.tsx
const versions = await prisma.document.findMany({
  where: {
    OR: [
      { id: documentId },
      { parentDocumentId: documentId }
    ]
  },
  orderBy: { version: 'desc' }
});
```

4. **Add Matter financial reporting:**
```typescript
// app/api/reports/matter-financials/route.ts
const financialSummary = await prisma.matter.aggregate({
  where: { status: 'CLOSED' },
  _sum: {
    estimatedValue: true,
    actualValue: true
  }
});
```

---

## Testing Checklist

- [ ] Verify soft delete functionality for each model
- [ ] Test document version creation and retrieval
- [ ] Test matter closure with financial data
- [ ] Test contact creation with full address
- [ ] Test workflow steps with due dates and priorities
- [ ] Verify index performance improvement on large datasets
- [ ] Update seed data if needed
- [ ] Update API endpoints to handle new fields
- [ ] Update TypeScript types in components

---

## Breaking Changes

⚠️ **None** - All new fields are optional (nullable) to maintain backward compatibility.

However, queries that need to exclude deleted items should be updated:
```typescript
// Before
const matters = await prisma.matter.findMany();

// After
const matters = await prisma.matter.findMany({
  where: { deletedAt: null }
});
```

---

## References

- [Prisma Soft Deletes](https://www.prisma.io/docs/concepts/components/prisma-client/middleware/soft-delete-middleware)
- [Prisma Indexes](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
- [Decimal Type in Prisma](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-decimal)
