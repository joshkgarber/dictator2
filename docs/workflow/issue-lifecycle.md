# Issue Lifecycle Workflow

This document describes the complete lifecycle of issues in this repository, from initial ideation through to completion. It defines the 6-phase workflow, responsible parties, and transition criteria at each stage.

## Overview

The workflow consists of **6 phases** designed to transform raw ideas and bug reports into structured, approved, and completed work items. The workflow balances human oversight (Owner) with automated assistance (Agents) to ensure quality while maintaining efficiency.

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
│  (Agent)    │     │  (Owner)    │     │  (Agent)    │
└─────────────┘     └─────────────┘     └─────────────┘
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
4. Assign **P0|P1|P2|PX** label to indicate priority
5. Assign **unrefined** label to signal the issue needs processing

### Exit Criteria
- Issue has **P0** label
- Issue has **unrefined** label
- Basic description exists (may be minimal)

### Output
A raw issue with:
- Basic title and description
- **P0|P1|P2|PX** priority label
- **unrefined** status label

---

## Phase 2: Issue Refinement

**Responsible:** Issue Refiner Agent  
**Purpose:** Structure and clarify raw issues into actionable work items  
**Agent Reference:** (`.opencode/agent/issue-refiner.md`)

### Entry Criteria
- Issue has **P0** + **unrefined** labels

### Work Performed
1. **Query** for issues with `P0` AND `unrefined` labels
2. **Analyze** the issue to determine if it's a bug or enhancement
3. **Apply Template** based on determination:
   - Bug: Use `.github/ISSUE_TEMPLATE/bug.md`
   - Enhancement: Use `.github/ISSUE_TEMPLATE/enhancement.md`
4. **Structure Content**:
   - Fill in all relevant sections
   - Preserve original intent and information
   - Add missing details based on project knowledge
   - Use project-appropriate terminology
5. **Update Labels**:
   - REMOVE: `unrefined`
   - ADD: `refined`
   - ADD: `unapproved`
   - ADD: `bug` OR `enhancement` (as appropriate)
   - KEEP: `P0`

### Exit Criteria
- **unrefined** label removed
- **refined** label added
- **unapproved** label added
- **bug** OR **enhancement** label added
- Issue body follows appropriate template

### Output
An actionable, well-structured issue with:
- Complete template sections filled
- Clear acceptance criteria
- Defined testing steps
- Proper categorization (bug/enhancement)

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
2. If approved, comment `/approved` on the issue
3. If not approved, provide feedback for further refinement

### Exit Criteria (On Approval)
- **unapproved** label removed
- **approved** label added
- `/approved` comment posted by Owner

### Output
An approved issue ready for cycle planning with:
- **approved** label
- Owner's approval comment

### Alternative Exit (Rejection)
If the issue is not approved:
- Owner provides feedback in comments
- Issue may return to Phase 2 for additional refinement
- Or issue may be closed if no longer relevant

---

## Phase 4: Cycle Planning

**Responsible:** Cycle Planner Agent  
**Purpose:** Group approved issues into executable cycles with conflict-aware organization  
**Agent Reference:** [Cycle Planner Agent](../.opencode/agent/cycle-planner.md)

### Entry Criteria
- Issues have **P0** + **refined** + **approved** labels
- No existing cycle assignment

### Work Performed

#### 1. Issue Discovery
Query for all open issues with `P0` AND `approved` labels

#### 2. Conflict Risk Assessment
Analyze each issue pair for merge conflict likelihood:

**HIGH CONFLICT RISK** (same stream, sequential):
- Issues touching same files/directories
- Issues modifying same components
- Issues with overlapping database schema changes
- Issues affecting shared configuration files
- Issues with explicit dependencies

**LOW CONFLICT RISK** (different streams, parallel):
- Issues in separate modules
- Frontend vs backend with no API contract changes
- Documentation-only changes
- Issues with clear architectural boundaries

#### 3. Stream Planning
Create execution strategy with parallel streams:
- Group high-conflict issues into SAME stream (sequential execution)
- Distribute low-conflict issues across DIFFERENT streams (parallel execution)
- Establish sequential order within each stream

#### 4. Hierarchical Structure Creation

**Master Cycle Issue:**
- Title format: `Cycle: [Brief Theme] - [Issue Count] Issues`
- Labels: `cycle`, `unapproved`
- Body with stream breakdown and execution notes

**Stream Sub-Issues:**
- Title format: `Stream: [Stream Name]`
- Labels: `stream`, `unapproved`
- Description of sequential work order
- Linked as sub-issues to master cycle issue using `gh sub-issue add`

**Work Issue Linking:**
- Link work issues as sub-issues to their stream issues
- Link in execution order (first to last)
- Creates hierarchy: Master → Stream → Work Issues

### Exit Criteria
- Master cycle issue created with `cycle` + `unapproved` labels
- Stream sub-issues created with `stream` + `unapproved` labels
- All approved P0 issues linked to appropriate streams
- Hierarchical structure verified with `gh sub-issue list`

### Output
Complete cycle structure:
- Master cycle issue with overview
- Stream sub-issues with sequential order
- Work issues linked in execution order
- All issues labeled appropriately

### Tool Integration
Uses `gh-sub-issue` extension for managing sub-issue relationships. See [gh-sub-issue Skill](../.opencode/skills/gh-sub-issue/SKILL.md) for command reference.

---

## Phase 5: Cycle Approval

**Responsible:** Owner  
**Purpose:** Review and approve cycle and stream structure before work begins

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

