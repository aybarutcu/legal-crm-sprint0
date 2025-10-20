# Visual Workflow Builder - Implementation Plan

## Overview

Transform the current form-based workflow template editor into a visual drag-and-drop builder using React Flow, allowing users to create workflows by drawing connections between nodes instead of filling forms.

**Current State**: 
- Form-based step editor with dependency dropdowns
- Read-only graph visualization for validation

**Target State**:
- Interactive visual canvas for building workflows
- Drag-and-drop nodes from palette
- Draw connections between steps
- Edit node properties in side panel
- Auto-validation with cycle detection
- Seamless sync between visual and form views

---

## Architecture Overview

### Three Editor Modes

1. **Form Mode** (Current) - Traditional form-based editing
2. **Graph Mode** (Current, read-only) - Visualization for validation
3. **Canvas Mode** (NEW) - Interactive visual builder

### User Flow

```
[Form Mode] ←→ [Canvas Mode] ←→ [Graph Mode]
     ↓              ↓              ↓
  [Template State (Single Source of Truth)]
```

All three modes share the same underlying data structure (`WorkflowStep[]`), ensuring consistency.

---

## Phase 1: Canvas Mode Foundation (3-4 hours)

### 1.1 Create Interactive Canvas Component

**File**: `components/workflows/WorkflowCanvas.tsx` (NEW)

**Features**:
- React Flow with editable nodes and edges
- Node palette/sidebar for adding steps
- Connection handles for dependency wiring
- Zoom, pan, minimap
- Grid background with snap-to-grid

**Key Props**:
```typescript
interface WorkflowCanvasProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
  onValidate?: (validation: ValidationResult) => void;
  readOnly?: boolean;
}
```

**Node Types**:
- `stepNode` - Draggable, editable step node
- `startNode` - Virtual start point (for UX)
- `endNode` - Virtual end point (for UX)

### 1.2 Node Palette Component

**File**: `components/workflows/NodePalette.tsx` (NEW)

**Features**:
- Sidebar with action type buttons
- Drag action types onto canvas
- Visual icons for each action type
- Search/filter action types

**Action Types**:
- Task
- Checklist  
- Approval (Lawyer)
- Client Signature
- Request Documents
- Payment
- Write Text
- Questionnaire

### 1.3 Step Property Panel

**File**: `components/workflows/StepPropertyPanel.tsx` (NEW)

**Features**:
- Slide-out panel when node selected
- Edit step properties (title, role, config)
- Inline validation
- Save/Cancel buttons
- Delete step button

**Sections**:
1. Basic Info (title, action type, role)
2. Action Config (dynamic based on type)
3. Dependencies (auto-managed, read-only display)
4. Conditional Execution (optional)

---

## Phase 2: Node Management (2-3 hours)

### 2.1 Add Node Functionality

**User Action**: Drag action type from palette → drop on canvas

**Implementation**:
```typescript
function handleAddNode(actionType: ActionType, position: XYPosition) {
  const newStep: WorkflowStep = {
    id: `temp-${Date.now()}`,
    title: `New ${actionType} Step`,
    actionType,
    roleScope: "LAWYER", // Default
    required: true,
    actionConfig: defaultConfigFor(actionType),
    order: steps.length,
    dependsOn: [],
    dependencyLogic: "ALL"
  };
  
  onChange([...steps, newStep]);
}
```

**Validation**:
- Ensure unique node IDs
- Auto-assign order based on position (Y-axis)
- Default to LAWYER role (can be changed in panel)

### 2.2 Delete Node Functionality

**User Action**: Select node → click delete button

**Implementation**:
```typescript
function handleDeleteNode(stepId: string) {
  // Remove step
  const updatedSteps = steps.filter(s => s.id !== stepId);
  
  // Remove dependencies pointing to deleted step
  const stepOrder = steps.find(s => s.id === stepId)?.order;
  updatedSteps.forEach(step => {
    if (step.dependsOn?.includes(stepOrder)) {
      step.dependsOn = step.dependsOn.filter(o => o !== stepOrder);
    }
  });
  
  // Recalculate orders
  onChange(recalculateOrders(updatedSteps));
}
```

**Validation**:
- Warn if step has dependents
- Clean up dependencies
- Recalculate step orders

### 2.3 Move/Reorder Nodes

**User Action**: Drag node to new position

