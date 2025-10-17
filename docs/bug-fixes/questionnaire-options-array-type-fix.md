# Question Options Array Type Error Fix

## Problem

When editing a questionnaire, the application threw a runtime error:

```
TypeError: question.options.join is not a function
```

**Location**: `components/questionnaires/QuestionEditor.tsx` line 106

## Root Cause

The `options` field in the `QuestionnaireQuestion` model is defined as `Json?` in Prisma:

```prisma
model QuestionnaireQuestion {
  // ...
  options Json?
  // ...
}
```

When Prisma returns JSON fields, they can be any JSON-compatible value. The code was assuming `options` would always be an array (or null), but wasn't checking before calling `.join()`.

This could happen if:
1. The data was corrupted or stored incorrectly
2. Type casting from `as string[] | null` wasn't properly validating the actual runtime value
3. Prisma returned the JSON in an unexpected format

## Solution

Added defensive `Array.isArray()` checks before attempting to call array methods on `question.options`.

## Files Modified

### 1. `/components/questionnaires/QuestionEditor.tsx`

**Before**:
```tsx
<textarea
  value={question.options?.join("\n") || ""}
  onChange={(e) => updateOptions(e.target.value)}
  // ...
/>
```

**After**:
```tsx
<textarea
  value={Array.isArray(question.options) ? question.options.join("\n") : ""}
  onChange={(e) => updateOptions(e.target.value)}
  // ...
/>
```

### 2. `/app/(dashboard)/questionnaires/[id]/page.tsx`

**Before**:
```tsx
options: q.options as string[] | null,
```

**After**:
```tsx
options: Array.isArray(q.options) ? q.options : null,
```

This ensures that if `q.options` is not actually an array at runtime, it will be set to `null` instead of passing through an invalid value.

### 3. `/components/questionnaires/QuestionnairePreview.tsx`

**Before**:
```tsx
{question.options && question.options.length > 0 ? (
  question.options.map((option, optIndex) => (
    // ...
  ))
) : (
  <p>No options configured</p>
)}
```

**After**:
```tsx
{Array.isArray(question.options) && question.options.length > 0 ? (
  question.options.map((option, optIndex) => (
    // ...
  ))
) : (
  <p>No options configured</p>
)}
```

Applied to both SINGLE_CHOICE and MULTI_CHOICE question type sections.

## Why This Fix Works

### Type Guards vs Type Assertions

**Type Assertions** (the `as` keyword):
- Tell TypeScript "trust me, this is the type"
- No runtime checking
- Can cause runtime errors if assumption is wrong

```typescript
options: q.options as string[] | null  // ❌ No runtime validation
```

**Type Guards** (`Array.isArray()`):
- Actually check the value at runtime
- Safe even if data is corrupted or unexpected
- TypeScript understands them and narrows types

```typescript
options: Array.isArray(q.options) ? q.options : null  // ✅ Runtime validation
```

### Defense in Depth

The fix applies validation at multiple layers:

1. **Data Transformation Layer** (`page.tsx`): Validates when loading data from Prisma
2. **Display Layer** (`QuestionEditor.tsx`): Validates before displaying in textarea
3. **Preview Layer** (`QuestionnairePreview.tsx`): Validates before rendering options

This ensures that even if one layer fails, the others will catch invalid data.

## Testing

### Test Case 1: Normal Options Array ✅
```typescript
question.options = ["Option 1", "Option 2", "Option 3"]
```
- `Array.isArray()` returns `true`
- `.join("\n")` works correctly
- Displays as three lines in textarea

### Test Case 2: Null Options ✅
```typescript
question.options = null
```
- `Array.isArray()` returns `false`
- Defaults to empty string `""`
- Displays empty textarea

### Test Case 3: Corrupted Data ✅
```typescript
question.options = "not an array"  // or any non-array value
```
- `Array.isArray()` returns `false`
- Defaults to empty string `""`
- Displays empty textarea
- **No runtime error**

### Test Case 4: Empty Array ✅
```typescript
question.options = []
```
- `Array.isArray()` returns `true`
- `.join("\n")` returns `""`
- Displays empty textarea

## Prevention

### For Future JSON Fields

When working with Prisma JSON fields:

1. **Always use type guards** instead of type assertions
   ```typescript
   // ❌ Don't do this
   const value = jsonField as MyType;
   
   // ✅ Do this
   const value = isValidType(jsonField) ? jsonField : defaultValue;
   ```

2. **Validate at boundaries**
   - When data enters your application (from database)
   - When data is displayed (in components)
   - When data is processed (in handlers)

3. **Consider Zod for JSON validation**
   ```typescript
   import { z } from "zod";
   
   const optionsSchema = z.array(z.string()).nullable();
   const options = optionsSchema.parse(q.options);
   ```

## Related Issues

- Foreign key constraint error (fixed in previous commit)
- Both issues stem from editing existing questionnaires with data

## Summary

✅ **Fixed**: `question.options.join is not a function` error  
✅ **Added**: Runtime type validation with `Array.isArray()`  
✅ **Applied**: Defense-in-depth validation at multiple layers  
✅ **Prevented**: Future JSON type errors with better patterns  

The application now safely handles `question.options` regardless of its actual runtime value, preventing crashes when editing questionnaires.
