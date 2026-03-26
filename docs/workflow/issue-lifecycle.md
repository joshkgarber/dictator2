# Issue Lifecycle Workflow

This document describes the complete lifecycle of issues in this repository, from initial ideation through to completion. It defines the 6-phase workflow, responsible parties, and transition criteria at each stage.

## Overview

The workflow consists of **6 phases** designed to transform raw ideas and bug reports into structured, approved, and completed work items. The workflow combines human oversight (Owner) with automated assistance (Agents).

### Workflow Phases at a Glance

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Phase 1    │────▶│  Phase 2    │────▶│  Phase 3    │
│  Ideation   │     │  Refinement │     │  Approval   │
│  (Owner)    │     │  (Agent)    │     │  (Owner)    │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Phase 6    │◀────│  Phase 5    │◀────│  Phase 4    │
│  Stream     │     │  Cycle      │     │  Cycle      │
│  Leadership │     │  Approval   │     │  Planning   │
│  (Agent &   |     |  (Owner)    |     |  (Agent)    |
|  Owner)     │     └─────────────┘     └─────────────┘
└─────────────┘
```

---

## Phase 1: Ideation

**Responsible:** Owner  
**Purpose:** Report bugs, describe enhancements, and capture raw ideas

### Entry Criteria
- A new issue is created in the repository
- No specific labels required at creation

### Work Performed
1. Create a new GitHub issue describing the bug or enhancement
2. Provide initial description of the problem or feature
3. Include any screenshots, recordings, or supporting context
4. Assign **P0** or **P1** or **P2** or **PX** label to indicate priority
5. Assign **unrefined** label to signal the issue needs processing
6. Assign **P0** to issues to include them in the next cycle

### Exit Criteria
- Issue has **P0** label
- Issue has **unrefined** label
- Basic description exists (may be minimal)

### Output
A raw issue with:
- Basic title and description
- **P0** priority label
- **unrefined** status label

---

## Phase 2: Issue Refinement

**Responsible:** Issue Refiner Agent  
**Purpose:** Structure and clarify raw issues into actionable work items  
**Agent Reference:** (`.opencode/agent/issue-refiner.md`)

### Entry Criteria
- Issue has **P0** + **unrefined** labels

### Work Performed
The Issue Refiner Agent queries for unrefined P0 issues, determines whether each is a bug or enhancement, applies the appropriate template, structures the content with complete sections, and updates labels to mark the issue as refined and unapproved while preserving P0 priority.

### Exit Criteria
- **unrefined** label removed
- **refined** label added
- **unapproved** label added
- **bug** OR **enhancement** label added
- Issue body follows appropriate template

### Output
An set of well-drafted, well-structured issues.

---

## Phase 3: Issue Approval

**Responsible:** Owner  
**Purpose:** Review refined issues and approve for work

### Entry Criteria
- Issue has **P0** + **refined** + **unapproved** labels

### Work Performed
1. Review the refined issue for:
   - Accuracy of problem/feature description
   - Completeness of acceptance criteria
   - Feasibility of implementation
   - Alignment with project goals
2. Once approved, comment `/approved` on the issue

### Exit Criteria (On Approval)
- **unapproved** label removed
- **approved** label added
- `/approved` comment posted by Owner

### Output
Actionable and approved issues ready for cycle planning.

---

## Phase 4: Cycle Planning

**Responsible:** Cycle Planner Agent  
**Purpose:** Group approved issues into executable cycles with conflict-aware organization  
**Agent Reference:** `.opencode/agent/cycle-planner.md`

### Entry Criteria
- Issues have **P0** + **refined** + **approved** labels

### Work Performed
The Cycle Planner Agent queries for approved P0 issues, analyzes conflict risks between issue pairs, groups them into sequential streams for parallel execution, and creates a hierarchical structure with a master cycle issue, stream sub-issues, and linked work issues in execution order.

### Exit Criteria
- Master cycle issue created with `cycle` + `unapproved` labels
- Stream sub-issues created with `stream` + `unapproved` labels
- All approved P0 issues linked to appropriate streams

### Output
A Complete cycle structure with a master cycle issue, its stream sub-issues, and their work sub-issues linked in execution order.

---

## Phase 5: Cycle Approval

**Responsible:** Owner  
**Purpose:** Review and approve cycle and stream issues before work begins

### Entry Criteria
- Cycle issue created with `cycle` + `unapproved` labels
- Stream sub-issues created with `stream` + `unapproved` labels

### Work Performed
1. **Review Master Cycle Issue**:
   - Verify all approved P0 issues are included
   - Check stream grouping logic
   - Confirm conflict risk assessments

2. **Review Each Stream Issue**:
   - Examine sequential ordering
   - Verify completeness of stream description
   - Check work issue assignments

3. **Approve Each Stream**:
   - Comment `/approved` on each stream sub-issue

4. **Approve Cycle**:
   - Comment `/approved` on the master cycle issue

### Exit Criteria
- **unapproved** labels removed from cycle and all streams
- **approved** labels added to cycle and all streams

### Output
Approved cycle ready for execution.

### Important Notes
- **Work cannot begin until this approval is complete**
- All stream issues must be individually approved
- Cycle approval ensures Owner has reviewed entire plan

---

## Phase 6: Stream Leadership

**Responsible:** Stream Leader Agent & Owner  
**Purpose:** Trigger work on available issues and merge changes
**Agent Reference:** `stream-leader/README.md`

### Entry Criteria
- Cycle with **approved** label
- Stream issues with **approved** labels

### Work Performed
The stream leader triggers work to start on work issues. The owner reviews PRs and merges changes.

### Exit Criteria
- All sub-issues in all streams are complete (closed)
- All stream issues are closed
- Cycle work is finished

### Output
Completed work items with:
- All work issues closed
- All stream issues closed

---

## Label Reference

| Label | Meaning | Phase Association |
|-------|---------|-------------------|
| **P0** | Priority 0 - High priority requiring immediate attention | All phases |
| **unrefined** | Issue needs structure and clarification | Phase 1 → 2 transition |
| **refined** | Issue has been structured with template | Phase 2 exit |
| **unapproved** | Issue needs Owner approval | Phase 2 → 3, Phase 4 → 5 transition |
| **approved** | Issue has Owner approval and can proceed | Phase 3 exit, Phase 5 exit |
| **bug** | Issue describes a problem/bug | Phase 2 categorization |
| **enhancement** | Issue describes a feature/improvement | Phase 2 categorization |
| **cycle** | Master issue grouping streams into a development cycle | Phase 4 exit |
| **stream** | Sub-issue organizing sequential work within a cycle | Phase 4 exit |

### Label Flow Diagram

```
Phase 1: Ideation
    │
    ▼
