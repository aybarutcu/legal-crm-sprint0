# Sprint 1+ Roadmap & Backlog

**Last Updated**: October 17, 2025  
**Current Sprint**: Sprint 0 ✅ Complete  
**Next Sprint**: Sprint 1 (Planning)

---

## 🎯 Sprint 0 Completion Summary

### ✅ Completed (100%)

**Questionnaire System** - ALL 8 PHASES COMPLETE:
- ✅ Phase 1: Database Schema & API Foundation
- ✅ Phase 2: API Endpoints
- ✅ Phase 3: Workflow Action Handler
- ✅ Phase 4: Questionnaire Management UI
- ✅ Phase 5: Questionnaire Editor
- ✅ Phase 6: Workflow Integration
- ✅ Phase 7: Display & Response Viewing
- ✅ Phase 8: UI Integration & Polish

**Other Core Systems**:
- ✅ Authentication & Authorization (NextAuth + RBAC)
- ✅ Contact Management
- ✅ Matter Management (with team members)
- ✅ Document Management (S3 storage)
- ✅ Workflow System (7 action types)
- ✅ Task Management
- ✅ Event/Calendar System (with Google sync)
- ✅ Client Portal
- ✅ Dashboard with metrics

---

## 📋 Sprint 1+ Backlog

### Priority 1: UI/UX Improvements

#### 1. Matter Detail Page Redesign ⭐ ✅ **COMPLETED**
**Goal**: Better workflow visualization and interaction

**Status**: ✅ Complete - October 17, 2025

**Actual Time**: 4 hours

**Completed Features**:
- ✅ Created horizontal scrollable workflow timeline component
- ✅ Designed compact step cards for timeline (w-64, state-based colors)
- ✅ Added step selection/click interaction
- ✅ Created expanded step detail view (reuses WorkflowStepCard)
- ✅ Implemented smooth auto-scrolling to selected step
- ✅ Added visual indicators (completed, in-progress, pending, etc.)
- ✅ Hover effects and transitions (scale-105, ring highlights)
- ✅ Auto-select current step on page load
- ✅ Close button to deselect step

**Components Created**:
- `/components/matters/workflows/WorkflowTimeline.tsx` (274 lines)
- `/components/matters/workflows/WorkflowStepDetail.tsx` (106 lines)

**Components Modified**:
- `/components/matters/MatterDetailClient.tsx` (+40/-150 lines)

**Documentation**: `/docs/features/matter-detail/TIMELINE-UI-REDESIGN.md`

**Future Enhancements** (Not in scope):
- [ ] Mobile responsive width adjustment (currently w-64)
- [ ] Timeline filters (by status, role, search)
- [ ] Timeline zoom levels (compact/normal/expanded)
- [ ] Keyboard navigation (arrow keys, enter, escape)
- [ ] Touch gestures (swipe, pinch-to-zoom)
- [ ] Performance optimization for 100+ steps (virtual scrolling)

---

### Priority 2: Questionnaire Phase 2 Enhancements

#### 2.1 Conditional Logic (HIGH VALUE)
**Description**: Show/hide questions based on previous answers

**Features**:
- Define conditions (if answer X, show question Y)
- Branching logic (skip to different sections)
- Complex rules (AND/OR conditions)

**Use Cases**:
- "If client is individual, show personal info questions"
- "If case type is divorce, show family law questions"
- Skip irrelevant sections based on answers

**Estimated Time**: 8-10 hours

**Technical Approach**:
- Add `conditions` JSON field to QuestionnaireQuestion model
- Add condition editor UI in question editor
- Implement condition evaluation in execution component
- Update response validation to handle skipped questions

---

#### 2.2 File Upload Questions (HIGH VALUE)
**Description**: Allow file uploads as question answers

**Features**:
- File upload question type
- Multiple file uploads per question
- File type restrictions
- File size limits
- Preview uploaded files

**Use Cases**:
- "Upload your ID document"
- "Attach supporting evidence"
- "Provide contracts/agreements"

**Estimated Time**: 6-8 hours

**Technical Approach**:
- Add FILE_UPLOAD to QuestionType enum
- Integrate with existing document management system
- Store document IDs in answerJson
- Add file upload UI component
- Handle file validation and upload

