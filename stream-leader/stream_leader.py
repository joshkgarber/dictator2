#!/usr/bin/env python3
"""
Stream Leader Agent

An automated agent that manages GitHub issue workflows by monitoring
open "stream issues" (parent issues representing work streams) and
their sub-issues, managing the workflow through comments and automated
actions.

Usage:
    python stream_leader.py [--dry-run] [--verbose]

Environment Variables:
    GITHUB_TOKEN: GitHub personal access token for API access
    GITHUB_REPO: Repository in format "owner/repo" (optional, auto-detected)
"""

import argparse
import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import List, Optional, Tuple
from datetime import datetime

# Configuration
WORKFLOW_COMMENT = "/ocjr work on this issue"
STREAM_LABEL = "stream"
APPROVED_LABEL = "approved"
DAILY_START_HOUR = 9
DAILY_END_HOUR = 17

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


@dataclass
class Issue:
    """Represents a GitHub issue."""
    number: int
    title: str
    state: str
    labels: List[str]
    body: Optional[str] = None
    parent_number: Optional[int] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Issue":
        """Create Issue from GitHub API response dict."""
        labels = [label.get("name", "") for label in data.get("labels", [])]
        return cls(
            number=data.get("number", 0),
            title=data.get("title", ""),
            state=data.get("state", ""),
            labels=labels,
            body=data.get("body", "")
        )


