# Matter Team Management - Quick Start Guide

## What Was Added

✅ **New "Team" Tab** on Matter Detail page
✅ **Team Member List** with full details
✅ **Add Member** functionality (ADMIN/LAWYER only)
✅ **Remove Member** functionality (ADMIN/LAWYER only)
✅ **User Listing API** for member selection

## How to Use

### View Team Members

1. Navigate to any matter detail page
2. Click the **"Team"** tab (between Overview and Settings)
3. See all team members with:
   - Name and email
   - Role badge (LAWYER/PARALEGAL)
   - Owner indicator
   - Date added

### Add Team Member (ADMIN/LAWYER only)

1. On Team tab, click **"Add Member"** button
2. Select a user from the dropdown
3. Click **"Add Member"** to confirm
4. Team list automatically refreshes

### Remove Team Member (ADMIN/LAWYER only)

1. Hover over a team member card
2. Click the **X** button on the right
3. Confirm the removal in the popup
4. Team list automatically refreshes

**Note**: Cannot remove the matter owner

## Features

### Authorization
- ✅ **ADMIN**: Can add/remove any member
- ✅ **LAWYER**: Can add/remove any member
- ❌ **PARALEGAL**: View only, cannot manage
- ❌ **CLIENT**: View only, cannot manage

### Visual Indicators
- 🔵 **Blue badge**: LAWYER role
- 🟣 **Purple badge**: PARALEGAL role
- 🟢 **Green badge**: Matter owner
- 🔴 **Red badge**: Inactive user

### Smart Features
- Dropdown filters out existing members
- Cannot remove matter owner
- Confirmation before removal
- Loading states during operations
- Error messages for failures
- Real-time list updates

## Components Created

### 1. `MatterTeamSection.tsx`
- Complete team management interface
- Add/remove member dialogs
- Authorization checks
- Error handling

### 2. `/api/users` Endpoint
- Lists all active users
- Filters by role (LAWYER, PARALEGAL)
- Returns: id, name, email, role, isActive

### 3. Updated Matter Detail Page
- Added "Team" tab
- Integrated team section
- Passes current user role and matter owner

## API Endpoints Used

```bash
# Get team members
GET /api/matters/[id]/team

# Add member
POST /api/matters/[id]/team
Body: { "userId": "user_id" }

# Remove member
DELETE /api/matters/[id]/team
Body: { "userId": "user_id" }

# List users (for dropdown)
GET /api/users?role=LAWYER,PARALEGAL
```

## Testing Checklist

**As Admin/Lawyer**:
- [x] Navigate to matter → Team tab
- [x] See existing team members
- [x] Click "Add Member"
- [x] Select user from dropdown
- [x] Add member successfully
- [x] Try to remove a member
- [x] Confirm removal works
- [x] Verify cannot remove owner

**As Paralegal**:
- [x] Navigate to matter → Team tab
- [x] See team members
- [x] Verify no "Add Member" button
- [x] Verify no remove buttons

## Screenshots

### Team Tab (with members)
```
┌─────────────────────────────────────────────┐
│  Team Members                   [Add Member] │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ [JD] John Doe        [LAWYER] [Owner]│ [X]│
│  │      john@example.com                 │   │
│  │      Added Oct 16, 2025               │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ [SM] Sarah Miller    [PARALEGAL]     │ [X]│
│  │      sarah@example.com                │   │
│  │      Added Oct 15, 2025               │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Empty State
```
┌─────────────────────────────────────────────┐
│  Team Members                   [Add Member] │
│                                              │
│  ╔══════════════════════════════════════╗   │
│  ║           [Team Icon]                ║   │
│  ║                                      ║   │
│  ║      No team members yet             ║   │
│  ║  Add lawyers and paralegals to       ║   │
│  ║    collaborate on this matter        ║   │
│  ╚══════════════════════════════════════╝   │
└─────────────────────────────────────────────┘
```

## Common Issues

### "Cannot see team members"
→ Check that you have access to the matter (owner or existing team member)

### "Add Member button missing"
→ Only ADMIN and LAWYER roles can add members

### "User not in dropdown"
→ User is already a team member or is not LAWYER/PARALEGAL role

### "Cannot remove member"
→ Cannot remove the matter owner. Change ownership first.

## Next Steps

1. ✅ **Test the feature**: Navigate to a matter and try adding/removing members
2. ✅ **Add your team**: Add lawyers and paralegals to matters
3. ⏳ **Gather feedback**: See how users interact with the feature
4. ⏳ **Monitor usage**: Check team member activity

## Related Documentation

- `MATTER-TEAM-MEMBER-SYSTEM.md` - Complete technical documentation
- `MATTER-TEAM-UI-IMPLEMENTATION.md` - Detailed UI implementation guide
- `MATTER-WORKFLOW-ACCESS-FIX.md` - Access control documentation

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify user role and permissions
3. Check API responses in Network tab
4. Review error messages displayed in UI

---

**Status**: ✅ Production Ready
**Version**: 1.0
**Last Updated**: October 16, 2025
