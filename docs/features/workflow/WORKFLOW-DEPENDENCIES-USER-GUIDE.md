# Workflow Dependencies - User Guide

## Overview

Workflow dependencies allow you to create complex, multi-path workflows with parallel execution, conditional branching, and sophisticated coordination patterns. This guide covers how to use the dependency features effectively.

## Table of Contents

- [Quick Start](#quick-start)
- [Dependency Basics](#dependency-basics)
- [Dependency Logic (ALL vs ANY)](#dependency-logic-all-vs-any)
- [Visual Dependency Graph](#visual-dependency-graph)
- [Common Workflow Patterns](#common-workflow-patterns)
- [Cycle Detection](#cycle-detection)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Creating a Simple Workflow with Dependencies

1. Navigate to **Workflows → Templates**
2. Click **New Template**
3. Fill in template name and description
4. Click **Add Step** to create your first step
5. Click **Add Step** again for the second step
6. In the second step, expand the **Dependencies** section
7. Select the first step from the **Depends On** dropdown
8. Click **Save Template**

**Result**: Step 2 will only become READY after Step 1 is completed.

---

## Dependency Basics

### What Are Dependencies?

Dependencies define the execution order of workflow steps. When Step B depends on Step A:
- Step A must complete before Step B can start
- Step B will show as **PENDING** until Step A is **COMPLETED**
- Once Step A completes, Step B automatically becomes **READY**

### Setting Dependencies

Each workflow step can depend on one or more previous steps:

1. **Single Dependency**: Step 2 depends on Step 1
   - Step 2 waits for Step 1 to complete
   - Linear execution path

2. **Multiple Dependencies**: Step 4 depends on Steps 1, 2, and 3
   - Step 4 waits for ALL (or ANY) of the dependencies to complete
   - Uses **Dependency Logic** to determine when to proceed

### Dependency Rules

- ✅ **Valid**: Step can depend on any previous step (lower order number)
- ❌ **Invalid - Self-Dependency**: Step cannot depend on itself
- ❌ **Invalid - Forward Dependency**: Step cannot depend on a later step
- ❌ **Invalid - Circular Dependency**: Steps cannot form a cycle (A → B → C → A)

---

## Dependency Logic (ALL vs ANY)

When a step has multiple dependencies, you choose how they're evaluated:

### ALL Logic (Default)

**All dependencies must complete before this step becomes READY.**

**Example**: Quality Control step that requires:
- Legal review completed (Step 2)
- Financial review completed (Step 3)
- Compliance check completed (Step 4)

```
Step 1: Initial Submission
├─ Step 2: Legal Review (depends on Step 1)
├─ Step 3: Financial Review (depends on Step 1)
└─ Step 4: Compliance Check (depends on Step 1)

Step 5: Final Approval (depends on Steps 2, 3, 4 with ALL logic)
```

**Behavior**:
- After Step 1 completes → Steps 2, 3, 4 all become READY (parallel execution)
- Step 5 stays PENDING until **all three** reviews complete
- Even if Step 2 and 3 complete, Step 5 waits for Step 4

**Use Cases**:
- Fork-Join patterns
- Quality gates requiring multiple approvals
- Document collection from multiple sources
- Multi-party signatures

### ANY Logic

**At least one dependency must complete for this step to become READY.**

**Example**: Escalation step that triggers when either:
- Client hasn't responded within 48 hours (Step 2)
- Payment is overdue (Step 3)
- Document is missing (Step 4)

```
Step 1: Initial Request
├─ Step 2: Wait 48 Hours (depends on Step 1)
├─ Step 3: Check Payment (depends on Step 1)
└─ Step 4: Verify Documents (depends on Step 1)

Step 5: Escalate to Manager (depends on Steps 2, 3, 4 with ANY logic)
```

**Behavior**:
- After Step 1 completes → Steps 2, 3, 4 all become READY
- Step 5 becomes READY as soon as **any one** of them completes
- Whichever condition triggers first activates Step 5
- Other steps can be skipped or completed independently

**Use Cases**:
- First-wins patterns
- Escalation triggers
- Optional parallel paths
- Race conditions (whichever finishes first)

---

## Visual Dependency Graph

### Accessing the Graph View

1. Open any workflow template
2. Click the **Graph** tab (next to **Form** tab)
3. View the interactive dependency visualization

### Graph Features

#### Custom Nodes

Each step appears as a node showing:
- **Step Order**: Number badge (1, 2, 3...)
- **Step Title**: Full name of the step
- **Action Type**: TASK, APPROVAL, etc.
- **Dependency Count**: Number of dependencies (e.g., "2 deps")
- **Dependency Logic**: && (ALL) or || (ANY)

#### Edges (Arrows)

- **Gray Edges**: Normal dependencies
- **Red Animated Edges**: Cycle detected (invalid)
- **Purple Highlighted**: Steps involved in cycles

#### Controls

- **Zoom**: Mouse wheel or zoom controls (bottom-right)
- **Pan**: Click and drag on empty space
- **Node Click**: Click any node to scroll to that step in Form view
- **Minimap**: Shows overview of entire workflow (bottom-right corner)

#### Legend

- **Node Colors**: 
  - Default (gray border)
  - Highlighted (purple background when clicked)
  - Cycle nodes (red border when in cycle)

### Validation Summary

Below the graph, you'll see a validation panel:

- ✅ **Green Banner**: "All dependencies valid" - workflow is ready to save
- ⚠️ **Red Banner**: "Validation Failed" - shows specific errors

**Statistics**:
- Total steps
- Steps with dependencies
- Parallel steps (steps that can execute simultaneously)
- Average dependencies per step

---

## Common Workflow Patterns

### 1. Linear Workflow (Sequential)

**Pattern**: A → B → C → D

**Use Case**: Simple process where each step must complete before the next begins.

**Example**: Client onboarding
1. Create client account
2. Send welcome email
3. Request initial documents
4. Schedule kickoff meeting

**Configuration**:
- Step 2 depends on Step 1
- Step 3 depends on Step 2
- Step 4 depends on Step 3

**Execution**: One step at a time, no parallelism.

---

### 2. Fork Pattern (Parallel Execution)

**Pattern**: 
```
       [1]
      / | \
    [2][3][4]
```

**Use Case**: After one step completes, multiple steps can execute simultaneously.

**Example**: Document preparation
1. Client signs contract
2. Prepare legal brief (parallel)
3. File court documents (parallel)
4. Notify all parties (parallel)

**Configuration**:
- Steps 2, 3, 4 all depend on Step 1
- No dependencies between 2, 3, 4
- Can use different team members for each parallel step

**Execution**: 
- Step 1 completes
- Steps 2, 3, 4 all become READY immediately
- Team can work on all three simultaneously

---

### 3. Fork-Join Pattern (Parallel + Convergence)

**Pattern**: 
```
       [1]
      / | \
    [2][3][4]
      \ | /
       [5]
```

**Use Case**: Parallel work followed by a step that requires all parallel work to complete.

**Example**: Multi-party approval
1. Submit proposal
2. Legal review (parallel)
3. Financial review (parallel)
4. Compliance review (parallel)
5. Final approval (requires ALL reviews)

**Configuration**:
- Steps 2, 3, 4 depend on Step 1
- Step 5 depends on Steps 2, 3, 4 with **ALL logic**

**Execution**:
- Step 1 completes
- Steps 2, 3, 4 all become READY (parallel)
- Step 5 stays PENDING until **all three** reviews complete
- Once last review completes, Step 5 becomes READY

**Benefits**:
- Maximizes parallelism (saves time)
- Ensures quality (all checks must pass)
- Clear convergence point

---

### 4. First-Wins Pattern (Race Condition)

**Pattern**: 
```
       [1]
      / | \
    [2][3][4]
      \ | /
       [5] (ANY)
```

**Use Case**: Multiple alternative paths, first one to complete triggers the next step.

**Example**: Escalation workflow
1. Send client request
2. Wait 24 hours (parallel)
3. Check payment status (parallel)
4. Verify document upload (parallel)
5. Escalate to manager (if ANY condition triggers)

**Configuration**:
- Steps 2, 3, 4 depend on Step 1
- Step 5 depends on Steps 2, 3, 4 with **ANY logic**

**Execution**:
- Step 1 completes
- Steps 2, 3, 4 all become READY
- Whichever completes first makes Step 5 READY
- Other steps can be skipped or continue independently

---

### 5. Diamond Pattern (Conditional Merge)

**Pattern**: 
```
       [1]
      /   \
    [2]   [3]
      \   /
       [4]
```

**Use Case**: Two alternative paths that both converge at the same point.

**Example**: Document review with different reviewers
1. Submit document
2. Senior lawyer review (path A)
3. Junior lawyer review (path B)
4. Final publication (after either review)

**Configuration**:
- Steps 2 and 3 both depend on Step 1
- Step 4 depends on Steps 2 and 3 with **ANY logic**

**Execution**:
- Step 1 completes
- Steps 2 and 3 both become READY
- Whichever review completes first makes Step 4 READY
- Ensures at least one review happens before publication

---

### 6. Multi-Stage Fork-Join

**Pattern**: 
```
        [1]
       / | \
     [2][3][4]
       \ | /
        [5]
       / | \
     [6][7][8]
       \ | /
        [9]
```

**Use Case**: Complex workflows with multiple parallel stages.

**Example**: Case preparation
1. Case accepted
2. Research legal precedents (parallel)
3. Interview witnesses (parallel)
4. Collect evidence (parallel)
5. Compile initial findings (requires ALL)
6. Draft legal brief (parallel)
7. Prepare exhibits (parallel)
8. File motion (parallel)
9. Final review (requires ALL)

**Configuration**:
- First fork: Steps 2, 3, 4 depend on Step 1
- First join: Step 5 depends on Steps 2, 3, 4 (ALL logic)
- Second fork: Steps 6, 7, 8 depend on Step 5
- Second join: Step 9 depends on Steps 6, 7, 8 (ALL logic)

**Execution**:
- Two stages of parallel work
- Each stage ensures all work completes before proceeding
- Maximizes efficiency while maintaining quality gates

---

## Cycle Detection

### What Is a Cycle?

A cycle occurs when dependencies form a loop:
- **Simple Cycle**: A → B → A
- **Complex Cycle**: A → B → C → D → B

Cycles are **invalid** because they create infinite waiting:
- Step A waits for Step B
- Step B waits for Step A
- Neither can ever become READY

### How Cycles Are Detected

The system automatically detects cycles:

1. **Graph View**: Red animated edges show cycle paths
2. **Validation Summary**: Red banner shows "Cycle detected"
3. **Save Prevention**: Template cannot be saved with cycles

### Common Cycle Examples

#### Simple Cycle
```
❌ INVALID:
Step 1 depends on Step 2
Step 2 depends on Step 1
```

**Error**: "Cycle detected: 1 → 2 → 1"

#### Self-Dependency
```
❌ INVALID:
Step 1 depends on Step 1
```

**Error**: "Step cannot depend on itself"

#### Complex Cycle
```
❌ INVALID:
Step 1 → Step 2
Step 2 → Step 3
Step 3 → Step 4
Step 4 → Step 2 (creates cycle!)
```

**Error**: "Cycle detected: 2 → 3 → 4 → 2"

### Fixing Cycles

1. **Review Dependencies**: Use Graph view to visualize the cycle
2. **Identify Loop**: Red edges show the cycle path
3. **Remove One Dependency**: Break the loop by removing one dependency
4. **Re-validate**: Graph should show green "All dependencies valid"

**Example Fix**:
```
Before (Invalid):
Step A depends on Step C
Step B depends on Step A
Step C depends on Step B
→ Cycle: A → C → B → A

After (Valid):
Remove "Step A depends on Step C"
Step A has no dependencies
Step B depends on Step A
Step C depends on Step B
→ Linear: A → B → C
```

---

## Best Practices

### 1. Keep It Simple

- Start with linear workflows (A → B → C)
- Add parallelism only when needed
- Avoid deeply nested dependencies

### 2. Use Meaningful Step Names

- ✅ Good: "Senior Lawyer Approval", "Client Document Upload"
- ❌ Bad: "Step 1", "Task A"

Clear names make the graph view easier to understand.

### 3. Leverage Graph View

- Always check Graph view before saving
- Look for:
  - Unexpected cycles (red edges)
  - Overly complex patterns
  - Bottlenecks (many steps converging on one)

### 4. Document Complex Patterns

- Add descriptions to templates explaining the workflow logic
- Note why specific dependency patterns are used
- Helps future team members understand the design

### 5. Test Execution Paths

- After creating a template, test it on a sample matter
- Verify parallel steps all become READY as expected
- Check that join points (ALL logic) wait correctly

### 6. Use ALL vs ANY Intentionally

- **ALL**: When you need guaranteed completion of all paths
- **ANY**: When you want first-wins behavior or optional paths
- Don't mix unless you fully understand the implications

### 7. Limit Parallel Branches

- Too many parallel steps can overwhelm team members
- Recommended: Max 3-5 parallel branches per fork
- Consider splitting into multiple workflows if needed

### 8. Plan for Skipping

- Some steps may need to be skipped if not required
- Build workflows with optional steps in mind
- Use ANY logic for optional convergence points

---

## Troubleshooting

### Problem: Step Stays PENDING After Dependencies Complete

**Possible Causes**:
1. **Dependency Logic Mismatch**: Step has ALL logic but not all dependencies completed
2. **Hidden Dependencies**: Check if step depends on more steps than expected

**Solution**:
- Open template in Form view
- Expand Dependencies section for the PENDING step
- Verify all listed dependencies are COMPLETED
- Check Dependency Logic is correct (ALL vs ANY)

---

### Problem: Multiple Steps READY But Only Want One

**Cause**: Using fork pattern without join, or ANY logic instead of sequential.

**Solution**:
- If only one path should execute, use conditional execution (future feature)
- If all should execute but sequentially, add dependencies:
  - Step 3 depends on Step 2
  - Step 4 depends on Step 3

---

### Problem: Cycle Detected But Can't See Where

**Solution**:
1. Switch to **Graph view**
2. Look for **red animated edges** (these are the cycle)
3. Follow the red path to identify the loop
4. Remove one dependency in the loop

**Example**:
- See red edge from Step 5 → Step 2
- See red edge from Step 2 → Step 3
- See red edge from Step 3 → Step 5
- **Solution**: Remove "Step 5 depends on Step 2"

---

### Problem: Graph View Not Loading

**Possible Causes**:
1. Too many steps (100+)
2. Browser compatibility issue

**Solution**:
- Try different browser (Chrome, Firefox recommended)
- Simplify workflow (split into multiple templates)
- Use Form view to edit, Graph view only to validate

---

### Problem: Can't Save Template - "Invalid Dependencies"

**Common Causes**:
1. **Self-dependency**: Step depends on itself
2. **Forward dependency**: Step depends on later step (higher order)
3. **Invalid reference**: Step depends on non-existent step
4. **Cycle**: Circular dependency loop

**Solution**:
- Check error message for specific step numbers
- Review Dependencies section for each step
- Use Graph view to visualize and identify issue
- Remove invalid dependencies

---

## Keyboard Shortcuts (Graph View)

- **Mouse Wheel**: Zoom in/out
- **Click + Drag**: Pan around graph
- **Click Node**: Jump to step in Form view
- **Escape**: Return to Form view

---

## Video Tutorials

### Coming Soon

- Creating Your First Parallel Workflow
- Using Fork-Join Patterns for Multi-Stage Approvals
- Detecting and Fixing Cycles
- Advanced Patterns: Multi-Stage Workflows

---

## FAQs

### Q: Can a step depend on steps from different branches?

**A**: Yes! Step 5 can depend on Step 2 (from one branch) and Step 4 (from another branch).

**Example**:
```
Step 1 → Step 2 → Step 3
         Step 2 → Step 4
         Step 5 depends on Step 3 AND Step 4
```

---

### Q: What happens if I skip a step that other steps depend on?

**A**: Dependent steps will never become READY (they'll stay PENDING indefinitely). Only skip steps if:
- They're not required for workflow completion
- No other steps depend on them
- You plan to cancel the workflow

---

### Q: Can I change dependencies after creating a template?

**A**: Yes! Edit the template and modify dependencies. However:
- Existing workflow instances won't be affected
- Only new instances will use the updated dependencies
- Be careful not to introduce cycles

---

### Q: How many dependencies can one step have?

**A**: Technical limit is 100, but recommended max is 10 for clarity. If you need more:
- Consider intermediate consolidation steps
- Break workflow into multiple templates
- Use workflow chaining (future feature)

---

### Q: Can I create a workflow where all steps are parallel?

**A**: Yes, but at least one step must have no dependencies (the starting point). All other steps can depend only on that first step:

```
        [1]
    / / | \ \
  [2][3][4][5][6]
```

**Result**: After Step 1 completes, all 5 other steps become READY simultaneously.

---

### Q: What's the difference between dependencies and conditional execution?

**A**: 
- **Dependencies**: Control *when* a step can start (based on previous steps completing)
- **Conditional Execution**: Controls *if* a step should start (based on data/decisions)

Dependencies ensure order and coordination. Conditionals provide branching logic.

---

## Support

For additional help:
- Contact your system administrator
- Review the [Master System Documentation](../MASTER-SYSTEM-DOCUMENTATION.md)
- Check the [Workflow Backlog](../features/workflow/WORKFLOW-BACKLOG.md) for planned features

---

**Last Updated**: October 20, 2025  
**Version**: 1.0.0 (P0.2 Dependency Features)
