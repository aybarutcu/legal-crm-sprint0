# Visual Workflow Builder - Quick Reference

## What is it?

Transform the workflow template editor from a **form-only** approach to an **interactive visual canvas** where users can drag, drop, and connect workflow steps like a flowchart.

## Current vs Target

### Current State
```
📝 Form Mode          →  📊 Graph Mode (read-only)
(Edit via forms)          (View dependencies)
```

### Target State
```
📝 Form Mode  ↔  🎨 Canvas Mode  ↔  📊 Graph Mode
(Edit forms)    (Visual builder)     (View only)
```

All three modes share the same data, fully synchronized.

---

## Key Features

### 1. Drag & Drop Node Creation
- Sidebar with 8 action types (Task, Approval, Signature, etc.)
- Drag action type → drop on canvas → new step created
- Auto-assigned order based on Y position

### 2. Visual Dependency Connections
- Click source node handle → drag to target node
- Creates dependency automatically
- Real-time cycle detection (prevents invalid connections)
- Red animated edges for cycles

### 3. Edit in Side Panel
- Click node → property panel slides out
- Edit title, role, action config
- Save/Cancel buttons
- Delete step option

### 4. Auto-Layout
- "Auto-Arrange" button
- Uses Dagre algorithm (hierarchical layout)
- Top-to-bottom flow
- Parallel steps side-by-side

### 5. Real-time Validation
- Cycle detection as you build
- Warning banner if invalid
- Cannot save invalid workflow
- Clear error messages

---

## Quick Start Guide (for users)

### Create Workflow Visually

1. Click **"🎨 Canvas"** tab in template editor
2. Drag **"Task"** from sidebar onto canvas
3. Drag another **"Task"** below it
4. Click top node's **◉** handle → drag to bottom node
5. Dependency created! (Top must complete before bottom starts)
6. Click node to edit properties
7. Click **"Auto-Arrange"** for clean layout
8. Click **"Save Template"**

### Build Fork-Join Pattern

1. Add **Step 1** (initial task)
2. Add **Steps 2, 3, 4** (parallel tasks)
3. Add **Step 5** (convergence task)
4. Connect: **1 → 2**, **1 → 3**, **1 → 4** (fork)
5. Connect: **2 → 5**, **3 → 5**, **4 → 5** (join)
6. Click **Step 5** → set **Dependency Logic: ALL**
7. Click **"Auto-Arrange"** → perfect fork-join layout!

---

## Implementation Phases

### MVP (Sprint 1 - 13-18 hours)
- [x] Phase 1: Canvas Foundation (3-4h)
- [x] Phase 2: Node Management (2-3h)
- [x] Phase 3: Connection Management (3-4h)
- [x] Phase 5: Validation & Feedback (1-2h)
- [x] Phase 6: Editor Integration (2-3h)

**Result**: Functional visual builder with core features

### Polish (Sprint 2 - 6-9 hours)
- [x] Phase 4: Auto-Layout (2-3h)
- [x] Phase 7: UX Enhancements (2-3h)
- [x] Testing & Documentation (2-3h)

**Result**: Production-ready with great UX

### Advanced (Sprint 3 - 3-4 hours, optional)
- [x] Phase 8: Pattern Library
- [x] Multi-select operations
- [x] Export as PNG/SVG
- [x] Undo/Redo

**Result**: Power user features

---

## Components to Create

```
components/workflows/
├── WorkflowCanvas.tsx          (Main canvas component)
├── NodePalette.tsx             (Action type sidebar)
├── StepPropertyPanel.tsx       (Edit panel)
├── CanvasToolbar.tsx           (Auto-layout, export)
└── nodes/
    ├── StepNode.tsx            (Interactive node)
    ├── StartNode.tsx           (Visual start point)
    └── EndNode.tsx             (Visual end point)
```

---

## Key Technical Decisions

### State Management
- **Single source of truth**: `WorkflowStep[]` array
- Shared across Form, Canvas, and Graph modes
- React Context or local state

### Layout Algorithm
- **Dagre** (already installed)
- Hierarchical top-to-bottom layout
- Manual positioning also supported

### Validation Strategy
- **Prevent invalid actions** upfront
- Block cycle-creating connections
- Show error toast immediately
- Real-time validation panel

### Data Flow
```
User Action (Canvas)
      ↓
  Event Handler
      ↓
  Validate
      ↓
  Update Steps State
      ↓
  Convert to Nodes/Edges
      ↓
  Re-render Canvas
```

---

## User Experience Principles

### 1. Visual Feedback
- Hover → show handles
- Drag → show preview edge
- Drop → animate node creation
- Invalid → red edge + error message

