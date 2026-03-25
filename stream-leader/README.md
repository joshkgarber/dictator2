# Stream Leader Agent

`stream_leader.py` automates stream issue workflow management.

## What it does

On each run the agent:

1. Finds open issues labeled `stream` and `approved`.
2. Skips each stream issue if its parent issue does not have the `approved` label.
3. Picks the stream's first open sub-issue.
4. Closes the stream issue when no open sub-issues remain.
5. Ensures the first open sub-issue has a `\ocjr work on this issue` comment.
6. If the comment already exists, checks for related pull-request cross-reference activity.
7. Re-posts the comment when no related PR exists and the reminder cooldown has elapsed.

## Requirements

- Python 3.11+
- GitHub CLI (`gh`) authenticated with issue read/write permission
- Repository access via either:
  - `--repo OWNER/REPO`, or
  - `GITHUB_REPOSITORY=OWNER/REPO`

Set one of these auth env vars for `gh`:

- `GH_TOKEN`
- `GITHUB_TOKEN`

## Usage

Run once:

```bash
python stream-leader/stream_leader.py --repo OWNER/REPO
```

Dry-run (no writes):

```bash
python stream-leader/stream_leader.py --repo OWNER/REPO --dry-run --log-level DEBUG
```

## Configuration

- `STREAM_LEADER_REMINDER_COOLDOWN_MINUTES` (default: `20`)
  - Minimum age of the latest `\ocjr work on this issue` comment before adding another reminder when no related PR exists.

## Systemd setup

Example unit files are included:

- `stream-leader/stream-leader.service.example`
- `stream-leader/stream-leader.timer.example`

Suggested installation:

```bash
sudo cp stream-leader/stream-leader.service.example /etc/systemd/system/stream-leader.service
sudo cp stream-leader/stream-leader.timer.example /etc/systemd/system/stream-leader.timer
sudo systemctl daemon-reload
sudo systemctl enable --now stream-leader.timer
```

Example `/etc/stream-leader.env`:

```bash
GH_TOKEN=YOUR_TOKEN_HERE
STREAM_LEADER_REMINDER_COOLDOWN_MINUTES=20
```
