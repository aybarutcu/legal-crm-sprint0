# Debug Guide: Canvas Position Persistence

## What We Fixed

1. ✅ Added `positionX` and `positionY` fields to Prisma schema
2. ✅ Created database migration
3. ✅ Updated TypeScript types in components
4. ✅ Added position fields to Zod validation schema
5. ✅ Updated API endpoints to save/load positions
6. ✅ Added console logging for debugging

## How to Test

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Open Browser Console
- Open Chrome DevTools (F12)
- Go to Console tab
- Filter by "position" or look for emoji icons: 🎯 📍 💾

### 3. Create/Edit a Workflow Template
1. Go to http://localhost:3000/workflows/templates
2. Click "Create Template" or edit an existing one
3. **Open browser console** to watch logs

### 4. Test Drag & Save

**Step A: Drag Nodes**
- Drag a node to a new position
- Watch console for: `🎯 Node dragged: { nodeId, stepOrder, position }`
- This confirms drag events are firing

**Step B: Save Template**
- Click "Create Template" or "Update Template"
- Watch console for: `💾 Saving template with positions:`
- You should see an array with `title`, `positionX`, `positionY` for each step
- Example:
  ```
  💾 Saving template with positions: [
    { title: "Step 1", positionX: 450, positionY: 250 },
    { title: "Step 2", positionX: 800, positionY: 150 }
  ]
  ```

**Step C: Reopen Template**
- Navigate away or refresh
- Open the same template for editing
- Watch console for: `📍 Loading node position:`
- You should see logs like:
  ```
  📍 Loading node position: {
    title: "Step 1",
    order: 0,
    savedX: 450,      // ← Should be your custom position
    savedY: 250,      // ← Should be your custom position
    finalPosition: { x: 450, y: 250 }
  }
  ```

## What to Look For

### ✅ SUCCESS Indicators

1. **Drag Event**: Console shows `🎯 Node dragged` with correct position
2. **Save Payload**: Console shows `💾 Saving template` with `positionX`/`positionY` values
3. **Load Positions**: Console shows `📍 Loading node` with `savedX` and `savedY` as numbers (not null/undefined)
4. **Visual Match**: Nodes appear at same position when reopening template

### ❌ FAILURE Indicators

1. **No drag event**: `onNodeDragStop` not firing
   - Check if canvas is in readOnly mode
   - Check browser console for errors

2. **Positions undefined in save**: `savedX: undefined, savedY: undefined`
   - Position not being captured from canvas
   - Check `handleCanvasChange` is preserving positions

3. **Positions null in load**: `savedX: null, savedY: null`
   - Database not saving positions
   - Check API endpoint logs
   - Check database directly: `SELECT "positionX", "positionY" FROM "WorkflowTemplateStep"`

4. **Positions saved but not loaded**: Numbers in DB but undefined in load
   - API not returning position fields
   - Check GET endpoint includes positions in response

## Database Verification

Check if positions are actually in the database:

```bash
# Connect to Postgres
docker exec -it legal-crm-sprint0-postgres-1 psql -U postgres -d legalcrm

# Query positions
SELECT 
  id, 
  "templateId", 
  "order", 
  title, 
  "positionX", 
  "positionY" 
FROM "WorkflowTemplateStep" 
ORDER BY "templateId", "order";
```

Expected output:
```
 id   | templateId | order | title    | positionX | positionY
------+------------+-------+----------+-----------+-----------
 abc  | xyz123     | 0     | Step 1   | 450       | 250
 def  | xyz123     | 1     | Step 2   | 800       | 150
```

## API Verification

Test API endpoints directly:

```bash
# Get template (should include positionX/positionY in steps)
curl http://localhost:3000/api/workflows/templates/<template-id> | jq '.steps[] | {title, positionX, positionY}'
```

Expected response:
```json
{
  "title": "Step 1",
  "positionX": 450,
  "positionY": 250
}
{
  "title": "Step 2", 
  "positionX": 800,
  "positionY": 150
}
```

## Common Issues & Fixes

### Issue: Positions undefined when dragging
**Fix**: Check that `onNodeDragStop` is wired up correctly in ReactFlow component

### Issue: Positions not in save payload
**Fix**: Check `WorkflowTemplateEditor.tsx` line ~135 includes `positionX` and `positionY`

### Issue: Validation error when saving
**Fix**: Check `lib/validation/workflow.ts` includes position fields in schema

### Issue: Positions saved but not loaded
**Fix**: Check API GET endpoint returns position fields
**Fix**: Check `stepsToNodes()` function uses `step.positionX`

### Issue: Positions reset to default
**Fix**: Check database has actual values (not NULL)
**Fix**: Check `??` fallback logic in `stepsToNodes()`

## Success Checklist

- [ ] Console shows `🎯 Node dragged` when dragging
- [ ] Console shows `💾 Saving template with positions` with actual numbers
- [ ] Console shows `📍 Loading node` with savedX/savedY as numbers
- [ ] Nodes stay in custom positions after save/reload
- [ ] Database contains non-null position values
- [ ] API returns position fields in GET response

## Next Steps

If all checks pass but positions still don't persist:
1. Check for React component re-render issues
2. Verify `canvasSteps` useMemo dependencies
3. Check `handleCanvasChange` is being called
4. Look for state reset in parent components
