# Matters UI Analysis

**Date:** 15 October 2025  
**Scope:** Dashboard matters page and components  
**Status:** Comprehensive Analysis Complete

---

## Executive Summary

The matters UI is **well-structured and feature-rich**, serving as the backbone of the CRM application. It demonstrates **strong integration** with the workflow engine and provides comprehensive matter management capabilities. However, there are **opportunities for significant UX improvements**, particularly in workflow visualization, context management, and mobile responsiveness.

**Overall Grade: B+ (Very Good)**

### Key Strengths
- ✅ Comprehensive CRUD operations for matters
- ✅ Strong workflow integration with real-time state management
- ✅ Multi-entity relationship management (parties, documents, workflows)
- ✅ Role-based access control integration
- ✅ Server-side rendering with client-side interactivity

### Key Weaknesses
- ❌ No workflow context visibility or management UI
- ❌ Limited workflow visualization (3-step preview only)
- ❌ Inconsistent loading states and error handling
- ❌ Mobile responsiveness issues on detail page
- ❌ No bulk operations or advanced filtering

---

## 1. Architecture Overview

### Component Structure

```
app/(dashboard)/matters/
├── page.tsx                    # Server component: list view
└── [id]/page.tsx              # Server component: detail view

components/matters/
├── MattersPageClient.tsx       # Client: list management (253 lines)
├── MatterDetailClient.tsx      # Client: detail management (1,183 lines)
├── MatterCreateDialog.tsx      # Client: creation modal (267 lines)
├── workflow-dialog.tsx         # Client: workflow instantiation (272 lines)
├── PartyCard.tsx              # Client: party display
└── types.ts                   # TypeScript definitions
```

### Data Flow Pattern

```
Server Components (RSC)
    ↓ [Fetch from DB via Prisma]
    ↓ [Transform to serializable types]
    ↓ [Pass as props]
Client Components
    ↓ [useState for local state]
    ↓ [useEffect for side effects]
    ↓ [Fetch API calls]
    ↓ [router.refresh() to sync]
```

**Pattern:** Hybrid SSR + Client-side hydration with optimistic updates

---

## 2. Component Deep Dive

### 2.1 MattersPageClient.tsx (List View)

**Purpose:** Display paginated, filterable list of matters

**Features:**
- 5-field filter system (search, status, type, client, pagination)
- Server-side filtering via query params
- Optimistic UI updates on creation
- Toast notifications
- Responsive table design

**State Management:**
```typescript
- items: MatterListItem[]          // Local copy for optimistic updates
- toast: string | null             // Success/error messages
- filterState: Filters             // Derived from URL params
```

**Strengths:**
- ✅ Clean URL-based filtering (shareable, bookmarkable)
- ✅ Form-based filters with native HTML validation
- ✅ Proper pagination state management
- ✅ Turkish i18n labels

**Issues:**
- ❌ No loading skeleton during filter transitions
- ❌ Table not responsive on mobile (horizontal scroll)
- ❌ No bulk selection/operations
- ❌ No column sorting
- ❌ No filter persistence in localStorage
- ❌ "Temizle" button hardcodes page=1 (loses pageSize)

**UX Score: 7/10** (Good filtering, but lacks polish)

---

### 2.2 MatterDetailClient.tsx (Detail View)

**Purpose:** Comprehensive matter management with workflows

**Sections:**
1. **Header Section** - Title, type, client, workflow 3-step preview
2. **Parties Section** - Add/remove parties with role selection
3. **Documents Section** - Recent 5 docs with detail drawer
4. **Status Update Section** - Status and next hearing date
5. **Workflows Section** - Full workflow management interface
6. **Tasks Section** - Placeholder for Sprint 2

**State Management (15 state variables!):**
```typescript
- status, nextHearingAt             // Matter updates
- toast: ToastState                 // Notifications
- parties: MatterParty[]            // Party list
- partyModalOpen, partyForm         // Party modal
- workflowModalOpen                 // Workflow addition
- workflows: WorkflowInstance[]     // Workflow instances
- stepFormState, stepFormValues     // Step editing
- actionLoading: string | null      // Action progress
- relatedDocs: DocumentListItem[]   // Documents
- selectedDocumentId, selectedDocument // Doc drawer
```