**Implementation**:
```typescript
function handleNodeDragStop(event: NodeDragEvent, node: Node) {
  // Update node position
  updateNodePosition(node.id, node.position);
  
  // Recalculate orders based on Y position (top to bottom)
  const reordered = recalculateOrdersByPosition(steps, nodes);
  onChange(reordered);
}

function recalculateOrdersByPosition(
  steps: WorkflowStep[], 
  nodes: Node[]
): WorkflowStep[] {
  // Sort nodes by Y position
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
  
  // Assign new orders
  return steps.map((step, index) => ({
    ...step,
    order: sortedNodes.findIndex(n => n.id === step.id)
  }));
}
```

---

## Phase 3: Connection Management (3-4 hours)

### 3.1 Draw Dependencies (Connect Nodes)

**User Action**: Click source handle → drag to target handle

**Implementation**:
```typescript
function handleConnect(connection: Connection) {
  const sourceOrder = getStepOrderById(connection.source);
  const targetOrder = getStepOrderById(connection.target);
  
  // Add dependency
  const updatedSteps = steps.map(step => {
    if (step.order === targetOrder) {
      return {
        ...step,
        dependsOn: [...(step.dependsOn || []), sourceOrder]
      };
    }
    return step;
  });
  
  // Validate for cycles
  const validation = validateWorkflowDependencies(updatedSteps);
  
  if (!validation.valid) {
    alert(`Cannot create connection: ${validation.errors.join(', ')}`);
    return; // Reject connection
  }
  
  onChange(updatedSteps);
}
```

**Validation**:
- Check for cycles before allowing connection
- Prevent self-dependencies
- Prevent forward dependencies (lower order to higher only)
- Show error toast if invalid

### 3.2 Remove Dependencies (Delete Connection)

**User Action**: Click edge → press delete or click ✕ button

**Implementation**:
```typescript
function handleEdgeDelete(edgeId: string) {
  const [sourceId, targetId] = edgeId.split('-');
  const sourceOrder = getStepOrderById(sourceId);
  const targetOrder = getStepOrderById(targetId);
  
  const updatedSteps = steps.map(step => {
    if (step.order === targetOrder) {
      return {
        ...step,
        dependsOn: step.dependsOn?.filter(o => o !== sourceOrder) || []
      };
    }
    return step;
  });
  
  onChange(updatedSteps);
}
```

### 3.3 Visual Dependency Logic Indicator

**Display on Node**:
- Show `&&` badge for ALL logic
- Show `||` badge for ANY logic
- Click to toggle (if multiple dependencies)

**Implementation**:
```typescript
function DependencyLogicBadge({ step }: { step: WorkflowStep }) {
  if (!step.dependsOn || step.dependsOn.length < 2) return null;
  
  return (
    <button
      onClick={() => toggleDependencyLogic(step.id)}
      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold"
      title={`Dependency Logic: ${step.dependencyLogic}`}
    >
      {step.dependencyLogic === 'ALL' ? '&&' : '||'}
    </button>
  );
}
```

---

## Phase 4: Layout & Auto-Arrangement (2-3 hours)

### 4.1 Auto-Layout Algorithm

**Use Dagre** (already installed) for automatic positioning:

```typescript
function autoLayoutCanvas(steps: WorkflowStep[]): Node[] {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({
    rankdir: 'TB', // Top to bottom
    ranksep: 100,  // Vertical spacing
    nodesep: 80,   // Horizontal spacing
    edgesep: 50
  });
  
  // Add nodes
  steps.forEach(step => {
    dagreGraph.setNode(step.id!, { width: 200, height: 100 });
  });
  
  // Add edges (dependencies)
  steps.forEach(step => {
    step.dependsOn?.forEach(depOrder => {
      const depId = steps.find(s => s.order === depOrder)?.id;
      if (depId) {
        dagreGraph.setEdge(depId, step.id!);
      }
    });
  });
  
  // Calculate layout
  dagre.layout(dagreGraph);
  
  // Convert to React Flow nodes
  return steps.map(step => {
    const nodeWithPosition = dagreGraph.node(step.id!);
    return {
      id: step.id!,
      type: 'stepNode',
      position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
      data: { step }
    };
  });
}
```

