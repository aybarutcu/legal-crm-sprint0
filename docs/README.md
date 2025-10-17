# Documentation Directory

> **🎯 Start with [MASTER-SYSTEM-DOCUMENTATION.md](./MASTER-SYSTEM-DOCUMENTATION.md)** - Your single source of truth!

This directory contains all project documentation in an organized structure.

---

## 📚 Quick Start

### New to the project?
1. Read [MASTER-SYSTEM-DOCUMENTATION.md](./MASTER-SYSTEM-DOCUMENTATION.md) (30-45 min)
2. Follow the setup instructions
3. Reference feature docs as needed

### Looking for something specific?
- **System overview** → [MASTER-SYSTEM-DOCUMENTATION.md](./MASTER-SYSTEM-DOCUMENTATION.md)
- **Feature details** → [`features/`](#features-folder)
- **Bug fixes** → [`bug-fixes/`](#bug-fixes-folder)
- **Historical context** → [`archive/`](#archive-folder)

---

## 📁 Directory Structure

```
docs/
├── 📄 MASTER-SYSTEM-DOCUMENTATION.md    ⭐ Complete system documentation
├── 📄 README.md                          This file
├── 📄 DOCUMENTATION-MIGRATION-GUIDE.md   Migration guide
├── 📄 DOCUMENTATION-CONSOLIDATION-SUMMARY.md
├── 📄 openapi.yaml                       API specification
├── 📄 schema-enhancements.md             Database schema notes
├── 📄 SEED-DATA.md                       Seed data info
│
├── 📁 features/                          Feature-specific docs
│   ├── workflow/                         Workflow system
│   ├── matter/                           Matter management
│   ├── document/                         Document management
│   ├── context/                          Context system
│   └── auth/                             Auth & client portal
│
├── 📁 bug-fixes/                         Important bug fixes
├── 📁 archive/                           Historical docs
│   ├── sprints/                          Sprint planning
│   ├── task-reports/                     Task completion reports
│   └── outdated/                         Superseded docs
│
├── 📁 adr/                               Architecture decisions
└── 📁 runbooks/                          Operational procedures
```

---

## 📄 Core Documents

### [MASTER-SYSTEM-DOCUMENTATION.md](./MASTER-SYSTEM-DOCUMENTATION.md) ⭐
**Status**: ✅ Current | **Updated**: Oct 16, 2025

The authoritative, up-to-date documentation covering:
- Complete system architecture
- All implemented features (with ✅ status markers)
- Database schema (20+ models)
- API endpoints (50+)
- Workflow system guide
- Authentication & authorization
- Development & deployment guides
- Known issues & fixes

**This is where you start!**

### [DOCUMENTATION-MIGRATION-GUIDE.md](./DOCUMENTATION-MIGRATION-GUIDE.md)
**Status**: ✅ Current

Guide for transitioning from old scattered docs to the new organized structure.

### [DOCUMENTATION-CONSOLIDATION-SUMMARY.md](./DOCUMENTATION-CONSOLIDATION-SUMMARY.md)
**Status**: ✅ Current

Summary of the documentation reorganization effort.

---

## 📁 Features Folder

Detailed documentation for major features. Each folder contains focused docs for that feature area.

### `features/workflow/` - Workflow System
**18 documents** covering the complete workflow engine.

Key docs:
- `WORKFLOW-ANALYSIS.md` - System analysis
- `workflow-context-guide.md` - Context system guide
- `WRITE-TEXT-ACTION-IMPLEMENTATION.md` - Latest action type
- `WRITE-TEXT-UI-INTEGRATION.md` - UI integration
- `ACTION-CONFIG-FORMS.md` - Configuration forms

**Status**: ✅ Current

### `features/matter/` - Matter Management
**11 documents** about case/matter management.

Key docs:
- `MATTER-TEAM-MEMBER-SYSTEM.md` - Team collaboration
- `MATTER-TEAM-QUICKSTART.md` - Quick start guide
- `MATTER-DETAIL-UI-REORGANIZATION.md` - UI structure

**Status**: ✅ Current

### `features/document/` - Document Management
**5 documents** about file handling and storage.

Key docs:
- `DOCUMENT-MANAGEMENT-PHASE1-2-IMPLEMENTATION.md` - Full implementation
- `DOCUMENT-MANAGEMENT-QUICK-SUMMARY.md` - Quick overview

**Status**: ✅ Current

### `features/context/` - Context System
**5 documents** about workflow context management.

Key docs:
- `CONTEXT-UI-QUICKSTART.md` - Quick start
- `CONTEXT-SCHEMA-COMPLETE.md` - Schema documentation

**Status**: ✅ Current

### `features/auth/` - Authentication & Client Portal
**2 documents** about user auth and client portal.

Key docs:
- `contact-to-client-workflow.md` - Client conversion process
- `QUICKSTART-CONTACT-TO-CLIENT.md` - Quick guide

**Status**: ✅ Current

---

## 🐛 Bug Fixes Folder

Important bug fix documentation.

### `bug-fixes/CLIENT-INVITATION-AUTH-BUG-FIX.md`
**Date**: Oct 16, 2025 | **Severity**: ⚠️ CRITICAL

Fixed duplicate user creation bug where clients were created as LAWYER users.

**Status**: ✅ Fixed

### `bug-fixes/WRITE-TEXT-VALIDATION-FIX.md`
**Date**: Oct 16, 2025 | **Severity**: Medium

Fixed 422 validation errors for WRITE_TEXT workflow steps.

**Status**: ✅ Fixed

---

## 📦 Archive Folder

Historical documentation kept for reference. ⚠️ **These docs are NOT current!**

See [`archive/README.md`](./archive/README.md) for details.

### `archive/sprints/` - Sprint Planning
Sprint 2-7 planning documents (historical reference only)

### `archive/task-reports/` - Task Reports
Task completion reports (may contain useful implementation details)

### `archive/outdated/` - Superseded Documents
Documents replaced by MASTER-SYSTEM-DOCUMENTATION.md

**Status**: ❌ Deprecated

---

## Quick Reference

| What You Need | Where to Look |
|---------------|---------------|
| **Complete system overview** | [MASTER-SYSTEM-DOCUMENTATION.md](./MASTER-SYSTEM-DOCUMENTATION.md) |
| **Setup instructions** | MASTER-SYSTEM-DOCUMENTATION.md → Development Guide |
| **Database schema** | MASTER-SYSTEM-DOCUMENTATION.md → Database Schema |
| **API endpoints** | MASTER-SYSTEM-DOCUMENTATION.md → API Endpoints |
| **Workflow details** | [features/workflow/](./features/workflow/) |
| **Matter management** | [features/matter/](./features/matter/) |
| **Recent bug fixes** | [bug-fixes/](./bug-fixes/) |
| **Historical context** | [archive/](./archive/) |

---

## How to Use This Documentation

### For New Developers
1. Read MASTER-SYSTEM-DOCUMENTATION.md (30-45 min)
2. Follow Development Guide to setup environment
3. Reference feature docs for your first task
4. Start contributing!

**Expected time**: 2-3 days to full productivity

### For Existing Developers
1. Bookmark MASTER-SYSTEM-DOCUMENTATION.md
2. Check it first for any question
3. Dive into feature docs for implementation details
4. Update master doc when making changes

### For Making Changes
1. Update code
2. Update MASTER-SYSTEM-DOCUMENTATION.md in same PR
3. Create/update feature doc if complex
4. Get both code and docs reviewed together

---

## Documentation Standards

### Status Markers
- ✅ **Current** - Reflects actual implementation
- ⚠️ **Reference** - Useful but may be outdated
- ❌ **Deprecated** - Superseded, use master doc

### When to Create New Docs
✅ **Do create** for:
- Complex features (>500 lines)
- Significant bug fixes
- Architecture decisions (ADR)
- Operational procedures (runbooks)

❌ **Don't create** for:
- Small changes (update master doc)
- Quick fixes (update master doc)

---

## Maintenance Schedule

- **Daily**: Update master doc with code changes
- **Weekly**: Review master doc accuracy
- **Monthly**: Full documentation review, archive old docs
- **Before Release**: Verify all docs current

---

**Remember**: Start with [MASTER-SYSTEM-DOCUMENTATION.md](./MASTER-SYSTEM-DOCUMENTATION.md) 🚀
