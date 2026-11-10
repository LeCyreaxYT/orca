# Orca Sky desktop

Orca is a desktop workspace for coding agents, including native chats, terminals,
projects, folder workspaces, Git worktrees and agent orchestration. Orca Sky is a
personal fork extending that existing application. This feature keeps those native
chat and orchestration owners.

## Trello workflow

Mode: Operate. The user works with existing Trello boards and their own list names,
templates, Markdown descriptions, checklists and history. The native board makes
cards and progress easy to scan, and can start a normal Codex or Claude chat in the
selected workspace or return to a linked chat.

The AI maintains progress notes and verified checklist items during the work. It
hands implementation to Test & Acceptance with actual evidence and explicit open
checks. The user then walks through the card and results together with the AI in
the same chat. The AI maintains the board from those concrete results; the user
gives final approval before Done.

## Design authority and scope

The existing system in `docs/STYLEGUIDE.md`, `docs/styleguide/components.md` and
the native UI primitives remains authoritative: quiet monochrome surfaces, compact
controls and semantic status tokens. Trello references inform list/card structure,
metadata, checklist progress and per-list creation. Both light and dark themes and
900–1200 px desktop content areas are supported.

This first integration uses the official Trello MCP with a separate Orca OAuth
grant on the local desktop. Credentials stay in the profile's existing protection
mechanism. Fixture screenshots use clearly labeled synthetic data; they do not
establish a live account connection or prove real agent execution.

Detailed behavior and current limits: `docs/native-trello-workflow.md`.