**Features**:
- "Auto-Arrange" button in toolbar
- Hierarchical layout (dependencies flow top-to-bottom)
- Parallel steps positioned side-by-side
- Preserve user customizations (don't auto-arrange on every change)

### 4.2 Smart Node Placement

When user adds new node:
- Place near cursor position
- Avoid overlaps with existing nodes
- Suggest logical position based on workflow flow

```typescript
function findOptimalNodePosition(
  targetPos: XYPosition,
  existingNodes: Node[]
): XYPosition {
  const GRID_SIZE = 20;
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 100;
  
  // Snap to grid
  let x = Math.round(targetPos.x / GRID_SIZE) * GRID_SIZE;
  let y = Math.round(targetPos.y / GRID_SIZE) * GRID_SIZE;
  
  // Check for overlaps
  while (hasOverlap({ x, y }, existingNodes)) {
    y += NODE_HEIGHT + 20; // Move down
  }
  
  return { x, y };
}
```

---

## Phase 5: Validation & Feedback (1-2 hours)

### 5.1 Real-time Cycle Detection

**Visual Indicators**:
- Red animated edges for cycles
- Red border on nodes in cycle
- Warning badge on toolbar
- Prevent save if cycles exist

**Implementation**:
```typescript
function CanvasValidation({ steps }: { steps: WorkflowStep[] }) {
  const validation = validateWorkflowDependencies(steps);
  
  if (!validation.valid) {
    return (
      <Panel position="top-center">
        <div className="bg-red-50 border-2 border-red-500 rounded-lg px-4 py-2">
          <span className="text-red-700 font-semibold">
            ⚠ Validation Errors: {validation.errors.length}
          </span>
        </div>
      </Panel>
    );
  }
  
  return (
    <Panel position="top-center">
      <div className="bg-green-50 border-2 border-green-500 rounded-lg px-4 py-2">
        <span className="text-green-700 font-semibold">✓ Workflow Valid</span>
      </div>
    </Panel>
  );
}
```

### 5.2 Connection Validation

**Before allowing connection**:
1. Check source step order < target step order (no backward deps)
2. Check for cycles
3. Show preview edge while dragging
4. Reject with error toast if invalid

```typescript
function isValidConnection(
  connection: Connection,
  steps: WorkflowStep[]
): { valid: boolean; error?: string } {
  const sourceOrder = getStepOrderById(connection.source);
  const targetOrder = getStepOrderById(connection.target);
  
  // No self-dependencies
  if (sourceOrder === targetOrder) {
    return { valid: false, error: "Step cannot depend on itself" };
  }
  
  // No forward dependencies
  if (sourceOrder > targetOrder) {
    return { valid: false, error: "Cannot depend on later step" };
  }
  
  // Check for cycles
  const testSteps = addDependency(steps, targetOrder, sourceOrder);
  const validation = validateWorkflowDependencies(testSteps);
  
  if (!validation.valid) {
    return { valid: false, error: validation.errors[0] };
  }
  
  return { valid: true };
}
```

---

## Phase 6: Integration with Existing Editor (2-3 hours)

### 6.1 Three-Way View Sync

**Update Template Editor** (`app/(dashboard)/workflows/templates/_components/client.tsx`):

```typescript
type ViewMode = "form" | "canvas" | "graph";

const [viewMode, setViewMode] = useState<ViewMode>("form");

// Sync steps between views
const [steps, setSteps] = useState<WorkflowStep[]>([]);

function handleStepsChange(updatedSteps: WorkflowStep[]) {
  setSteps(updatedSteps);
  // Steps state shared across all three views
}
```

**UI Toggle**:
```tsx
<div className="flex items-center gap-2 mb-4">
  <button
    onClick={() => setViewMode("form")}
    className={viewMode === "form" ? "active" : ""}
  >
    📝 Form
  </button>
  <button
    onClick={() => setViewMode("canvas")}
    className={viewMode === "canvas" ? "active" : ""}
  >
    🎨 Canvas
  </button>
  <button
    onClick={() => setViewMode("graph")}
    className={viewMode === "graph" ? "active" : ""}
  >
    📊 Graph
  </button>
</div>

{viewMode === "form" && <FormEditor steps={steps} onChange={handleStepsChange} />}
{viewMode === "canvas" && <WorkflowCanvas steps={steps} onChange={handleStepsChange} />}
{viewMode === "graph" && <DependencyGraphWithValidation steps={steps} />}
```

### 6.2 Data Transformation Helpers

**Convert steps to React Flow nodes**:
```typescript
function stepsToNodes(steps: WorkflowStep[]): Node[] {
  return steps.map(step => ({
    id: step.id || `step-${step.order}`,
    type: 'stepNode',
    position: { x: 0, y: step.order * 150 }, // Default positioning
    data: {
      step,
      label: step.title,
      actionType: step.actionType,
      roleScope: step.roleScope,
      dependencyCount: step.dependsOn?.length || 0,
      dependencyLogic: step.dependencyLogic
    }
  }));
}

function stepsToEdges(steps: WorkflowStep[]): Edge[] {
  const edges: Edge[] = [];
  
  steps.forEach(step => {
    step.dependsOn?.forEach(depOrder => {
      const depStep = steps.find(s => s.order === depOrder);
      if (depStep) {
        edges.push({
          id: `${depStep.id}-${step.id}`,
          source: depStep.id!,
          target: step.id!,
          type: 'smoothstep',
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed }
        });
      }
    });
  });
  
  return edges;
}
```

**Convert React Flow changes back to steps**:
```typescript
function updateStepsFromNodes(
  steps: WorkflowStep[],
  nodes: Node[]
): WorkflowStep[] {
  // Update positions and orders based on node Y position
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
  
  return steps.map((step, index) => {
    const node = nodes.find(n => n.id === step.id);
    const newOrder = sortedNodes.findIndex(n => n.id === step.id);
    
    return {
      ...step,
      order: newOrder >= 0 ? newOrder : step.order
    };
  });
}
```

---

## Phase 7: UX Enhancements (2-3 hours)

### 7.1 Contextual Help

**Canvas Overlay**:
- "Drop action types here to build workflow" (empty state)
- "Click node to edit properties" (after first node)
- "Drag from ◉ to ◉ to create dependency" (hint on hover)

**Tooltips**:
- Hover over node → show step details
- Hover over edge → show "Step X depends on Step Y"
- Hover over action type → show description

### 7.2 Keyboard Shortcuts

- `Delete` - Delete selected node/edge
- `Cmd+Z` / `Ctrl+Z` - Undo
- `Cmd+Shift+Z` / `Ctrl+Y` - Redo
- `Cmd+A` / `Ctrl+A` - Select all
- `Space` - Pan mode (drag canvas)
- `Escape` - Deselect all

### 7.3 Undo/Redo System

```typescript
function useUndoRedo<T>(initialState: T) {
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initialState);
  const [future, setFuture] = useState<T[]>([]);
  
  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([present, ...future]);
    setPresent(previous);
  };
  
  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past, present]);
    setPresent(next);
  };
  
  const setState = (newState: T) => {
    setPast([...past, present]);
    setPresent(newState);
    setFuture([]);
  };
  
  return { state: present, setState, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
```

### 7.4 Export/Import Workflow Image

- Export canvas as PNG/SVG
- Share workflow visualization
- Print workflow diagram

```typescript
import { toPng, toSvg } from 'react-flow-renderer';

async function exportWorkflowImage(format: 'png' | 'svg') {
  const rfInstance = reactFlowInstance.current;
  
  if (format === 'png') {
    const dataUrl = await toPng(rfInstance, {
      backgroundColor: '#ffffff',
      width: 1920,
      height: 1080
    });
    downloadImage(dataUrl, 'workflow.png');
  } else {
    const svg = await toSvg(rfInstance);
    downloadImage(svg, 'workflow.svg');
  }
}
```

---

## Phase 8: Advanced Features (Optional, 3-4 hours)

### 8.1 Node Templates/Snippets

**Pre-built Workflow Patterns**:
- "3-Step Approval" → Drag onto canvas
- "Fork-Join (4 parallel)" → Pre-configured parallel structure
- "Client Onboarding" → Complete onboarding flow

**Implementation**:
```typescript
const WORKFLOW_PATTERNS = {
  "fork-join-3": {
    name: "Fork-Join (3 Parallel)",
    steps: [
      { order: 0, title: "Initial Step", actionType: "TASK", dependsOn: [] },
      { order: 1, title: "Parallel A", actionType: "TASK", dependsOn: [0] },
      { order: 2, title: "Parallel B", actionType: "TASK", dependsOn: [0] },
      { order: 3, title: "Parallel C", actionType: "TASK", dependsOn: [0] },
      { order: 4, title: "Convergence", actionType: "TASK", dependsOn: [1,2,3], dependencyLogic: "ALL" }
    ]
  }
};

function handleInsertPattern(patternKey: string, position: XYPosition) {
  const pattern = WORKFLOW_PATTERNS[patternKey];
  const newSteps = pattern.steps.map(step => ({
    ...step,
    id: `temp-${Date.now()}-${step.order}`,
    order: steps.length + step.order
  }));
  onChange([...steps, ...newSteps]);
}
```

### 8.2 Multi-Select Operations

- Select multiple nodes → move together
- Select multiple nodes → delete all
- Select multiple nodes → change role scope in bulk

```typescript
function handleBulkOperation(
  selectedNodeIds: string[],
  operation: 'delete' | 'changeRole' | 'move',
  params?: any
) {
  switch (operation) {
    case 'delete':
      const updatedSteps = steps.filter(s => !selectedNodeIds.includes(s.id!));
      onChange(updatedSteps);
      break;
      
    case 'changeRole':
      onChange(steps.map(s => 
        selectedNodeIds.includes(s.id!) 
          ? { ...s, roleScope: params.role }
          : s
      ));
      break;
  }
}
```

### 8.3 Minimap Enhancements

- Click minimap → pan to that area
- Show step colors by role (Lawyer=blue, Client=green, etc.)
- Highlight cycle nodes in red on minimap

### 8.4 Collaboration Features (Future)

- Real-time collaborative editing (WebSockets)
- Show cursors of other users
- Lock nodes being edited by others
- Comment threads on specific steps

---

## Technical Implementation Details

### File Structure

```
components/workflows/
├── DependencyGraph.tsx           (existing - read-only visualization)
├── DependencyGraphWithValidation.tsx (existing - with validation UI)
├── WorkflowCanvas.tsx            (NEW - interactive builder)
├── NodePalette.tsx               (NEW - action type sidebar)
├── StepPropertyPanel.tsx         (NEW - edit node properties)
├── CanvasToolbar.tsx             (NEW - auto-layout, export, etc.)
├── nodes/
│   ├── StepNode.tsx              (NEW - custom interactive node)
│   ├── StartNode.tsx             (NEW - visual start point)
│   └── EndNode.tsx               (NEW - visual end point)
└── hooks/
    ├── useCanvasState.ts         (NEW - canvas state management)
    ├── useUndoRedo.ts            (NEW - undo/redo functionality)
    └── useAutoLayout.ts          (NEW - dagre layout wrapper)
```

### Dependencies (Already Installed)

- ✅ `reactflow` - Core library
- ✅ `dagre` - Auto-layout algorithm
- ✅ `@types/dagre` - TypeScript definitions

### New Dependencies (Optional)

```json
{
  "react-flow-renderer": "^10.3.17", // For PNG/SVG export
  "zustand": "^4.4.7"                // State management (optional, for collaboration)
}
```

### Data Flow

```
User Action (Canvas)
      ↓
  Event Handler
      ↓
  Update Steps State
      ↓
  Validate Dependencies
      ↓
  Convert to Nodes/Edges
      ↓
  Re-render Canvas
```

### State Management

```typescript
interface CanvasState {
  steps: WorkflowStep[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isAutoLayoutEnabled: boolean;
  validationErrors: string[];
}

// Use React Context or Zustand for global state
const CanvasContext = createContext<CanvasState>(initialState);
```

---

## Testing Strategy

### Unit Tests

1. **Node Management**:
   - Add node
   - Delete node
   - Update node properties
   - Reorder nodes

2. **Connection Management**:
   - Create dependency (connection)
   - Delete dependency
   - Validate connection before creation
   - Detect cycles

3. **Layout Algorithm**:
   - Auto-arrange nodes
   - Calculate optimal positions
   - Handle overlaps

### Integration Tests

1. **Form ↔ Canvas Sync**:
   - Add step in form → appears in canvas
   - Edit step in canvas → updates form
   - Delete step in canvas → removes from form

2. **Validation**:
   - Create cycle → blocked with error
   - Fix cycle → validation passes
   - Forward dependency → blocked

### E2E Tests

1. **Full Workflow Creation**:
   - Drag 5 action types onto canvas
   - Connect them in fork-join pattern
   - Edit properties via panel
   - Save template
   - Load template → verify all data correct

2. **Collaboration** (if implemented):
   - Two users edit same template
   - Verify conflict resolution
   - Test locking mechanism

---

## Performance Considerations

### Optimization Techniques

1. **Lazy Rendering**:
   - Only render visible nodes (React Flow handles this)
   - Virtualize node palette for large lists

2. **Memoization**:
   ```typescript
   const nodes = useMemo(() => stepsToNodes(steps), [steps]);
   const edges = useMemo(() => stepsToEdges(steps), [steps]);
   ```

3. **Debounced Updates**:
   ```typescript
   const debouncedSave = useMemo(
     () => debounce((steps: WorkflowStep[]) => {
       saveTemplate(steps);
     }, 500),
     []
   );
   ```

4. **Incremental Validation**:
   - Only validate affected steps when connection added
   - Cache validation results

### Limits

- Max 100 steps per workflow (reasonable limit)
- Max 500 dependencies total
- Warn user if approaching limits

---

## User Documentation

### Help Articles to Create

1. **"Building Workflows Visually"**
   - Introduction to canvas mode
   - How to add steps
   - How to connect steps
   - How to edit step properties

2. **"Understanding Dependencies"**
   - What are dependencies
   - How to create dependencies visually
   - ALL vs ANY dependency logic
   - Common patterns (fork, join, parallel)

3. **"Canvas Keyboard Shortcuts"**
   - Complete list of shortcuts
   - Power user tips

4. **"Troubleshooting Validation Errors"**
   - Cycle detection explained
   - How to fix cycles
   - Forward dependency errors

### In-App Tutorials

1. **First-Time User**:
   - Interactive tutorial overlay
   - Step-by-step guide to create first workflow
   - Highlight features as user progresses

2. **Pattern Library**:
   - Showcase common patterns
   - Click pattern → insert into canvas
   - Explain when to use each pattern

---

## Timeline & Effort Estimation

### Development Phases

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| 1 | Canvas Foundation | 3-4h | P0 (Required) |
| 2 | Node Management | 2-3h | P0 (Required) |
| 3 | Connection Management | 3-4h | P0 (Required) |
| 4 | Layout & Auto-Arrangement | 2-3h | P1 (Important) |
| 5 | Validation & Feedback | 1-2h | P0 (Required) |
| 6 | Integration with Editor | 2-3h | P0 (Required) |
| 7 | UX Enhancements | 2-3h | P1 (Important) |
| 8 | Advanced Features | 3-4h | P2 (Nice to have) |

**Total Effort**:
- **Minimum Viable Product (P0)**: 13-18 hours
- **Polished Experience (P0+P1)**: 19-27 hours
- **Full Feature Set (All)**: 22-31 hours

### Recommended Approach

**Sprint 1** (1 week): MVP
- Phase 1: Canvas Foundation
- Phase 2: Node Management
- Phase 3: Connection Management
- Phase 5: Basic Validation
- Phase 6: Editor Integration

**Sprint 2** (1 week): Polish
- Phase 4: Auto-Layout
- Phase 7: UX Enhancements
- Testing & Bug Fixes
- Documentation

**Sprint 3** (Optional): Advanced Features
- Phase 8: Advanced Features
- Performance Optimization
- Collaboration (if needed)

---

## Success Metrics

### User Adoption

- % of templates created via canvas vs form
- Time to create template (canvas vs form)
- User satisfaction survey

### Technical Metrics

- Canvas render performance (< 100ms for 50 nodes)
- Validation speed (< 50ms for cycle detection)
- Save time (< 200ms)

### Quality Metrics

- Cycle prevention rate (100% - no cycles saved)
- Error rate (validation catches all issues)
- Data consistency (form ↔ canvas sync perfect)

---

## Risks & Mitigations

### Risk 1: Complexity Overload

**Risk**: Canvas mode too complex for basic users  
**Mitigation**: 
- Keep form mode as default
- Add "Switch to Canvas" prompt for advanced workflows
- Provide tutorials and patterns

### Risk 2: Performance with Large Workflows

**Risk**: Canvas slow with 100+ steps  
**Mitigation**:
- Implement virtualization
- Add pagination/grouping
- Warn users at 50 steps

### Risk 3: Form ↔ Canvas Sync Issues

**Risk**: Data inconsistency between modes  
**Mitigation**:
- Single source of truth (steps state)
- Comprehensive integration tests
- Manual QA testing

### Risk 4: User Confusion with Dependencies

**Risk**: Users create invalid dependencies  
**Mitigation**:
- Real-time validation
- Clear error messages
- Visual feedback (red edges, warnings)
- Prevent invalid connections upfront

---

## Conclusion

The visual workflow builder will significantly enhance the workflow template creation experience, making it:

✅ **Faster** - Drag-and-drop is quicker than filling forms  
✅ **More Intuitive** - Visual representation easier to understand  
✅ **Less Error-Prone** - Real-time validation prevents cycles  
✅ **More Powerful** - Complex patterns (fork-join) easier to build  

**Recommendation**: Start with MVP (Sprint 1) to validate concept, then iterate based on user feedback.

---

**Last Updated**: October 20, 2025  
**Version**: 1.0.0  
**Status**: Planning Document - Ready for Implementation