### 2. Error Prevention
- Validate before allowing connection
- Block self-dependencies
- Block forward dependencies
- Block cycles

### 3. Progressive Disclosure
- Start simple (empty canvas)
- Add features as needed
- Help tooltips on hover
- Contextual guidance

### 4. Consistency
- Same data in all three modes
- Instant sync when switching
- No data loss

---

## Common Patterns Library

### 1. Linear (Sequential)
```
[A] → [B] → [C] → [D]
```
Each step waits for previous to complete.

### 2. Fork (Parallel)
```
       [A]
      / | \
    [B][C][D]
```
After A completes, B/C/D all start simultaneously.

### 3. Fork-Join
```
       [A]
      / | \
    [B][C][D]
      \ | /
       [E]
```
E waits for ALL of B/C/D to complete (ALL logic).

### 4. First-Wins
```
       [A]
      / | \
    [B][C][D]
      \ | /
       [E] (ANY)
```
E starts when ANY of B/C/D completes (ANY logic).

### 5. Diamond
```
       [A]
      /   \
    [B]   [C]
      \   /
       [D]
```
Alternative paths that converge.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Delete` | Delete selected node/edge |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Cmd+A` | Select all |
| `Space` | Pan mode |
| `Escape` | Deselect all |

---

## Performance Targets

- ✅ Canvas render: **< 100ms** (50 nodes)
- ✅ Validation: **< 50ms** (cycle detection)
- ✅ Save: **< 200ms**
- ✅ Auto-layout: **< 300ms** (50 nodes)

---

## Testing Checklist

### Functional Tests
- [ ] Add node via drag-and-drop
- [ ] Delete node (and clean up dependencies)
- [ ] Create dependency connection
- [ ] Delete dependency connection
- [ ] Edit node properties
- [ ] Auto-arrange layout
- [ ] Validate for cycles
- [ ] Block invalid connections
- [ ] Switch Form ↔ Canvas (sync data)
- [ ] Save and reload template

### Edge Cases
- [ ] Delete node with dependents
- [ ] Create cycle (should be blocked)
- [ ] Self-dependency (should be blocked)
- [ ] Forward dependency (should be blocked)
- [ ] Very large workflow (100 steps)
- [ ] Empty workflow
- [ ] Single node workflow

### Integration Tests
- [ ] Create in Canvas → view in Form
- [ ] Create in Form → view in Canvas
- [ ] Edit in Canvas → verify in Graph
- [ ] Complex workflow (fork-join) in all 3 modes

---

## Dependencies

### Already Installed ✅
- `reactflow` - React Flow library
- `dagre` - Layout algorithm
- `@types/dagre` - TypeScript types

### Optional Additions
- `react-flow-renderer` - For PNG/SVG export
- `zustand` - State management (if needed)

---

## Documentation to Create

### User Guides
1. "Building Workflows Visually" (Step-by-step tutorial)
2. "Understanding Dependencies" (Conceptual guide)
3. "Canvas Keyboard Shortcuts" (Quick reference)
4. "Common Workflow Patterns" (Pattern library)

### Developer Docs
1. Canvas Architecture (Technical design)
2. Adding Custom Node Types (Extension guide)
3. Layout Algorithm Guide (Dagre customization)

---

## Success Criteria

### Must Have (MVP)
- ✅ Drag-and-drop node creation
- ✅ Visual dependency connections
- ✅ Edit node properties
- ✅ Real-time cycle detection
- ✅ Form ↔ Canvas sync
- ✅ Save/Load templates

### Should Have (Polish)
- ✅ Auto-layout button
- ✅ Keyboard shortcuts
- ✅ Validation error panel
- ✅ Undo/Redo

### Nice to Have (Advanced)
- ✅ Pattern library
- ✅ Multi-select
- ✅ Export as image
- ⬜ Collaboration (future)

---

## Rollout Strategy

### Phase 1: Internal Beta
- Enable for ADMIN users only
- Gather feedback
- Fix critical bugs

### Phase 2: Opt-in Beta
- Add "Try Canvas Mode" prompt
- Users can opt-in
- Track adoption metrics

### Phase 3: General Availability
- Enable for all users
- Set as default for new templates (optional)
- Deprecate form mode (optional)

---

## Related Documents

- **Full Plan**: `VISUAL-WORKFLOW-BUILDER-PLAN.md` (detailed 700+ line spec)
- **User Guide**: `WORKFLOW-DEPENDENCIES-USER-GUIDE.md` (existing dependency docs)
- **Test Report**: `WORKFLOW-DEPENDENCIES-TEST-REPORT.md` (test coverage)

---

**Created**: October 20, 2025  
**Version**: 1.0.0  
**Status**: Planning Complete - Ready for Development
