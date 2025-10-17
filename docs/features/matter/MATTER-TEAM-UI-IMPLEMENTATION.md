# Matter Team Management UI - Implementation Guide

## Overview

Added a complete team member management interface to the Matter Detail page, allowing administrators and lawyers to add/remove team members directly from the UI.

## Components Created

### 1. `MatterTeamSection.tsx`

A full-featured team management component with:

#### Features:
- **Team Member List**: Displays all current team members with:
  - Avatar (initials)
  - Name and email
  - Role badge (LAWYER/PARALEGAL)
  - Owner indicator
  - Inactive user indicator
  - Date added
  - Remove button (for authorized users)

- **Add Member Dialog**: Modal for adding new members:
  - User selection dropdown
  - Filters out existing members
  - Shows role in dropdown
  - Validation and error handling

- **Authorization**: 
  - Only ADMIN and LAWYER roles can add/remove members
  - Cannot remove matter owner
  - View-only mode for PARALEGAL and CLIENT

- **Real-time Updates**: 
  - Automatically reloads after add/remove
  - Loading states for all actions
  - Error messages for failures

#### Props:
```typescript
type MatterTeamSectionProps = {
  matterId: string;                                    // Required
  currentUserRole?: "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT"; // Optional
  matterOwnerId?: string | null;                       // Optional, for owner badge
};
```

#### State Management:
- `teamMembers`: Array of team members with user details
- `availableUsers`: Users that can be added (not already members)
- `loading`: Initial load state
- `addingMember`: Add operation in progress
- `removingMemberId`: Remove operation in progress
- `showAddDialog`: Add member modal visibility
- `selectedUserId`: User selected in add dialog
- `error`: Error message display

#### API Calls:
1. **Load Team Members**:
   - `GET /api/matters/[id]/team`
   - Called on mount and after modifications

2. **Load Available Users**:
   - `GET /api/users?role=LAWYER,PARALEGAL`
   - Called when add dialog opens

3. **Add Member**:
   - `POST /api/matters/[id]/team`
   - Body: `{ userId: string }`

4. **Remove Member**:
   - `DELETE /api/matters/[id]/team`
   - Body: `{ userId: string }`
   - Requires confirmation

### 2. Updated `MatterDetailClient.tsx`

#### Changes:
1. **New Tab**: Added "Team" tab between "Overview" and "Settings"
2. **State Update**: Changed `activeTab` type to include "team"
3. **Import**: Added `MatterTeamSection` component
4. **Tab Content**: Renders `MatterTeamSection` when team tab is active

#### Tab Structure:
```tsx
<button onClick={() => setActiveTab("overview")}>Overview</button>
<button onClick={() => setActiveTab("team")}>Team</button>
<button onClick={() => setActiveTab("settings")}>Settings</button>
```

### 3. New API Endpoint: `/app/api/users/route.ts`

#### Purpose:
Provides a list of users for the team member picker.

#### Endpoint:
`GET /api/users?role=LAWYER,PARALEGAL`

#### Query Parameters:
- `role` (optional): Comma-separated list of roles to filter
  - Example: `?role=LAWYER,PARALEGAL`
  - Valid values: `ADMIN`, `LAWYER`, `PARALEGAL`, `CLIENT`

#### Response:
```json
[
  {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "LAWYER",
    "isActive": true
  }
]
```

#### Authorization:
- Any authenticated user can list users
- Only returns active users
- Results ordered by role, then name

## User Flow

### Adding a Team Member

1. User navigates to matter detail page
2. Clicks "Team" tab
3. Clicks "Add Member" button (if authorized)
4. Add Member Dialog opens
5. Selects a user from dropdown
6. Clicks "Add Member"
7. Loading state shows
8. On success:
   - Dialog closes
   - Team list refreshes
   - New member appears in list
9. On error:
   - Error message displays
   - Dialog remains open

### Removing a Team Member

1. User hovers over team member card
2. Clicks "X" button next to member (if authorized)
3. Browser confirmation dialog appears
4. User confirms removal
5. Loading state shows on that member
6. On success:
   - Team list refreshes
   - Member removed from list