---

#### 2.3 Auto-Save (MEDIUM VALUE)
**Description**: Automatically save questionnaire progress

**Features**:
- Save draft responses every 30 seconds
- Resume from where user left off
- "Saving..." indicator
- Conflict resolution if multiple tabs

**Estimated Time**: 3-4 hours

**Technical Approach**:
- Add `status: DRAFT` to QuestionnaireResponse
- Implement auto-save timer in execution component
- Add API endpoint for draft updates
- Add visual feedback (saving spinner)

---

#### 2.4 Rich Text Editor (MEDIUM VALUE)
**Description**: WYSIWYG editor for long-form text answers

**Features**:
- Bold, italic, underline formatting
- Lists (bullet/numbered)
- Links
- Basic text styling

**Estimated Time**: 4-5 hours

**Technical Approach**:
- Integrate Tiptap or similar editor
- Add RICH_TEXT question type
- Store HTML in answerText
- Sanitize HTML for security

---

#### 2.5 Analytics & Reporting (MEDIUM VALUE)
**Description**: Insights into questionnaire responses

**Features**:
- Completion rates
- Average time to complete
- Question-level analytics
- Export to Excel/PDF
- Response trends

**Estimated Time**: 5-6 hours

**Technical Approach**:
- Add analytics API endpoints
- Create dashboard for questionnaire stats
- Implement export functionality
- Add charts/graphs (recharts library)

---

#### 2.6 Question Templates (LOW-MEDIUM VALUE)
**Description**: Pre-built question library

**Features**:
- Question bank by practice area
- Clone/duplicate questionnaires
- Import questions from templates
- Share templates across team

**Estimated Time**: 4-5 hours

**Technical Approach**:
- Add QuestionTemplate model
- Create template management UI
- Add import/clone functionality
- Categorize by practice area

---

#### 2.7 Email Reminders (LOW VALUE)
**Description**: Automated reminders for incomplete questionnaires

**Features**:
- Send reminder emails
- Configurable reminder schedule
- Track reminder sends
- Stop reminders when completed

**Estimated Time**: 3-4 hours

**Technical Approach**:
- Add reminder job/cron
- Email template for reminders
- Track reminder history
- Add settings for reminder frequency

---

### Priority 3: Sprint 1 Roadmap Items

#### 3.1 Auth & RBAC Enhancement
**Features**:
- Field-level data masking
- Advanced permission system
- Password strength validation (zxcvbn)
- Two-factor authentication
- Audit log for security events

**Estimated Time**: 10-12 hours

---

#### 3.2 Upload Infrastructure Enhancement
**Features**:
- MinIO integration improvements
- Better file type validation
- Upload progress indicators
- Thumbnail generation for images/PDFs
- Virus scanning integration
- Bulk upload support

**Estimated Time**: 8-10 hours

---

#### 3.3 Dashboard Metrics Enhancement
**Features**:
- More metric cards (revenue, tasks, etc.)
- Interactive charts and graphs
- Real-time updates via WebSocket
- Customizable dashboard layout
- Export dashboard data
- Date range filters

**Estimated Time**: 12-15 hours

---

#### 3.4 Event/Calendar Integration Polish
**Features**:
- Email notifications for events
- More calendar sync options (Outlook, Apple)
- Recurring events support
- Event templates
- Calendar sharing with clients
- Availability/booking system

**Estimated Time**: 8-10 hours

---

### Priority 4: New Major Features

#### 4.1 Billing & Invoicing System
**Features**:
- Time tracking per matter
- Hourly rate configuration
- Invoice generation
- Payment tracking
- Client billing portal
- Payment integrations (Stripe, PayPal)
- Late payment reminders

**Estimated Time**: 40-50 hours

---

#### 4.2 Reporting System
**Features**:
- Custom report builder
- Pre-built report templates
- Scheduled reports (daily/weekly/monthly)
- Email report delivery
- Export to PDF/Excel/CSV
- Data visualization
- Report sharing

**Estimated Time**: 30-40 hours

---

#### 4.3 Communication Hub
**Features**:
- Internal team messaging
- Client communication history
- Email integration (send/receive)
- SMS integration
- Communication templates
- Thread/conversation view
- File sharing in messages

