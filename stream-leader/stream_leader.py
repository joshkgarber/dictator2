#!/usr/bin/env python3
"""Automate stream issue workflow management via GitHub CLI."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import Any

WORK_COMMENT = "/ocjr work on this issue"
DEFAULT_REMINDER_COOLDOWN_MINUTES = 20


class GitHubCLIError(RuntimeError):
    """Raised when a gh command returns a non-zero exit status."""


@dataclass
class StreamIssue:
    number: int
    url: str
    parent_number: int | None
    parent_labels: set[str]
    open_sub_issues: list[dict[str, Any]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        default=os.environ.get("GITHUB_REPOSITORY"),
        help="Repository in OWNER/REPO format (default: GITHUB_REPOSITORY)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log actions without mutating GitHub state",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Logging level",
    )
    parser.add_argument(
        "--reminder-cooldown-minutes",
        type=int,
        default=int(
            os.environ.get(
                "STREAM_LEADER_REMINDER_COOLDOWN_MINUTES",
                str(DEFAULT_REMINDER_COOLDOWN_MINUTES),
            )
        ),
        help=(
            "Minimum age of the last workflow comment before re-posting when no PR "
            "exists"
        ),
    )
    return parser.parse_args()


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level),
        format="%(asctime)s %(levelname)s %(message)s",
    )


def run_gh(args: list[str]) -> str:
    command = ["gh", *args]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or "unknown gh error"
        raise GitHubCLIError(f"gh command failed: {' '.join(command)} :: {message}")
    return result.stdout


def run_gh_json(args: list[str]) -> Any:
    output = run_gh(args)
    if not output.strip():
        return None
    return json.loads(output)


def fetch_issue_parent(repo: str, issue_number: int) -> dict[str, Any] | None:
    """Fetch the parent issue for a given issue using REST API."""
    try:
        parent = run_gh_json(
            ["api", f"repos/{repo}/issues/{issue_number}/parent"]
        )
        return parent if isinstance(parent, dict) else None
    except GitHubCLIError:
        return None


def fetch_issue_sub_issues(repo: str, issue_number: int) -> list[dict[str, Any]]:
    """Fetch open sub-issues for a given issue using REST API."""
    try:
        sub_issues = run_gh_json(
            ["api", f"repos/{repo}/issues/{issue_number}/sub_issues?state=open"]
        )
        if isinstance(sub_issues, list):
            return sub_issues
        return []
    except GitHubCLIError:
        return []


def fetch_open_approved_stream_issues(repo: str) -> list[StreamIssue]:
    """Fetch open issues with 'stream' and 'approved' labels."""
    # Use gh issue list with labels filter
    issues_data = run_gh_json(
        [
            "issue",
            "list",
            "--repo",
            repo,
            "--label",
            "stream",
            "--label",
            "approved",
            "--state",
            "open",
            "--limit",
            "100",
            "--json",
            "number,url",
        ]
    )

    if not isinstance(issues_data, list):
        return []

    stream_issues: list[StreamIssue] = []
    for issue in issues_data:
        if not isinstance(issue, dict):
            continue

        issue_number = issue.get("number")
        if not issue_number:
            continue

        # Fetch parent and sub-issues for each stream issue
        parent = fetch_issue_parent(repo, issue_number)
        sub_issues = fetch_issue_sub_issues(repo, issue_number)

        parent_labels = set()
        parent_number = None
        if parent and isinstance(parent, dict):
            parent_number = parent.get("number")
            parent_labels_data = parent.get("labels", [])
            if isinstance(parent_labels_data, list):
                parent_labels = {
                    label.get("name", "")
                    for label in parent_labels_data
                    if isinstance(label, dict) and label.get("name")
                }

        stream_issues.append(
            StreamIssue(
                number=issue_number,
                url=issue.get("url", ""),
                parent_number=parent_number,
                parent_labels=parent_labels,
                open_sub_issues=sub_issues,
            )
        )

    return stream_issues


def close_stream_issue(repo: str, issue_number: int, dry_run: bool) -> None:
    if dry_run:
        logging.info("[dry-run] Close stream issue #%s", issue_number)
        return
    run_gh(["issue", "close", str(issue_number), "--repo", repo, "--reason", "completed"])
    logging.info("Closed stream issue #%s", issue_number)


def get_issue_comments(repo: str, issue_number: int) -> list[dict[str, Any]]:
    payload = run_gh_json(
        [
            "issue",
            "view",
            str(issue_number),
            "--repo",
            repo,
            "--json",
            "comments",
        ]
    )
    comments = (payload or {}).get("comments", [])
    return comments if isinstance(comments, list) else []


def parse_timestamp(timestamp: str) -> dt.datetime:
    return dt.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def newest_matching_comment(comments: list[dict[str, Any]]) -> dict[str, Any] | None:
    matching = [
        comment
        for comment in comments
        if (comment.get("body") or "").strip() == WORK_COMMENT
    ]
    if not matching:
        return None
    return max(matching, key=lambda comment: parse_timestamp(comment["createdAt"]))


def add_work_comment(repo: str, issue_number: int, dry_run: bool) -> None:
    if dry_run:
        logging.info("[dry-run] Add work comment to issue #%s", issue_number)
        return
    run_gh(
        [
            "issue",
            "comment",
            str(issue_number),
            "--repo",
            repo,
            "--body",
            WORK_COMMENT,
        ]
    )
    logging.info("Added work comment to issue #%s", issue_number)


def has_related_pull_request(repo: str, issue_number: int) -> bool:
    """Check if an issue has related pull request activity using GraphQL."""
    owner, name = repo.split("/", 1)
    query = """
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          timelineItems(first: 100, itemTypes: [CONNECTED_EVENT]) {
            nodes {
              ... on ConnectedEvent {
                subject {
                  ... on PullRequest {
                    number
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    try:
        result = run_gh_json([
            "api", "graphql",
            "-F", f"owner={owner}",
            "-F", f"name={name}",
            "-F", f"number={issue_number}",
            "-f", f"query={query}"
        ])
        if not isinstance(result, dict):
            return False
        data = result.get("data", {})
        repository = data.get("repository", {})
        issue = repository.get("issue", {})
        timeline_items = issue.get("timelineItems", {})
        nodes = timeline_items.get("nodes", [])
        if not isinstance(nodes, list):
            return False
        for event in nodes:
            if not isinstance(event, dict):
                continue
            subject = event.get("subject")
            if isinstance(subject, dict) and subject.get("number"):
                return True
        return False
    except GitHubCLIError:
        return False


def should_repost_comment(
    previous_comment: dict[str, Any], cooldown_minutes: int
) -> bool:
    created_at = parse_timestamp(previous_comment["createdAt"])
    elapsed = dt.datetime.now(dt.timezone.utc) - created_at
    return elapsed >= dt.timedelta(minutes=cooldown_minutes)


def main() -> int:
    args = parse_args()
    configure_logging(args.log_level)

    if not args.repo:
        logging.error("Missing repository. Use --repo or set GITHUB_REPOSITORY.")
        return 2

    counters = {
        "streams_seen": 0,
        "streams_skipped_parent_unapproved": 0,
        "streams_closed": 0,
        "comments_added": 0,
        "reminders_added": 0,
        "issues_with_pr": 0,
    }

    try:
        stream_issues = fetch_open_approved_stream_issues(repo=args.repo)
        counters["streams_seen"] = len(stream_issues)
        logging.info("Processing %s approved stream issues", len(stream_issues))

        for stream_issue in stream_issues:
            if "approved" not in stream_issue.parent_labels:
                counters["streams_skipped_parent_unapproved"] += 1
                logging.info(
                    "Skipping stream issue #%s because parent #%s is not approved",
                    stream_issue.number,
                    stream_issue.parent_number,
                )
                continue

            if not stream_issue.open_sub_issues:
                close_stream_issue(args.repo, stream_issue.number, args.dry_run)
                counters["streams_closed"] += 1
                continue

            first_open_sub_issue = stream_issue.open_sub_issues[0]
            sub_issue_number = first_open_sub_issue["number"]
            comments = get_issue_comments(args.repo, sub_issue_number)
            latest_work_comment = newest_matching_comment(comments)

            if latest_work_comment is None:
                add_work_comment(args.repo, sub_issue_number, args.dry_run)
                counters["comments_added"] += 1
                continue

            if has_related_pull_request(args.repo, sub_issue_number):
                counters["issues_with_pr"] += 1
                logging.info(
                    "Sub-issue #%s already has related pull request activity",
                    sub_issue_number,
                )
                continue

            if should_repost_comment(
                previous_comment=latest_work_comment,
                cooldown_minutes=args.reminder_cooldown_minutes,
            ):
                add_work_comment(args.repo, sub_issue_number, args.dry_run)
                counters["reminders_added"] += 1
            else:
                logging.info(
                    "Skipping repost for issue #%s due to reminder cooldown",
                    sub_issue_number,
                )

        logging.info("Run complete: %s", counters)
        return 0
    except (GitHubCLIError, KeyError, ValueError, json.JSONDecodeError) as error:
        logging.error("Stream leader failed: %s", error)
        return 1


if __name__ == "__main__":
    sys.exit(main())