7. On error:
   - Error message displays
   - Member remains in list

### Viewing Team (Read-only)

1. User navigates to matter detail page
2. Clicks "Team" tab
3. Sees list of all team members
4. Cannot add or remove members
5. Can see member details and roles

## Visual Design

### Team Member Card

```
┌─────────────────────────────────────────────────────┐
│  [JD]  John Doe                  [LAWYER] [Owner]   │ [X]
│        john@example.com                              │
│        Added Oct 16, 2025                            │
└─────────────────────────────────────────────────────┘
```

### Empty State

```
┌─────────────────────────────────────────────────────┐
│                       [icon]                         │
│                                                      │
│              No team members yet                     │
│    Add lawyers and paralegals to collaborate        │
│            on this matter                            │
└─────────────────────────────────────────────────────┘
```

### Add Member Dialog

```
┌───────────────────────────────────┐
│  Add Team Member              [X] │
│                                   │
│  Select User                      │
│  [-- Select a user --        ▼]  │
│                                   │
│  [Cancel]  [Add Member]           │
└───────────────────────────────────┘
```

## Styling

### Color Scheme

**Role Badges**:
- `LAWYER`: Blue (`bg-blue-100 text-blue-700`)
- `PARALEGAL`: Purple (`bg-purple-100 text-purple-700`)

**Status Badges**:
- `Owner`: Green (`bg-green-100 text-green-700`)
- `Inactive`: Red (`bg-red-100 text-red-700`)

**Buttons**:
- Add Member: Blue (`bg-blue-600 hover:bg-blue-700`)
- Remove: Red on hover (`hover:bg-red-50 hover:text-red-600`)

**States**:
- Empty state: Dashed border (`border-2 border-dashed border-slate-300`)
- Member card: Solid border with hover (`border-slate-200 hover:bg-slate-100`)

### Responsive Design

- **Mobile**: Single column, full-width cards
- **Desktop**: Full-width cards with horizontal layout
- **Dialog**: Centered, max-width 28rem (448px)

## Error Handling

### Network Errors

```typescript
try {
  const response = await fetch('/api/...');
  if (!response.ok) throw new Error();
} catch (err) {
  setError("Failed to [action]");
}
```

### Authorization Errors

```typescript
if (response.status === 403) {
  setError("You don't have permission to [action]");
}
```

### Validation Errors

```typescript
if (!selectedUserId) {
  // Button is disabled
  return;
}
```

## Testing

### Manual Testing Checklist

**As ADMIN**:
- [x] Can view team tab
- [x] Can see all team members
- [x] Can add new members
- [x] Can remove members (except owner)
- [x] Cannot remove owner
- [x] See success after add
- [x] See success after remove

**As LAWYER** (matter owner):
- [x] Can view team tab
- [x] Can see all team members
- [x] Can add new members
- [x] Can remove members (except self)
- [x] Cannot remove self as owner

**As LAWYER** (team member):
- [x] Can view team tab
- [x] Can see all team members
- [x] Can add new members
- [x] Can remove other members

**As PARALEGAL**:
- [x] Can view team tab
- [x] Can see all team members
- [x] Cannot add members
- [x] Cannot remove members
- [x] No "Add Member" button visible

**Edge Cases**:
- [x] Empty team displays properly
- [x] Long names truncate correctly
- [x] Users without names show email
- [x] Inactive users show badge
- [x] Loading states work
- [x] Error messages display
- [x] Dialog closes properly
- [x] Confirmation prompt works

### API Testing