**Strengths:**
- ✅ Comprehensive workflow step management (add, edit, move, delete)
- ✅ Real-time action execution (start, claim, complete, fail, skip)
- ✅ Smart workflow summary (3-step prev/current/next preview)
- ✅ Inline step editing with JSON config
- ✅ Role-based workflow removal
- ✅ Document drawer integration
- ✅ Contact hover cards

**Issues:**
- ❌ **CRITICAL:** No workflow context visibility/management
- ❌ 1,183 lines in a single component (needs refactoring)
- ❌ 15 useState calls (state management complexity)
- ❌ Workflow steps not collapsible (long lists are unwieldy)
- ❌ No step search/filter
- ❌ No workflow timeline visualization
- ❌ Action buttons not grouped logically
- ❌ Modal-based forms instead of inline editing
- ❌ No undo/redo for step operations
- ❌ No workflow template preview before instantiation
- ❌ Loading states inconsistent (some buttons, not all)
- ❌ No keyboard shortcuts
- ❌ JSON config textarea error-prone (needs schema validation UI)

**UX Score: 6.5/10** (Functional but overwhelming)

---

### 2.3 MatterCreateDialog.tsx

**Purpose:** Modal form for creating new matters

**Features:**
- 7-field form (title, type, status, client, jurisdiction, court, nextHearing)
- Client-side validation
- Optimistic UI callback
- Auto-refresh after creation

**Strengths:**
- ✅ Simple, focused form
- ✅ Proper error handling
- ✅ Loading states

**Issues:**
- ❌ No field-level validation messages
- ❌ No auto-save to localStorage
- ❌ Required fields not visually distinct
- ❌ No keyboard shortcuts (Enter to submit, Esc to close)

**UX Score: 7.5/10** (Solid but basic)

---

### 2.4 workflow-dialog.tsx

**Purpose:** Select and instantiate workflow templates

**Features:**
- Fetch all templates
- Select one template
- View template steps preview
- Instantiate on matter

**Strengths:**
- ✅ Clean template selection
- ✅ Step preview before instantiation

**Issues:**
- ❌ No template search/filter
- ❌ No template comparison
- ❌ No step customization before instantiation
- ❌ No context initialization UI

**UX Score: 7/10** (Basic functionality)

---

## 3. Workflow Integration Analysis

### 3.1 Workflow State Visualization

**Current Implementation:**
```tsx
// 3-step preview: prev → current → next
<div className="mt-4 flex items-stretch gap-3">
  <div className={`flex-1 rounded-xl border px-4 py-3 ${getStepClasses("prev")}`}>
    {/* Previous step */}
  </div>
  <div className="flex items-center px-1">→</div>
  <div className={`flex-1 rounded-xl border px-4 py-3 ${getStepClasses("current")}`}>
    {/* Current step */}
  </div>
  <div className="flex items-center px-1">→</div>
  <div className={`flex-1 rounded-xl border px-4 py-3 ${getStepClasses("next")}`}>
    {/* Next step */}
  </div>
</div>
```

**Color Coding:**
- `COMPLETED` - Green (emerald-200/50)
- `FAILED` - Red (red-200/50)
- `READY` - Blue (blue-200/50)
- `IN_PROGRESS` - Amber (amber-200/50)
- `BLOCKED` - Red (red-200/50)
- `SKIPPED` - Gray (slate-200/50)
- `PENDING` - Gray (slate-200/50)

**Issues:**
- ❌ Only 3 steps visible (long workflows hidden)
- ❌ No progress percentage
- ❌ No timeline view
- ❌ No Gantt chart or dependency graph
- ❌ No estimated completion date

---

### 3.2 Workflow Context Integration

**CRITICAL GAP: No context UI exists!**

The backend implementation (`/lib/workflows/context.ts` with 12 helper functions) is complete, but there's **zero UI** to:
- View context data
- Edit context values
- See context history
- Visualize data flow between steps

**Impact:** Medium-High Priority
- Users cannot leverage shared context feature
- No visibility into workflow data flow
- Debugging workflows is difficult
- Context becomes "black box" to users

**Recommendation:** **Priority 1 - Implement Context UI**

---

### 3.3 Workflow Action Buttons