**Estimated Time**: 35-45 hours

---

#### 4.4 Advanced Search
**Features**:
- Global search across all entities
- Advanced filters and facets
- Search history
- Saved searches
- Boolean search operators
- Fuzzy matching
- Search analytics

**Estimated Time**: 20-25 hours

---

#### 4.5 Document Automation
**Features**:
- Document templates with variables
- Auto-populate from matter/client data
- Auto-populate from questionnaire responses
- PDF generation from templates
- E-signature integration
- Version control
- Template library

**Estimated Time**: 25-30 hours

---

#### 4.6 Client Intake Automation
**Features**:
- Public intake forms
- Automatic matter creation from intake
- Conflict check automation
- Lead scoring
- Intake analytics
- Customizable intake workflows
- Payment collection at intake

**Estimated Time**: 20-25 hours

---

## 🎯 Recommended Sprint 1 Plan

### Week 1: UI/UX Focus (High Impact, Quick Wins)

**Day 1-2**: Matter Detail Page Redesign (6 hours)
- Horizontal workflow timeline
- Expanded step details
- Better visual hierarchy

**Day 3-4**: Questionnaire Conditional Logic (10 hours)
- Game-changer for complex forms
- High user value
- Builds on recent momentum

**Day 5**: Auto-Save for Questionnaires (4 hours)
- Prevents data loss
- Quick win
- Great UX improvement

**Total**: ~20 hours / 1 week

---

### Week 2: Enhanced Features

**Day 1-2**: File Upload Questions (8 hours)
- High value for client data collection
- Leverages existing document system

**Day 3-4**: Dashboard Enhancements (15 hours)
- Better metrics and visibility
- Charts and graphs
- More engaging UI

**Day 5**: Polish & Testing (5 hours)
- End-to-end testing
- Bug fixes
- Documentation updates

**Total**: ~28 hours / 1 week

---

## 📊 Effort Estimates Summary

| Category | Feature | Priority | Hours |
|----------|---------|----------|-------|
| **UI/UX** | Matter Detail Redesign | 🔴 High | 4-6 |
| **Questionnaire** | Conditional Logic | 🔴 High | 8-10 |
| **Questionnaire** | File Upload Questions | 🔴 High | 6-8 |
| **Questionnaire** | Auto-Save | 🟡 Medium | 3-4 |
| **Questionnaire** | Rich Text Editor | 🟡 Medium | 4-5 |
| **Questionnaire** | Analytics | 🟡 Medium | 5-6 |
| **Questionnaire** | Templates | 🟢 Low | 4-5 |
| **Questionnaire** | Email Reminders | 🟢 Low | 3-4 |
| **Infrastructure** | Auth/RBAC | 🟡 Medium | 10-12 |
| **Infrastructure** | Upload System | 🟡 Medium | 8-10 |
| **Infrastructure** | Dashboard | 🟡 Medium | 12-15 |
| **Infrastructure** | Calendar | 🟡 Medium | 8-10 |
| **New Feature** | Billing/Invoicing | 🔵 Future | 40-50 |
| **New Feature** | Reporting | 🔵 Future | 30-40 |
| **New Feature** | Communications | 🔵 Future | 35-45 |
| **New Feature** | Search | 🔵 Future | 20-25 |
| **New Feature** | Doc Automation | 🔵 Future | 25-30 |
| **New Feature** | Client Intake | 🔵 Future | 20-25 |

---

## 🎨 Design Principles for Sprint 1+

1. **User-Centric**: Focus on solving real user pain points
2. **Incremental**: Build on existing features, don't rebuild
3. **Polish**: Better to have fewer features done well
4. **Mobile-First**: Ensure all features work on mobile
5. **Performance**: Keep the app fast and responsive
6. **Accessible**: Follow WCAG guidelines
7. **Secure**: Security is not optional
8. **Testable**: Write tests as you build

---

## 📝 Notes

- All estimates are for experienced developers
- Estimates include testing and documentation
- Adjust based on team velocity
- Prioritize based on user feedback
- Review and update after each sprint

---

**Status**: 📋 Ready for Sprint Planning  
**Last Review**: October 17, 2025  
**Next Review**: End of Sprint 1
