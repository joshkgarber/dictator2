# Stream Leader Agent

An automated Python agent that manages GitHub issue workflows by monitoring open "stream issues" (parent issues representing work streams) and their sub-issues, managing the workflow through comments and automated actions.

## Overview

The Stream Leader Agent runs as a Systemd service triggered by a timer, operating during business hours (9am-5pm) every 10 minutes. It automatically manages workflow by:

1. Polling for open stream issues (parent issues labeled as `stream` and `approved`)
2. Identifying the first open sub-issue for each stream
3. Closing stream issues when all sub-issues are complete
4. Adding the workflow comment `\ocjr work on this issue` when absent
5. Checking for related pull requests before re-adding comments

## Installation

### Prerequisites

- Python 3.7 or higher
- GitHub CLI (`gh`) installed and authenticated
- A GitHub personal access token with appropriate permissions

### Setup Steps

1. **Install the GitHub CLI** (if not already installed):
   ```bash
   # On Ubuntu/Debian
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
   sudo apt update
   sudo apt install gh

   # On macOS
   brew install gh
   ```

2. **Authenticate with GitHub**:
   ```bash
   gh auth login
   # Or use a token for headless environments
   gh auth login --with-token < token.txt
   ```

3. **Copy files to system location**:
   ```bash
   sudo mkdir -p /opt/stream-leader
   sudo cp stream_leader.py /opt/stream-leader/
   sudo chmod +x /opt/stream-leader/stream_leader.py
   ```

4. **Create service user** (recommended):
   ```bash
   sudo useradd -r -s /bin/false streamleader
   sudo chown -R streamleader:streamleader /opt/stream-leader
   ```

5. **Configure Systemd service**:
   ```bash
   # Edit the service file to set your repository and token
   sudo cp stream-leader.service.example /etc/systemd/system/stream-leader.service
   sudo nano /etc/systemd/system/stream-leader.service
   
   # Update GITHUB_TOKEN and GITHUB_REPO in the Environment lines
   ```

6. **Configure Systemd timer**:
   ```bash
   sudo cp stream-leader.timer.example /etc/systemd/system/stream-leader.timer
   ```

7. **Enable and start the timer**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable stream-leader.timer
   sudo systemctl start stream-leader.timer
   ```

8. **Verify timer is active**:
   ```bash
   sudo systemctl status stream-leader.timer
   sudo systemctl list-timers --all | grep stream-leader
   ```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub personal access token with `repo` and `read:org` scopes |
| `GITHUB_REPO` | No* | Repository in format "owner/repo". Auto-detected if in git repo |
| `PYTHONUNBUFFERED` | No | Set to `1` to ensure logs are not buffered |

*The script attempts to auto-detect the repository from the git remote. If running outside a git repository, you must set `GITHUB_REPO`.

### Creating a GitHub Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token (classic) with these scopes:
   - `repo` - Full control of private repositories
   - `read:org` - Read organization data (for organization repos)
3. Copy the token and set it in the service file

### Service File Customization

Edit `/etc/systemd/system/stream-leader.service` to customize:

- **User/Group**: Change the user that runs the service
- **Environment**: Update GITHUB_TOKEN and GITHUB_REPO
- **WorkingDirectory**: Change where the script runs from
- **ExecStart**: Modify command-line arguments

Example with command-line arguments:
```ini
ExecStart=/usr/bin/python3 /opt/stream-leader/stream_leader.py --verbose --log-file /var/log/stream-leader/agent.log
```

### Timer File Customization

Edit `/etc/systemd/system/stream-leader.timer` to customize the schedule:

- **OnCalendar**: Change the schedule (default: every 10 minutes, 9am-5pm)
- Examples:
  - `*-*-* 09..16:00/10:00` - Every 10 minutes from 9am to 5pm
  - `*-*-* 09:00,13:00,17:00` - At 9am, 1pm, and 5pm
  - `Mon..Fri 09..17:00/30:00` - Every 30 minutes on weekdays during business hours

## Usage

### Manual Execution

You can run the script manually for testing or debugging:

```bash
# Dry run mode (no changes made)
cd /opt/stream-leader
python3 stream_leader.py --dry-run --verbose

# Live run with verbose output
python3 stream_leader.py --verbose

# Run outside business hours
python3 stream_leader.py --force --verbose

# With log file
python3 stream_leader.py --verbose --log-file /tmp/stream-leader.log
```

### Viewing Logs

```bash
# View service logs
sudo journalctl -u stream-leader.service

# Follow logs in real-time
sudo journalctl -u stream-leader.service -f

