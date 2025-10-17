# Execution Log Quick Reference

## Overview

The execution log system provides clean, hover-based audit trails for workflow tasks, replacing raw JSON configuration displays with human-readable history.

## Features

### 1. Step-Level Execution Log

**Location**: Each workflow step that has been started or completed

**Trigger**: Hover over the "Geçmiş" button with clock icon (🕐)

**Display**:
- Popup appears below the button
- Width: 320px (80rem)
- Background: White with border and shadow
- z-index: 50 (appears above content)

**Contents**:
- **Start Event**: When the task was started
- **Completion Event**: When the task was completed or skipped
- **Action-Specific Details**: Contextual information based on action type

**Example Output**:
```
Görev başlatıldı                    15.10.2025 14:35

Görev tamamlandı                    15.10.2025 15:20
  3 madde tamamlandı
```

### 2. Workflow-Level Execution Log

**Location**: Workflow header (next to workflow name)

**Trigger**: Hover over the "Geçmiş" button with document icon (📄)

**Display**:
- Popup appears below the button
- Width: 384px (96rem)
- Max height: 384px (24rem) with scroll
- Background: White with border and shadow
- z-index: 50

**Contents**:
- **Workflow Creation**: When workflow was created and by whom
- **All Step Events**: Chronologically sorted list of all step starts and completions
- **Timeline View**: Complete audit trail from start to current state

**Example Output**:
```
İş akışı oluşturuldu                15.10.2025 14:30
  Oluşturan: Ahmet Yavuz

"İlk Görüşme" başlatıldı            15.10.2025 14:35

"İlk Görüşme" tamamlandı            15.10.2025 15:20

"Avukat Onayı" başlatıldı           15.10.2025 15:21

"Avukat Onayı" tamamlandı           15.10.2025 16:45
```

## Action-Specific Details

### Checklist (CHECKLIST)

**Completion Details**: Shows number of items completed

**Format**: `{count} madde tamamlandı`

**Example**: `3 madde tamamlandı`

### Lawyer Approval (APPROVAL_LAWYER)

**Completion Details**: Shows approval/rejection status and optional comment

**Format**: 
- Approved: `✓ Onaylandı: "{comment}"`
- Rejected: `✗ Reddedildi: "{comment}"`
- No comment: `✓ Onaylandı` or `✗ Reddedildi`

**Examples**:
- `✓ Onaylandı: "Dilekçe uygun görülmüştür"`
- `✗ Reddedildi: "Eksik belgeler var"`

### Document Request (REQUEST_DOC_CLIENT)

**Completion Details**: Shows uploaded document filename

**Format**: `Belge yüklendi: {filename or fileId}`

**Example**: `Belge yüklendi: nufus_cuzdani.pdf`

### Signature (SIGNATURE_CLIENT)

**Completion Details**: Shows signed document ID

**Format**: `Belge imzalandı: {documentId}`

**Example**: `Belge imzalandı: doc_clz123abc`

### Payment (PAYMENT_CLIENT)

**Completion Details**: Shows payment amount and currency

**Format**: `Ödeme tamamlandı: {amount} {currency}`

**Example**: `Ödeme tamamlandı: 5000.00 TRY`

## Date Format

All timestamps use Turkish locale formatting:

**Format**: `dd.mm.yyyy hh:mm`

**Example**: `15.10.2025 14:30`

## State Management

**Hover State**: Tracked using `hoveredStep` state variable

**Step Hover**: `hoveredStep === step.id`

**Workflow Hover**: `hoveredStep === "workflow-{workflow.id}"`

**Events**:
- `onMouseEnter`: Sets `hoveredStep` to show popup
- `onMouseLeave`: Sets `hoveredStep` to null to hide popup

## Styling

### Step-Level Button
```css
bg-slate-100 text-slate-600 hover:bg-slate-200
rounded-md px-2.5 py-1 text-xs
```

### Workflow-Level Button
```css
bg-blue-50 text-blue-700 hover:bg-blue-100
rounded-md px-2 py-0.5 text-xs
```

### Popup Container
```css
absolute left-0 top-full mt-1 z-50
rounded-lg border border-slate-200 bg-white shadow-lg
p-3 (step) or p-4 (workflow)
```

### Log Entry
```css
text-xs
font-medium text-slate-700 (action)
text-slate-400 (timestamp)
text-slate-600 pl-2 border-l-2 border-slate-200 (details)
```

## Benefits

### For Users
- Clean UI without JSON clutter
- Easy to understand audit trail
- Quick access to task history
- Professional appearance

### For Compliance
- Complete audit trail with timestamps
- User attribution (who created what)
- Action-specific completion details
- Exportable for legal proceedings

### For Developers
- Centralized log rendering functions
- Type-safe implementation
- Easy to extend for new action types
- Consistent UI pattern

## Implementation Details

### Functions

**`renderExecutionLog(step: WorkflowInstanceStep)`**
- Generates step-level execution log
- Parses step lifecycle events
- Extracts action-specific details from payload
- Returns formatted React component

**`renderWorkflowExecutionLog(workflow: WorkflowInstance)`**
- Generates workflow-level execution log
- Collects all step events
- Sorts chronologically by timestamp
- Returns scrollable timeline component

### State

**`hoveredStep: string | null`**
- Tracks which popup is currently shown
- `null`: No popup shown
- `step.id`: Step-level popup for that step
- `"workflow-{id}"`: Workflow-level popup for that workflow

## Testing

### Manual Testing Steps

1. **View Step History**:
   - Navigate to a matter with active workflows
   - Find a step that has been started or completed
   - Hover over the "Geçmiş" button
   - Verify popup appears with correct data
   - Move mouse away, verify popup disappears

2. **View Workflow History**:
   - Hover over workflow-level "Geçmiş" button
   - Verify popup shows complete timeline
   - Check chronological ordering
   - Verify scroll works for long histories

3. **Test Action-Specific Details**:
   - Complete a checklist task → Check "X madde tamamlandı"
   - Approve a task → Check "✓ Onaylandı: comment"
   - Reject a task → Check "✗ Reddedildi: comment"
   - Upload a document → Check "Belge yüklendi: filename"

4. **Test Edge Cases**:
   - Step with no history → Button should not appear
   - Step just started → Only shows start event
   - Completed step → Shows both start and completion
   - Skipped step → Shows "Görev atlandı"

## Troubleshooting

### Popup Not Appearing
- Check that step has `startedAt` or `completedAt`
- Verify `hoveredStep` state is being set correctly
- Check z-index conflicts with other elements

### Wrong Data Displayed
- Verify `actionData.payload` structure matches expected format
- Check action type switch case covers all types
- Ensure date parsing is working correctly

### Styling Issues
- Check Tailwind classes are compiled
- Verify responsive breakpoints
- Check popup width and positioning

## Future Enhancements

1. **Click to Pin**: Click button to pin popup open
2. **Export Log**: Download execution log as PDF/CSV
3. **Filter Events**: Show/hide specific event types
4. **Real-time Updates**: Auto-refresh when events occur
5. **User Avatars**: Show user photos in log entries
6. **Duration Tracking**: Show how long each step took
7. **Performance Metrics**: Average completion times
8. **Custom Formatting**: User-configurable date/time format

---

**Last Updated**: October 15, 2025  
**Version**: 1.0  
**Status**: Production Ready