┌─────────────────────────────┐
│ P0, unrefined               │
└─────────────────────────────┘
    │
    ▼ Issue Refiner Agent
Phase 2: Refinement
    │
    ▼
┌─────────────────────────────┐
│ P0, refined, unapproved,    │
│ bug OR enhancement          │
└─────────────────────────────┘
    │
    ▼ Owner: /approved comment
Phase 3: Issue Approval
    │
    ▼
┌─────────────────────────────┐
│ P0, refined, approved,    │
│ bug OR enhancement          │
└─────────────────────────────┘
    │
    ▼ Cycle Planner Agent
Phase 4: Cycle Planning
    │
    ▼
┌─────────────────────────────┐
│ cycle/stream, unapproved    │
│ + linked hierarchy          │
└─────────────────────────────┘
    │
    ▼ Owner: /approved on all
Phase 5: Cycle Approval
    │
    ▼
┌─────────────────────────────┐
│ cycle/stream, approved      │
│ + linked hierarchy          │
└─────────────────────────────┘
    │
    ▼ Stream Leader Agent & Owner
Phase 6: Stream Leadership
    │
    ▼
   Complete!
```

---

## Agent Reference

| Agent | Phase | Purpose | Location |
|-------|-------|---------|----------|
| **Issue Refiner** | Phase 2 | Structure raw issues with templates | `.opencode/agent/issue-refiner.md` |
| **Cycle Planner** | Phase 4 | Organize approved issues into cycles | `.opencode/agent/cycle-planner.md` |
| **Stream Leader** | Phase 6 | Trigger work execution | `stream-leader/README.md` |

---

## `/approved` Comment Workflow

The `/approved` comment is the Owner's signal that that the issue is ready to be included in the next phase:

1. **Phase 3** - Owner comments `/approved` on refined issues
   - Signals ready for cycle planning

2. **Phase 5** - Owner comments `/approved` on:
   - Master cycle issue
   - Each individual stream sub-issue
   - Required on ALL streams before work can begin

The comment serves as both documentation of approval and trigger for automated label updates. (See `.github/workflows/issue_approval.yaml`.)

---

## Integration with gh-sub-issue

The workflow leverages the `gh-sub-issue` GitHub CLI extension for managing hierarchical relationships:

### Hierarchy Structure

```
Cycle Issue (master)
├── Stream Issue 1
│   ├── Work Issue A
│   ├── Work Issue B
│   └── Work Issue C
├── Stream Issue 2
│   ├── Work Issue D
│   └── Work Issue E
└── Stream Issue 3
    └── Work Issue F
```

For detailed command reference, see `.opencode/skills/gh-sub-issue/SKILL.md`.

---

## Phase Summary Table

| Phase | Name | Responsible | Entry State | Exit State | Key Output |
|-------|------|-------------|-------------|------------|------------|
| 1 | Ideation | Owner | New issue | P0 + unrefined | Raw issue created |
| 2 | Refinement | Issue Refiner Agent | P0 + unrefined | refined + unapproved + bug/enhancement | Structured, actionable issue |
| 3 | Issue Approval | Owner | refined + unapproved | approved | Approved work item |
| 4 | Cycle Planning | Cycle Planner Agent | approved | cycle/stream + unapproved + hierarchy | Organized cycle with streams |
| 5 | Cycle Approval | Owner | unapproved cycle/streams | approved on all | Approved cycle ready for execution |
| 6 | Stream Leadership | Stream Leader Agent & Owner | approved cycle | All issues complete | Completed work |

---

## Quick Reference

### Issue States at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│ Raw Idea                                                     │
│   └─▶ [Owner creates] P0 + unrefined                         │
│       └─▶ [Agent refines] P0 + refined + unapproved          │
│           └─▶ [Owner approves] P0 + approved                 │
│               └─▶ [Agent plans] cycle + unapproved           │
│                   └─▶ [Owner approves] cycle + approved      │
│                       └─▶ [Agent & Owner execute] COMPLETE   │
└──────────────────────────────────────────────────────────────┘
```

### Required Owner Actions

1. **Phase 1**: Create issues with P0 + unrefined labels
2. **Phase 3**: Review and comment `/approved` on refined issues
3. **Phase 5**: Review cycle, comment `/approved` on cycle AND each stream
4. **Phase 6**: Review PRs and merge changes

### Automated Agent Actions

1. **Phase 2**: Issue Refiner processes unrefined → refined
2. **Phase 4**: Cycle Planner creates cycle + stream structure
3. **Phase 6**: Stream Leader triggers work
