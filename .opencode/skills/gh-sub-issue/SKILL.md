# gh-sub-issue Skill

This skill provides guidance for working with the `gh-sub-issue` GitHub CLI extension, which enables managing sub-issues for GitHub issues.

## Installation

**Check if already installed:**
```bash
gh extension list | grep yahsan2/gh-sub-issue
```

**Install:**
```bash
gh extension install yahsan2/gh-sub-issue
```

## Commands

### Link existing issue as sub-issue

```bash
gh sub-issue add <parent-issue-number> <issue-number>
```

Example: `gh sub-issue add 100 456` links issue 456 as sub-issue of 100

### List sub-issues

```bash
gh sub-issue list <parent-issue-number> [--json number,title,state]
```

Example: `gh sub-issue list 100` shows all sub-issues of issue 100

### Remove sub-issue link

```bash
gh sub-issue remove <parent-issue-number> <issue-number>
```

Example: `gh sub-issue remove 100 456` unlinks 456 from 100

## Key Flags

- `--json`: Output format (number,title,state,parent.number,total,openCount)

## Error Handling

- Check `gh auth status` if commands fail
- Verify issue numbers exist before linking
- Use `--force` with remove to skip confirmation