**Current Implementation:**
```tsx
{step.actionState === "READY" && (
  <button onClick={() => runStepAction(step.id, "start")}>Başlat</button>
)}
{step.actionState === "READY" && !step.assignedToId && (
  <button onClick={() => runStepAction(step.id, "claim")}>Sahiplen</button>
)}
{step.actionState === "IN_PROGRESS" && (
  <>
    <button onClick={() => runStepAction(step.id, "complete")}>Tamamla</button>
    <button onClick={() => { /* prompt */ }}>Hata</button>
  </>
)}
<button onClick={() => openEditStep(...)}>Düzenle</button>
<button onClick={() => moveStep(..., -1)}>Yukarı</button>
<button onClick={() => moveStep(..., 1)}>Aşağı</button>
<button onClick={() => deleteStep(...)}>Sil</button>
```

**Issues:**
- ❌ 8+ buttons per step (visual clutter)
- ❌ No button grouping or dropdown menus
- ❌ No keyboard shortcuts
- ❌ Action buttons not contextual (all shown always)
- ❌ Destructive actions (delete) not visually distinct
- ❌ No confirmation modals for critical actions (only window.confirm)

---

## 4. Data Flow & State Management

### 4.1 Server ↔ Client Synchronization

**Pattern:**
```typescript
// Server component fetches initial data
const matters = await prisma.matter.findMany(...)

// Pass to client component
<MattersPageClient matters={matters} />

// Client makes updates via API
const response = await fetch('/api/matters', { method: 'POST', ... })

// Sync back to server
router.refresh()
```

**Strengths:**
- ✅ Initial SSR for SEO and performance
- ✅ Client-side interactivity
- ✅ `router.refresh()` keeps data fresh

**Issues:**
- ❌ `router.refresh()` refetches entire page (inefficient)
- ❌ No optimistic updates for all mutations
- ❌ No real-time updates (WebSocket/SSE)
- ❌ Race conditions possible (concurrent edits)

---

### 4.2 Loading States

**Current Implementation:**
```typescript
const [loading, setLoading] = useState(false)
const [workflowsLoading, setWorkflowsLoading] = useState(false)
const [docsLoading, setDocsLoading] = useState(false)
const [actionLoading, setActionLoading] = useState<string | null>(null)
const [downloadingId, setDownloadingId] = useState<string | null>(null)
```

**Issues:**
- ❌ 5 separate loading states (complex)
- ❌ No skeleton screens
- ❌ Inconsistent loading indicators
- ❌ No global loading context

**Recommendation:** Use React Query or SWR for unified loading states

---

### 4.3 Error Handling

**Current Implementation:**
```typescript
try {
  const response = await fetch(...)
  if (!response.ok) {
    throw new Error("...")
  }
  // success
} catch (error) {
  console.error(error)
  showToast("error", "...")
}
```

**Strengths:**
- ✅ Try-catch blocks in all API calls
- ✅ Toast notifications for errors

**Issues:**
- ❌ Generic error messages ("Beklenmeyen bir hata oluştu")
- ❌ No error boundaries
- ❌ No retry mechanism
- ❌ No offline detection
- ❌ Errors logged to console but not tracked (no Sentry/analytics)

---

## 5. Accessibility & UX

### 5.1 Accessibility

**Strengths:**
- ✅ Semantic HTML (table, form, section)
- ✅ `aria-disabled` on pagination links
- ✅ `data-testid` attributes for testing

**Issues:**
- ❌ No `aria-label` on icon buttons
- ❌ No `aria-live` regions for toast notifications
- ❌ No focus management in modals
- ❌ No keyboard navigation for step actions
- ❌ Color contrast issues (slate-500 on white = 4.5:1, needs 7:1 for AAA)
- ❌ No screen reader announcements for workflow state changes

**WCAG Score: C (Partial compliance)**

---

### 5.2 Mobile Responsiveness

**Current Implementation:**
```tsx
// List page
<form className="grid gap-4 ... md:grid-cols-5">
<div className="flex items-end gap-3 md:col-span-2">

// Detail page
<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
```

**Strengths:**
- ✅ Grid layouts with breakpoints
- ✅ Filters stack on mobile

**Issues:**
- ❌ Table horizontal scroll on mobile (not responsive)
- ❌ Workflow action buttons wrap poorly on mobile
- ❌ 3-step preview too wide on mobile
- ❌ Modal forms not optimized for mobile
- ❌ No touch gestures (swipe to delete, pull to refresh)

**Mobile Score: 6/10** (Functional but not optimized)

---

### 5.3 Internationalization