class GitHubClient:
    """Client for interacting with GitHub via gh CLI."""

    def __init__(self, repo: Optional[str] = None):
        self.repo = repo or self._detect_repo()
        self._check_gh_cli()

    def _check_gh_cli(self) -> None:
        """Verify gh CLI is installed and authenticated."""
        try:
            result = subprocess.run(
                ["gh", "auth", "status"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode != 0:
                logger.error("GitHub CLI not authenticated. Run 'gh auth login'")
                sys.exit(1)
        except FileNotFoundError:
            logger.error("GitHub CLI (gh) not found. Please install it.")
            sys.exit(1)

    def _detect_repo(self) -> str:
        """Auto-detect repository from git remote."""
        try:
            result = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                url = result.stdout.strip()
                # Extract owner/repo from various git URL formats
                if url.startswith("git@github.com:"):
                    return url.replace("git@github.com:", "").replace(".git", "")
                elif url.startswith("https://github.com/"):
                    return url.replace("https://github.com/", "").replace(".git", "")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass

        # Fallback to env var or error
        repo = os.getenv("GITHUB_REPO")
        if not repo:
            logger.error("Could not auto-detect repository. Set GITHUB_REPO env var.")
            sys.exit(1)
        return repo

    def _run_gh_command(self, args: List[str]) -> Tuple[int, str, str]:
        """Run a gh CLI command and return result."""
        full_args = ["gh"] + args + ["--repo", self.repo]
        try:
            result = subprocess.run(
                full_args,
                capture_output=True,
                text=True,
                timeout=30
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            logger.error(f"Command timed out: gh {' '.join(args)}")
            return 1, "", "Timeout"
        except Exception as e:
            logger.error(f"Command failed: {e}")
            return 1, "", str(e)

    def list_issues(self, labels: List[str], state: str = "open") -> List[Issue]:
        """List issues with given labels."""
        label_filter = ",".join(labels)
        returncode, stdout, stderr = self._run_gh_command(
            ["issue", "list", "--label", label_filter, "--state", state, "--json", "number,title,state,labels,body"]
        )

        if returncode != 0:
            logger.error(f"Failed to list issues: {stderr}")
            return []

        try:
            data = json.loads(stdout)
            return [Issue.from_dict(item) for item in data]
        except json.JSONDecodeError:
            logger.error("Failed to parse issue list response")
            return []

    def get_issue(self, number: int) -> Optional[Issue]:
        """Get a single issue by number."""
        returncode, stdout, stderr = self._run_gh_command(
            ["issue", "view", str(number), "--json", "number,title,state,labels,body"]
        )

        if returncode != 0:
            if "Could not resolve to an Issue" in stderr:
                logger.debug(f"Issue #{number} not found or not accessible")
            else:
                logger.error(f"Failed to get issue #{number}: {stderr}")
            return None

        try:
            data = json.loads(stdout)
            return Issue.from_dict(data)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse issue #{number} response")
            return None

    def get_sub_issues(self, parent_number: int) -> List[Issue]:
        """Get sub-issues for a parent issue."""
        # Note: This uses GitHub's sub-issue API via gh CLI
        # The exact command may need adjustment based on gh CLI version
        returncode, stdout, stderr = self._run_gh_command(
            ["issue", "view", str(parent_number), "--json", "subIssues"]
        )

        if returncode != 0:
            logger.error(f"Failed to get sub-issues for #{parent_number}: {stderr}")
            return []

        try:
            data = json.loads(stdout)
            sub_issues_data = data.get("subIssues", [])
            sub_issues = []
            for sub_data in sub_issues_data:
                issue_number = sub_data.get("number")
                if issue_number:
                    issue = self.get_issue(issue_number)
                    if issue:
                        issue.parent_number = parent_number
                        sub_issues.append(issue)
            return sub_issues
        except json.JSONDecodeError:
            logger.error(f"Failed to parse sub-issues for #{parent_number}")
            return []

    def get_parent_issue(self, issue_number: int) -> Optional[Issue]:
        """Get the parent issue of a given issue."""
        returncode, stdout, stderr = self._run_gh_command(
            ["issue", "view", str(issue_number), "--json", "parent"]
        )

        if returncode != 0:
            logger.debug(f"Failed to get parent for issue #{issue_number}: {stderr}")
            return None

        try:
            data = json.loads(stdout)
            parent_data = data.get("parent")
            if parent_data:
                parent_number = parent_data.get("number")
                if parent_number:
                    return self.get_issue(parent_number)
        except json.JSONDecodeError:
            logger.error(f"Failed to parse parent data for #{issue_number}")

        return None

    def list_comments(self, issue_number: int) -> List[dict]:
        """List comments on an issue."""
        returncode, stdout, stderr = self._run_gh_command(
            ["issue", "view", str(issue_number), "--comments", "--json", "comments"]
        )

        if returncode != 0:
            logger.error(f"Failed to list comments for #{issue_number}: {stderr}")
            return []

        try:
            data = json.loads(stdout)
            return data.get("comments", [])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse comments for #{issue_number}")
            return []

    def add_comment(self, issue_number: int, body: str, dry_run: bool = False) -> bool:
        """Add a comment to an issue."""
        if dry_run:
            logger.info(f"[DRY RUN] Would add comment to #{issue_number}: {body}")
            return True

        returncode, stdout, stderr = self._run_gh_command(
            ["issue", "comment", str(issue_number), "--body", body]
        )

        if returncode != 0:
            logger.error(f"Failed to add comment to #{issue_number}: {stderr}")
            return False

        logger.info(f"Successfully added comment to issue #{issue_number}")
        return True

    def get_linked_pull_requests(self, issue_number: int) -> List[dict]:
        """Get pull requests linked to an issue."""
        returncode, stdout, stderr = self._run_gh_command(
            ["issue", "view", str(issue_number), "--json", "linkedPullRequests"]
        )

        if returncode != 0:
            logger.error(f"Failed to get linked PRs for #{issue_number}: {stderr}")
            return []

        try:
            data = json.loads(stdout)
            return data.get("linkedPullRequests", [])
        except json.JSONDecodeError:
            logger.error(f"Failed to parse linked PRs for #{issue_number}")
            return []

    def close_issue(self, issue_number: int, dry_run: bool = False) -> bool:
        """Close an issue."""
        if dry_run:
            logger.info(f"[DRY RUN] Would close issue #{issue_number}")
            return True

        returncode, stdout, stderr = self._run_gh_command(
            ["issue", "close", str(issue_number)]
        )

        if returncode != 0:
            logger.error(f"Failed to close issue #{issue_number}: {stderr}")
            return False

        logger.info(f"Successfully closed issue #{issue_number}")
        return True


class StreamLeaderAgent:
    """Main agent that manages stream issue workflows."""

    def __init__(self, github_client: GitHubClient, dry_run: bool = False, verbose: bool = False):
        self.github = github_client
        self.dry_run = dry_run
        self.verbose = verbose
        self.processed_count = 0
        self.actions_taken = 0
        self.errors_count = 0

    def run(self) -> None:
        """Main execution flow."""
        logger.info("Starting Stream Leader Agent")
        logger.info(f"Repository: {self.github.repo}")
        logger.info(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")

        # 1. Poll for open stream issues
        stream_issues = self._get_approved_stream_issues()
        if not stream_issues:
            logger.info("No approved stream issues found")
            return

        logger.info(f"Found {len(stream_issues)} approved stream issue(s)")

        # 2. Process each stream issue
        for stream_issue in stream_issues:
            try:
                self._process_stream_issue(stream_issue)
                self.processed_count += 1
            except Exception as e:
                logger.error(f"Error processing stream issue #{stream_issue.number}: {e}")
                self.errors_count += 1

        # 3. Log summary
        logger.info("=" * 50)
        logger.info("Stream Leader Agent Summary:")
        logger.info(f"  Stream issues processed: {self.processed_count}")
        logger.info(f"  Actions taken: {self.actions_taken}")
        logger.info(f"  Errors: {self.errors_count}")
        logger.info("=" * 50)

    def _get_approved_stream_issues(self) -> List[Issue]:
        """Get all open stream issues with 'approved' label."""
        return self.github.list_issues(labels=[STREAM_LABEL, APPROVED_LABEL])

    def _process_stream_issue(self, stream_issue: Issue) -> None:
        """Process a single stream issue."""
        logger.info(f"Processing stream issue #{stream_issue.number}: {stream_issue.title}")

        # Check if parent issue exists and has 'approved' label
        parent_issue = self.github.get_parent_issue(stream_issue.number)
        if parent_issue:
            if APPROVED_LABEL not in parent_issue.labels:
                logger.info(f"  Skipping: parent issue #{parent_issue.number} does not have 'approved' label")
                return
            if self.verbose:
                logger.info(f"  Parent issue #{parent_issue.number} approved")

        # Get sub-issues
        sub_issues = self.github.get_sub_issues(stream_issue.number)

        if self.verbose:
            logger.info(f"  Found {len(sub_issues)} sub-issue(s)")

        # Filter to open sub-issues only
        open_sub_issues = [sub for sub in sub_issues if sub.state == "open"]

        if not open_sub_issues:
            # No open sub-issues - close the stream
            logger.info(f"  No open sub-issues. Closing stream #{stream_issue.number}")
            if self.github.close_issue(stream_issue.number, self.dry_run):
                self.actions_taken += 1
            return

        # Process the first open sub-issue
        first_sub_issue = open_sub_issues[0]
        logger.info(f"  First open sub-issue: #{first_sub_issue.number} - {first_sub_issue.title}")

        # Check for workflow comment
        has_comment = self._has_workflow_comment(first_sub_issue.number)

        if not has_comment:
            # Add the workflow comment
            logger.info(f"  Adding workflow comment to #{first_sub_issue.number}")
            if self.github.add_comment(first_sub_issue.number, WORKFLOW_COMMENT, self.dry_run):
                self.actions_taken += 1
        else:
            # Check for linked PRs
            linked_prs = self.github.get_linked_pull_requests(first_sub_issue.number)

            if self.verbose:
                logger.info(f"  Found {len(linked_prs)} linked PR(s)")

            if not linked_prs:
                # No PR exists - re-add comment to maintain visibility
                logger.info(f"  No PR linked. Re-adding workflow comment to #{first_sub_issue.number}")
                if self.github.add_comment(first_sub_issue.number, WORKFLOW_COMMENT, self.dry_run):
                    self.actions_taken += 1
            else:
                logger.info(f"  PR exists for #{first_sub_issue.number}. No action needed.")

    def _has_workflow_comment(self, issue_number: int) -> bool:
        """Check if the workflow comment exists on an issue."""
        comments = self.github.list_comments(issue_number)

        for comment in comments:
            body = comment.get("body", "")
            if WORKFLOW_COMMENT in body:
                return True

        return False


def check_business_hours() -> bool:
    """Check if current time is within business hours (9am-5pm)."""
    now = datetime.now()
    return DAILY_START_HOUR <= now.hour < DAILY_END_HOUR


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Stream Leader Agent - Automated GitHub issue workflow manager"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate actions without making changes"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Run even outside business hours"
    )
    parser.add_argument(
        "--log-file",
        type=str,
        help="Path to log file (in addition to stdout)"
    )

    args = parser.parse_args()

    # Setup file logging if requested
    if args.log_file:
        file_handler = logging.FileHandler(args.log_file)
        file_handler.setFormatter(logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        ))
        logger.addHandler(file_handler)

    # Check business hours unless forced
    if not args.force and not check_business_hours():
        logger.info("Outside business hours (9am-5pm). Use --force to override.")
        return 0

    # Initialize GitHub client
    try:
        github_client = GitHubClient()
    except SystemExit:
        return 1

    # Run the agent
    agent = StreamLeaderAgent(
        github_client=github_client,
        dry_run=args.dry_run,
        verbose=args.verbose
    )

    try:
        agent.run()
        return 0 if agent.errors_count == 0 else 1
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