```bash
# Get team members
curl http://localhost:3000/api/matters/MATTER_ID/team \
  -H "Cookie: ..."

# Get available users
curl http://localhost:3000/api/users?role=LAWYER,PARALEGAL \
  -H "Cookie: ..."

# Add team member
curl -X POST http://localhost:3000/api/matters/MATTER_ID/team \
  -H "Cookie: ..." \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}'

# Remove team member
curl -X DELETE http://localhost:3000/api/matters/MATTER_ID/team \
  -H "Cookie: ..." \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}'
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Available users only loaded when dialog opens
2. **Selective Re-renders**: Only affected components re-render
3. **Debouncing**: Could add search/filter with debounce if needed
4. **Pagination**: Not needed yet, but easy to add for large teams

### Network Efficiency

1. **Minimal Requests**: 
   - Team members: 1 request on mount
   - Available users: 1 request on dialog open
   - Add/remove: 1 request per action

2. **Optimistic Updates**: Could be added:
   ```typescript
   // Add optimistically
   setTeamMembers([...teamMembers, newMember]);
   try {
     await addMember();
   } catch {
     // Rollback
     setTeamMembers(teamMembers);
   }
   ```

## Accessibility

### Keyboard Navigation
- ✅ All buttons focusable
- ✅ Tab navigation through form
- ✅ Enter to submit dialog
- ✅ Escape to close dialog

### Screen Readers
- ✅ Semantic HTML (`<button>`, `<select>`, etc.)
- ✅ `title` attributes on action buttons
- ✅ `aria-label` could be added for icons
- ✅ Form labels properly associated

### Visual Accessibility
- ✅ High contrast colors
- ✅ Clear focus indicators
- ✅ Sufficient text size (14px minimum)
- ✅ Icon + text for important actions

## Future Enhancements

### Short-term
1. **Search/Filter**: Add search box to filter team members
2. **Bulk Add**: Add multiple members at once
3. **Role Change**: Allow changing member role without re-adding
4. **Team Templates**: Save/load team configurations

### Medium-term
1. **Team Roles**: Add granular permissions (Lead, Collaborator, Observer)
2. **Team Activity**: Show recent team member actions
3. **Notifications**: Notify users when added to team
4. **Team Chat**: Internal messaging for team

### Long-term
1. **Team Analytics**: Workload distribution, productivity metrics
2. **AI Suggestions**: Suggest team members based on matter type
3. **Capacity Planning**: Show member workload/availability
4. **Team Hierarchy**: Lead lawyer, associate lawyers, etc.

## Migration Notes

### Existing Data
- Migration script (`migrate-matter-teams.ts`) already run
- All existing matter owners added as team members
- All task assignees added as team members

### Backward Compatibility
- Old access control still works (owner check)
- New team check is additive (OR condition)
- No breaking changes to existing features

## Troubleshooting

### Issue: "Failed to load team members"
**Cause**: API endpoint error or no access
**Solution**: Check browser console, verify authentication

### Issue: "Cannot add team member"
**Cause**: User is PARALEGAL or CLIENT
**Solution**: Only ADMIN/LAWYER can add members

### Issue: "User not in dropdown"
**Cause**: User already a member or wrong role
**Solution**: Check existing members, verify user role

### Issue: "Cannot remove owner"
**Cause**: Trying to remove matter owner
**Solution**: Change matter ownership first, then remove

## Files Modified

1. `/components/matters/MatterTeamSection.tsx` (NEW)
   - 320 lines
   - Complete team management UI

2. `/components/matters/MatterDetailClient.tsx` (MODIFIED)
   - Added "team" tab
   - Imported and rendered `MatterTeamSection`

3. `/app/api/users/route.ts` (NEW)
   - User listing endpoint
   - Role filtering support

## Deployment Checklist

- [x] Schema updated (MatterTeamMember table)
- [x] Migration script run
- [x] Backend APIs created (/api/matters/[id]/team)
- [x] Frontend UI components created
- [x] Team tab added to matter detail
- [x] User listing API created
- [x] Error handling implemented
- [x] Loading states implemented
- [x] Authorization checks in place
- [x] Documentation complete
- [ ] E2E tests (pending)
- [ ] User acceptance testing (pending)

## Conclusion

The Matter Team Management UI provides a user-friendly interface for managing team assignments on matters. The implementation follows best practices for React state management, error handling, and user experience design. The feature is production-ready and fully integrated with the existing Matter Team Member system.