3. **Approve Cycle**:
   - Comment `/approved` on the master cycle issue
   - **unapproved** label removed, **approved** label added

4. **Approve Each Stream**:
   - Comment `/approved` on each stream sub-issue
   - **unapproved** label removed, **approved** label added on each stream

### Exit Criteria
- `/approved` comment on master cycle issue
- `/approved` comment on ALL stream sub-issues
- **unapproved** labels removed from cycle and all streams
- **approved** labels added to cycle and all streams

### Output
Approved cycle ready for execution:
- Master cycle issue with **approved** label
- All stream issues with **approved** labels
- Clear signal that work can begin

### Important Notes
- **Work cannot begin until this approval is complete**
- All stream issues must be individually approved
- Cycle approval ensures Owner has reviewed entire plan

---

## Phase 6: Stream Leadership

**Responsible:** Stream Leader Agent  
**Purpose:** Trigger work on available issues and monitor progress  
**Agent Reference:** [Stream Leader Agent](../stream-leader/README.md)

### Entry Criteria
- Cycle with **approved** label
- Stream issues with **approved** labels

### Work Performed

The stream leader runs periodically (typically every 10 minutes during business hours 9am-5pm):

#### 1. Find Active Streams
Query for open issues labeled `stream` AND `approved`

#### 2. Validate Parent Approval
Skip streams whose parent cycle issue lacks the `approved` label

#### 3. Identify Available Work
An issue is **available** if:
- It is the **first issue** in the stream; OR
- The issue **before it** is complete (closed)

#### 4. Trigger Work
For each available open sub-issue:
1. Check if `/ocjr work on this issue` comment exists
2. If comment exists:
   - Check for related PR cross-reference activity
   - If no PR and cooldown elapsed, re-post comment as reminder
3. If comment doesn't exist:
   - Post `/ocjr work on this issue` comment

#### 5. Close Completed Streams
When a stream has no open sub-issues remaining:
- Close the stream issue
- Mark stream as complete

### Exit Criteria
- All sub-issues in all streams are complete (closed)
- All stream issues are closed
- Cycle work is finished

### Output
Completed work items with:
- All work issues closed
- All stream issues closed
- History of triggered work via `/ocjr work on this issue` comments

### Configuration
- **Reminder Cooldown:** `STREAM_LEADER_REMINDER_COOLDOWN_MINUTES` (default: 20 minutes)
- **Schedule:** Runs every 10 minutes during business hours (9am-5pm)

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
    ▼ Stream Leader Agent
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
| **Stream Leader** | Phase 6 | Trigger and monitor work execution | `stream-leader/README.md` |

---

## `/approved` Comment Workflow

The `/approved` comment is the Owner's signal that a phase is complete and the next phase can begin:

1. **Phase 3** - Owner comments `/approved` on refined issues
   - Removes `unapproved` label
   - Adds `approved` label
   - Signals ready for cycle planning

2. **Phase 5** - Owner comments `/approved` on:
   - Master cycle issue
   - Each individual stream sub-issue
   - Required on ALL streams before work can begin

The comment serves as both documentation of approval and trigger for automated label updates.

---

## Integration with gh-sub-issue

The workflow leverages the `gh-sub-issue` GitHub CLI extension for managing hierarchical relationships:

### Sub-Issue Commands

```bash
# Link an issue as a sub-issue
gh sub-issue add <parent-issue-number> <issue-number>

# List sub-issues of a parent
gh sub-issue list <parent-issue-number>

# Remove a sub-issue link
gh sub-issue remove <parent-issue-number> <issue-number>
```

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

For detailed command reference, see [gh-sub-issue Skill](../.opencode/skills/gh-sub-issue/SKILL.md).

---

## Phase Summary Table

| Phase | Name | Responsible | Entry State | Exit State | Key Output |
|-------|------|-------------|-------------|------------|------------|
| 1 | Ideation | Owner | New issue | P0 + unrefined | Raw issue created |
| 2 | Refinement | Issue Refiner Agent | P0 + unrefined | refined + unapproved + bug/enhancement | Structured, actionable issue |
| 3 | Issue Approval | Owner | refined + unapproved | approved | Approved work item |
| 4 | Cycle Planning | Cycle Planner Agent | approved | cycle/stream + unapproved + hierarchy | Organized cycle with streams |
| 5 | Cycle Approval | Owner | unapproved cycle/streams | approved on all | Approved cycle ready for execution |
| 6 | Stream Leadership | Stream Leader Agent | approved cycle | All issues complete | Completed work |

---

## Quick Reference

### Issue States at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│ Raw Idea                                                    │
│   └─▶ [Owner creates] P0 + unrefined                        │
│       └─▶ [Agent refines] P0 + refined + unapproved         │
│           └─▶ [Owner approves] P0 + approved                │
│               └─▶ [Agent plans] cycle + unapproved          │
│                   └─▶ [Owner approves] cycle + approved     │
│                       └─▶ [Agent executes] COMPLETE         │
└─────────────────────────────────────────────────────────────┘
```

### Required Owner Actions

1. **Phase 1**: Create issues with P0 + unrefined labels
2. **Phase 3**: Review and comment `/approved` on refined issues
3. **Phase 5**: Review cycle, comment `/approved` on cycle AND each stream

### Automated Agent Actions

1. **Phase 2**: Issue Refiner processes unrefined → refined
2. **Phase 4**: Cycle Planner creates cycle + stream structure
3. **Phase 6**: Stream Leader triggers work and monitors progress