**Current Status:**
- Mixed Turkish/English labels
- No i18n framework (next-intl, react-i18next)
- Hardcoded strings in components

**Examples:**
```tsx
<h2>Matters</h2>  // English
<p>Davalarınızı filtreleyin</p>  // Turkish
<button>Yeni Dava</button>  // Turkish
<span>PENDING</span>  // English enum
```

**Issues:**
- ❌ Inconsistent language
- ❌ No locale switching
- ❌ Date formatting hardcoded to "tr-TR"
- ❌ No RTL support

---

## 6. Performance Analysis

### 6.1 Bundle Size

**MatterDetailClient.tsx Metrics:**
- **1,183 lines** of code
- **15 useState** calls
- **10+ fetch** calls
- **Estimated bundle impact:** ~50-60KB (minified)

**Issues:**
- ❌ Single monolithic component (code splitting needed)
- ❌ All workflow logic in one file
- ❌ No lazy loading for modals/drawers

**Recommendation:** Split into smaller components

---

### 6.2 Render Performance

**Potential Issues:**
```typescript
// Useless re-renders on every workflow state change
const workflowSummary = useMemo(() => { ... }, [workflows])

// useEffect runs on every render
useEffect(() => {
  void loadWorkflowInstances()
  void loadRelatedDocuments()
}, [])  // Missing dependencies

// Inline function creation in loops
{workflows.map((workflow) => (
  <button onClick={() => openAddStep(workflow.id)}>...</button>
))}
```

**Recommendations:**
- Use React DevTools Profiler
- Implement `React.memo` for step cards
- Use `useCallback` for handlers
- Add dependency arrays to `useEffect`

---

## 7. Code Quality

### 7.1 TypeScript Usage

**Strengths:**
- ✅ Strong typing for API responses
- ✅ Enum types for status/state
- ✅ Type definitions in `types.ts`

**Issues:**
- ❌ `Record<string, unknown>` for context (too loose)
- ❌ Type assertions with `as` operator
- ❌ Optional chaining overuse (`matter.client?.name ?? "—"`)
- ❌ Inline type definitions (not reusable)

**Example of inline duplication:**
```typescript
// MatterDetailClient.tsx
type ActionType = "APPROVAL_LAWYER" | ...  // Duplicated
type ActionState = "PENDING" | ...         // Duplicated
type RoleScope = "ADMIN" | ...            // Duplicated

// Should import from lib/workflows/types.ts
```

---

### 7.2 Component Organization

**Current Structure:**
```tsx
export function MatterDetailClient({ ... }) {
  // 15 useState declarations (lines 1-120)
  // 5 useMemo hooks (lines 121-200)
  // 3 useEffect hooks (lines 201-250)
  // 15 handler functions (lines 251-600)
  // 5 render functions (lines 601-800)
  // Main JSX return (lines 801-1183)
}
```

**Issues:**
- ❌ No logical separation
- ❌ Hard to test (no isolated functions)
- ❌ Hard to reuse (no extracted hooks)

**Recommended Refactor:**
```tsx
// Extract custom hooks
const useWorkflows = (matterId: string) => { ... }
const useParties = (matterId: string) => { ... }
const useDocuments = (matterId: string) => { ... }

// Extract sub-components
<WorkflowSection workflows={workflows} onUpdate={...} />
<PartiesSection parties={parties} onAdd={...} />
<DocumentsSection documents={docs} onOpen={...} />
```

---

## 8. Testing Coverage

**Current State:**
- `data-testid` attributes present
- No visible test files in workspace structure
- Playwright config exists (`playwright.config.ts`)

**Missing Tests:**
- ❌ Unit tests for components
- ❌ Integration tests for workflows
- ❌ E2E tests for matter CRUD
- ❌ Visual regression tests

**Recommendation:** Prioritize E2E tests for critical flows

---

## 9. Priority Recommendations

### 🔴 Critical (Do First)

1. **Implement Workflow Context UI**
   - **Why:** Backend feature complete but unusable without UI
   - **Components:**
     - `WorkflowContextPanel.tsx` - View/edit context data
     - `ContextHistoryLog.tsx` - Track context changes
     - Add to `MatterDetailClient.tsx`
   - **Effort:** 2-3 days
   - **Impact:** HIGH (unlocks workflow data flow)