# View logs since last boot
sudo journalctl -u stream-leader.service --since today
```

### Stopping/Starting the Service

```bash
# Stop the timer
sudo systemctl stop stream-leader.timer

# Start the timer
sudo systemctl start stream-leader.timer

# Restart the timer
sudo systemctl restart stream-leader.timer

# Check timer status
sudo systemctl status stream-leader.timer
```

## Workflow

### How the Agent Works

1. **Find Stream Issues**: Queries GitHub for open issues with both `stream` and `approved` labels
2. **Check Sub-Issues**: For each stream issue, retrieves its sub-issues
3. **Close Completed Streams**: If no open sub-issues exist, closes the stream issue
4. **Manage First Open Sub-Issue**:
   - If no workflow comment exists, adds `\ocjr work on this issue`
   - If comment exists but no PR is linked, re-adds the comment to maintain visibility
   - If PR exists, takes no action

### Label Requirements

To use the Stream Leader Agent, your issues must have the correct labels:

- **Stream Issues**: Must have both `stream` and `approved` labels
- **Sub-Issues**: Must be linked as sub-issues to a stream issue
- **Issue State**: Open issues are processed; closed issues are ignored

## Testing

### Manual Testing Steps

1. Create a test repository or use your existing repo
2. Create a stream issue with labels `stream` and `approved`
3. Create a sub-issue linked to the stream issue
4. Run in dry-run mode to verify detection:
   ```bash
   python3 stream_leader.py --dry-run --verbose
   ```
5. Run live to add the workflow comment:
   ```bash
   python3 stream_leader.py --verbose
   ```
6. Verify the comment was added to the sub-issue
7. Create a pull request linked to the sub-issue
8. Run again to verify the agent detects the PR and doesn't re-add the comment
9. Close the sub-issue
10. Run again to verify the stream issue is closed automatically

### Unit Testing

Run the built-in unit tests (if available):

```bash
cd /opt/stream-leader
python3 -m pytest tests/ -v
```

## Troubleshooting

### Common Issues

#### "GitHub CLI not authenticated"

Run `gh auth login` or set up authentication in the service:
```bash
sudo -u streamleader gh auth login
```

#### "Could not auto-detect repository"

Set the `GITHUB_REPO` environment variable in the service file.

#### "Failed to list issues"

- Verify the GitHub token has correct permissions
- Check that the token hasn't expired
- Ensure the token has access to the repository

#### Service not running on schedule

Check the timer status:
```bash
sudo systemctl status stream-leader.timer
sudo systemctl list-timers --all
```

Verify the timer is enabled:
```bash
sudo systemctl is-enabled stream-leader.timer
```

### Debug Mode

Run with maximum verbosity:
```bash
python3 stream_leader.py --verbose --dry-run 2>&1 | tee /tmp/stream-leader-debug.log
```

### Log Rotation

Configure log rotation to prevent disk space issues:

```bash
sudo tee /etc/logrotate.d/stream-leader << 'EOF'
/var/log/stream-leader/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 streamleader streamleader
}
EOF
```

## Security Considerations

- Store the GitHub token securely (use environment variables, never commit to git)
- Run the service with a dedicated non-root user
- Limit the token permissions to only what's needed
- Use systemd security features (already configured in service file)
- Regularly rotate the GitHub token

## Architecture

### Components

1. **stream_leader.py**: Main agent script
   - `GitHubClient`: Wrapper for GitHub CLI interactions
   - `StreamLeaderAgent`: Core workflow logic
   - `Issue`: Data class for issue representation

2. **stream-leader.service**: Systemd service unit
   - Defines how the script is executed
   - Configures environment and security settings

3. **stream-leader.timer**: Systemd timer unit
   - Defines when the service is triggered
   - Runs every 10 minutes during business hours

### Data Flow

```
Systemd Timer (every 10 min, 9am-5pm)
    ↓
Stream Leader Service
    ↓
GitHub CLI (gh)
    ↓
GitHub API
    ↓
Stream Issues & Sub-Issues
```

## Development

### Making Changes

1. Edit `stream_leader.py`
2. Test with `--dry-run` mode
3. Verify with `--verbose` output
4. Deploy updated script to `/opt/stream-leader/`
5. Restart the timer: `sudo systemctl restart stream-leader.timer`

### Contributing

When contributing changes:
- Test thoroughly in dry-run mode first
- Ensure idempotency (running multiple times produces same result)
- Add appropriate error handling
- Update this README with any new features or configuration options

## License

See the main repository LICENSE file.

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the service logs: `sudo journalctl -u stream-leader.service`
3. Open an issue in the repository