2. **Refactor MatterDetailClient.tsx**
   - **Why:** 1,183 lines unmaintainable, performance issues
   - **Approach:** Extract 5-7 smaller components + custom hooks
   - **Effort:** 3-4 days
   - **Impact:** HIGH (maintainability, performance)

3. **Fix Mobile Responsiveness**
   - **Why:** Poor mobile UX (table scroll, button wrapping)
   - **Changes:** 
     - Replace table with card layout on mobile
     - Collapse workflow sections
     - Mobile-friendly action menus
   - **Effort:** 2 days
   - **Impact:** MEDIUM-HIGH (user experience)

---

### 🟡 High Priority (Do Next)

4. **Improve Workflow Visualization**
   - **Current:** 3-step preview only
   - **Add:**
     - Full workflow timeline view
     - Progress percentage bar
     - Collapsible step groups
     - Dependency graph (if step dependencies implemented)
   - **Effort:** 3-4 days
   - **Impact:** MEDIUM-HIGH (workflow clarity)

5. **Implement State Management Library**
   - **Why:** 15 useState calls, complex loading states
   - **Options:** React Query, Zustand, or Jotai
   - **Benefits:**
     - Automatic caching
     - Optimistic updates
     - Unified loading states
     - Background refetching
   - **Effort:** 4-5 days
   - **Impact:** HIGH (code quality, UX)

6. **Add Bulk Operations**
   - **Why:** No way to operate on multiple matters
   - **Features:**
     - Checkbox selection
     - Bulk status update
     - Bulk workflow assignment
     - Bulk delete
   - **Effort:** 2-3 days
   - **Impact:** MEDIUM (power user efficiency)

---

### 🟢 Medium Priority (Nice to Have)

7. **Keyboard Shortcuts**
   - `n` - New matter
   - `f` - Focus search
   - `Escape` - Close modals
   - `Ctrl+S` - Save changes
   - Arrow keys - Navigate steps

8. **Advanced Filtering**
   - Date range filters
   - Multi-select filters
   - Save filter presets
   - Filter by workflow status

9. **Real-time Updates**
   - WebSocket connection
   - Live workflow state changes
   - Collaborative editing indicators

10. **Accessibility Improvements**
    - Add ARIA labels
    - Keyboard navigation
    - Screen reader announcements
    - Focus management

---

### 🔵 Low Priority (Future Enhancements)

11. **Workflow Template Builder UI**
    - Visual drag-drop step ordering
    - Step configuration wizard
    - Template versioning UI

12. **Analytics Dashboard**
    - Average matter duration
    - Workflow bottleneck analysis
    - Step completion rates
    - Matter status distribution

13. **Export/Import**
    - Export matters to PDF/Excel
    - Import matters from CSV
    - Workflow template import/export

---

## 10. Implementation Roadmap

### Phase 1: Critical Fixes (Week 1-2)
```
Day 1-2:  Workflow Context UI
Day 3-5:  MatterDetailClient refactor
Day 6-7:  Mobile responsiveness
Day 8-10: Testing & bug fixes
```

### Phase 2: High Priority (Week 3-4)
```
Day 11-13: Workflow visualization improvements
Day 14-17: State management library migration
Day 18-20: Bulk operations
```

### Phase 3: Medium Priority (Week 5-6)
```
Day 21-22: Keyboard shortcuts
Day 23-25: Advanced filtering
Day 26-28: Real-time updates
Day 29-30: Accessibility audit & fixes
```

---

## 11. Detailed Component Refactor Plan

### Before: MatterDetailClient.tsx (1,183 lines)
```tsx
export function MatterDetailClient({ ... }) {
  // Everything in one component
}
```

### After: Modular Structure
```
components/matters/detail/
├── MatterDetailClient.tsx        # Orchestrator (150 lines)
├── MatterHeader.tsx              # Title, client, workflow preview
├── WorkflowSection/
│   ├── index.tsx                 # Section container
│   ├── WorkflowCard.tsx          # Single workflow instance
│   ├── WorkflowStepList.tsx      # Step list with actions
│   ├── WorkflowStepCard.tsx      # Single step card
│   ├── WorkflowContextPanel.tsx  # NEW: Context UI
│   └── WorkflowTimeline.tsx      # NEW: Timeline view
├── PartiesSection/
│   ├── index.tsx
│   ├── PartyList.tsx
│   └── AddPartyModal.tsx
├── DocumentsSection/
│   ├── index.tsx
│   └── DocumentList.tsx
├── StatusUpdateSection/
│   └── index.tsx
└── hooks/
    ├── useWorkflows.ts           # Workflow state + API
    ├── useParties.ts             # Party state + API
    ├── useDocuments.ts           # Document state + API
    └── useMatterUpdate.ts        # Matter update API
```

---

## 12. Workflow Context UI Specification

### 12.1 Component: WorkflowContextPanel

**Location:** Within workflow instance card, collapsible section

**Features:**
- View current context as key-value pairs
- Edit context values (string, number, boolean, array, object)
- Add new context keys
- Delete context keys
- View context change history
- Filter/search context keys
- Export context as JSON

**Mockup:**
```
┌─ Workflow Context ──────────────────────────────────────┐
│ ⚡ Context Data (3 keys)                   [Edit] [+Add] │
├──────────────────────────────────────────────────────────┤
│ 🔑 clientApproved                                        │
│    Value: true                                    [Edit] │
│    Type: boolean                                         │
│    Updated: Step #2 (2 hours ago)                        │
├──────────────────────────────────────────────────────────┤
│ 🔑 documents                                             │
│    Value: ["doc1.pdf", "doc2.pdf"]               [Edit] │
│    Type: string[]                                        │
│    Updated: Step #4 (1 hour ago)                         │
├──────────────────────────────────────────────────────────┤
│ 🔑 paymentAmount                                         │
│    Value: 5000.00                                 [Edit] │
│    Type: number                                          │
│    Updated: Step #3 (1.5 hours ago)                      │
└──────────────────────────────────────────────────────────┘
```

**API Integration:**
```typescript
// GET context
const response = await fetch(`/api/workflows/instances/${instanceId}/context`)
const context = await response.json()

// PATCH context
await fetch(`/api/workflows/instances/${instanceId}/context`, {
  method: 'PATCH',
  body: JSON.stringify({ updates: { clientApproved: true }, mode: 'merge' })
})
```

---

### 12.2 Component: ContextEditModal

**Purpose:** Edit a single context value with type-safe inputs

**Fields:**
- Key (string, readonly if editing)
- Type (select: string, number, boolean, array, object)
- Value (dynamic input based on type)
  - String: text input
  - Number: number input
  - Boolean: checkbox
  - Array: multi-line textarea (JSON)
  - Object: multi-line textarea (JSON)
- Validate JSON for complex types

---

## 13. Code Examples

### 13.1 Extract useWorkflows Hook

**Before:**
```typescript
// In MatterDetailClient.tsx (50+ lines)
const [workflows, setWorkflows] = useState<WorkflowInstance[]>([])
const [workflowsLoading, setWorkflowsLoading] = useState(false)
async function loadWorkflowInstances() { ... }
useEffect(() => { void loadWorkflowInstances() }, [])
```

**After:**
```typescript
// hooks/useWorkflows.ts
export function useWorkflows(matterId: string) {
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/workflows/instances?matterId=${matterId}`)
      if (!response.ok) throw new Error("Failed to load workflows")
      const data = await response.json()
      setWorkflows(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      setLoading(false)
    }
  }, [matterId])

  useEffect(() => { void load() }, [load])

  return { workflows, loading, error, reload: load }
}

// In MatterDetailClient.tsx
const { workflows, loading, reload } = useWorkflows(matter.id)
```

---

### 13.2 WorkflowContextPanel Component

```tsx
"use client"

import { useEffect, useState } from "react"
import type { WorkflowContext } from "@/lib/workflows/types"

type WorkflowContextPanelProps = {
  instanceId: string
}

export function WorkflowContextPanel({ instanceId }: WorkflowContextPanelProps) {
  const [context, setContext] = useState<WorkflowContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  useEffect(() => {
    void loadContext()
  }, [instanceId])

  async function loadContext() {
    setLoading(true)
    try {
      const response = await fetch(`/api/workflows/instances/${instanceId}/context`)
      if (!response.ok) throw new Error("Failed to load context")
      const data = await response.json()
      setContext(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function updateValue(key: string, value: unknown) {
    try {
      const response = await fetch(`/api/workflows/instances/${instanceId}/context`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { [key]: value }, mode: "merge" })
      })
      if (!response.ok) throw new Error("Failed to update context")
      await loadContext()
    } catch (err) {
      console.error(err)
      alert("Failed to update context value")
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading context...</p>
  if (!context || Object.keys(context).length === 0) {
    return <p className="text-sm text-slate-500">No context data yet.</p>
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">
        Workflow Context ({Object.keys(context).length} keys)
      </h4>
      <div className="mt-3 space-y-3">
        {Object.entries(context).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {key}
                </div>
                <div className="mt-1 text-sm text-slate-900">
                  {typeof value === "object" ? (
                    <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>
                  ) : (
                    String(value)
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Type: {Array.isArray(value) ? "array" : typeof value}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingKey(key)}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 14. Testing Strategy

### 14.1 Unit Tests (Vitest)

**Targets:**
- Custom hooks (`useWorkflows`, `useParties`)
- Utility functions
- State reducers

**Example:**
```typescript
// hooks/__tests__/useWorkflows.test.ts
import { renderHook, waitFor } from "@testing-library/react"
import { useWorkflows } from "../useWorkflows"

describe("useWorkflows", () => {
  it("should load workflows on mount", async () => {
    const { result } = renderHook(() => useWorkflows("matter-123"))
    
    expect(result.current.loading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    expect(result.current.workflows).toHaveLength(2)
  })
})
```

---

### 14.2 Integration Tests (React Testing Library)

**Targets:**
- Component rendering
- User interactions
- API mocking

**Example:**
```typescript
// components/matters/__tests__/MatterDetailClient.test.tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { MatterDetailClient } from "../MatterDetailClient"

describe("MatterDetailClient", () => {
  it("should show workflow context panel", async () => {
    render(<MatterDetailClient matter={mockMatter} contacts={[]} />)
    
    const contextButton = screen.getByText(/Context/)
    fireEvent.click(contextButton)
    
    expect(await screen.findByText(/clientApproved/)).toBeInTheDocument()
  })
})
```

---

### 14.3 E2E Tests (Playwright)

**Critical Flows:**
1. Create new matter
2. Add party to matter
3. Instantiate workflow
4. Execute workflow step (start → complete)
5. Edit workflow context
6. Filter matters list

**Example:**
```typescript
// tests/e2e/matters.spec.ts
import { test, expect } from "@playwright/test"

test("should create and manage matter workflow", async ({ page }) => {
  await page.goto("/matters")
  
  // Create matter
  await page.click('button:has-text("Yeni Dava")')
  await page.fill('input[name="title"]', "Test Matter")
  await page.selectOption('select[name="type"]', "CIVIL")
  await page.selectOption('select[name="clientId"]', { index: 1 })
  await page.click('button[type="submit"]')
  
  await expect(page.locator('text=Test Matter')).toBeVisible()
  
  // Navigate to detail page
  await page.click('a:has-text("Test Matter")')
  
  // Add workflow
  await page.click('button:has-text("Add Workflow")')
  await page.click('text=Contact to Client Workflow')
  await page.click('button:has-text("Instantiate")')
  
  await expect(page.locator('text=Workflow added')).toBeVisible()
  
  // Start first step
  await page.click('button:has-text("Başlat")')
  await expect(page.locator('text=IN_PROGRESS')).toBeVisible()
  
  // Complete step
  await page.click('button:has-text("Tamamla")')
  await expect(page.locator('text=COMPLETED')).toBeVisible()
})
```

---

## 15. Performance Optimization Plan

### 15.1 Code Splitting

**Current:** All components bundled together

**Target:**
```typescript
// Lazy load heavy components
const WorkflowDialog = lazy(() => import("./workflow-dialog"))
const DocumentDetailDrawer = lazy(() => import("@/components/documents/DocumentDetailDrawer"))
const AddPartyModal = lazy(() => import("./AddPartyModal"))

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <WorkflowDialog {...props} />
</Suspense>
```

**Expected Impact:** -20% initial bundle size

---

### 15.2 Memoization

**Before:**
```typescript
{workflows.map((workflow) => (
  <WorkflowCard key={workflow.id} workflow={workflow} />
))}
```

**After:**
```typescript
const WorkflowCard = memo(({ workflow }: { workflow: WorkflowInstance }) => {
  // Component implementation
}, (prev, next) => prev.workflow.id === next.workflow.id)

{workflows.map((workflow) => (
  <WorkflowCard key={workflow.id} workflow={workflow} />
))}
```

---

### 15.3 Virtualization

**Current:** All steps rendered (100+ steps = slow)

**Target:**
```typescript
import { useVirtualizer } from "@tanstack/react-virtual"

const virtualizer = useVirtualizer({
  count: workflow.steps.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120, // Step card height
})

<div ref={parentRef} style={{ height: "600px", overflow: "auto" }}>
  <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
    {virtualizer.getVirtualItems().map((virtualRow) => {
      const step = workflow.steps[virtualRow.index]
      return <WorkflowStepCard key={step.id} step={step} />
    })}
  </div>
</div>
```

---

## 16. Conclusion

The matters UI is **functionally complete** and demonstrates strong integration with the workflow engine. However, it suffers from:
- **Complexity:** 1,183-line component
- **UX gaps:** No context UI, limited visualization
- **Mobile:** Poor responsiveness
- **Maintainability:** Refactoring needed

**Recommended Next Steps:**
1. ✅ Implement workflow context UI (Priority 1)
2. ✅ Refactor MatterDetailClient into smaller components
3. ✅ Fix mobile responsiveness issues
4. ✅ Add React Query for state management
5. ✅ Improve workflow visualization (timeline, progress bar)

**Estimated Effort:** 4-5 weeks for all Priority 1-2 items

**Expected Outcome:** Grade upgrade from **B+** to **A-** or **A**

---

## Appendix A: File Metrics

| File | Lines | Components | State Variables | API Calls | Complexity |
|------|-------|------------|-----------------|-----------|------------|
| MattersPageClient.tsx | 253 | 1 | 2 | 0 | Low |
| MatterDetailClient.tsx | 1,183 | 1 | 15 | 10+ | Very High |
| MatterCreateDialog.tsx | 267 | 1 | 4 | 1 | Medium |
| workflow-dialog.tsx | 272 | 1 | 4 | 2 | Medium |
| PartyCard.tsx | ~50 | 1 | 0 | 0 | Low |
| **Total** | **2,025+** | **5** | **25** | **13+** | **High** |

---

## Appendix B: API Endpoints Used

| Endpoint | Method | Purpose | Component |
|----------|--------|---------|-----------|
| `/api/matters` | GET | List matters | MattersPageClient |
| `/api/matters` | POST | Create matter | MatterCreateDialog |
| `/api/matters/:id` | GET | Get matter detail | [id]/page.tsx |
| `/api/matters/:id` | PATCH | Update matter | MatterDetailClient |
| `/api/matters/:id/parties` | POST | Add party | MatterDetailClient |
| `/api/matters/:id/parties/:id` | DELETE | Remove party | MatterDetailClient |
| `/api/workflows/templates` | GET | List templates | workflow-dialog |
| `/api/workflows/templates/:id/instantiate` | POST | Create instance | workflow-dialog |
| `/api/workflows/instances` | GET | List instances | MatterDetailClient |
| `/api/workflows/instances/:id` | DELETE | Remove instance | MatterDetailClient |
| `/api/workflows/instances/:id/steps` | POST | Add step | MatterDetailClient |
| `/api/workflows/instances/:id/steps/:id` | PATCH | Update step | MatterDetailClient |
| `/api/workflows/instances/:id/steps/:id` | DELETE | Delete step | MatterDetailClient |
| `/api/workflows/instances/:id/advance` | POST | Advance workflow | MatterDetailClient |
| `/api/workflows/steps/:id/start` | POST | Start step | MatterDetailClient |
| `/api/workflows/steps/:id/claim` | POST | Claim step | MatterDetailClient |
| `/api/workflows/steps/:id/complete` | POST | Complete step | MatterDetailClient |
| `/api/workflows/steps/:id/fail` | POST | Fail step | MatterDetailClient |
| `/api/workflows/steps/:id/skip` | POST | Skip step | MatterDetailClient |
| `/api/documents` | GET | List documents | MatterDetailClient |
| `/api/documents/:id/download` | GET | Download document | MatterDetailClient |
| `/api/workflows/instances/:id/context` | GET | Get context | **MISSING UI** |
| `/api/workflows/instances/:id/context` | PATCH | Update context | **MISSING UI** |

**Total:** 22 endpoints, **2 not used in UI**

---

**End of Analysis**
