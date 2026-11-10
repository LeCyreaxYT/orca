# Trello in Orca Sky

The Trello page displays the connected account's existing boards, lists, cards,
Markdown descriptions, checklists and latest notes. It uses Orca's native controls
and a horizontal Trello board layout. Open **Trello** in the left navigation, then
**Connect Trello** and authorize the account in your browser. This is a separate
OAuth grant for Orca; another application's Trello connection is not imported.

The connection uses the [official Trello MCP](https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/).
Credentials stay in the selected Orca profile, using the existing operating-system
credential protection. The UI reports when only owner-readable file protection is
available. Disconnect clears Orca's saved credentials; account-level revocation is
managed by Atlassian.

## Cards and templates

Choose a board in the toolbar. Lists retain their original names and order. Scroll
horizontally between lists and vertically within a long list. **Add a card** at the
bottom of a list selects that list for the new card. **New card** also appears in
the toolbar. An existing card can supply its description and checklist structure
through **Use as template** or the template URL field. New checklist items begin
unchecked; comments, people and past completion evidence are not copied.

Cards show description and comment indicators plus a completed/total checklist
badge. A complete checklist gets a green badge. Expand the badge to read and check
items directly in the board; the card dialog uses the same checklist controls and
progress display. Details are fetched only for expanded cards. Truncated comment
counts carry a plus sign rather than claiming an exact total.

Open a card to read its description, checklists and latest notes. Older discussion
remains accessible in Trello and through the CLI's paginated comments command.
Existing descriptions and history are preserved when the AI reports progress.

## Native chats and the AI workflow

Select an Orca workspace, open a card and choose **Work on this card**, then Codex
or Claude. This launches Orca's normal native chat, with the card URL, Trello run
ID and version-matched `orca-trello` instructions. The chat is placed in a sidebar
chat group named after its board. **Open chat** returns to that existing chat when
its native tab is still available. Existing orchestration remains responsible for
workers; the coordinator owns the card updates.

An agent already working in a native chat can use `orca trello link --card <url>
--json` to link that chat instead of starting another one. Native session evidence
resolves the actual workspace and persisted tab ID. An ordinary shell creates a
workspace task with `bound: false` and never guesses an open chat.

Boards using numbered lists 05, 06 and 07 infer Implementation, Test/Acceptance
and Done automatically. Otherwise use **Board options → Map workflow** to select
three existing lists. Each task pins those list IDs for its lifetime.

The agent reads the live card and relevant history, starts implementation, appends
evidence at meaningful checkpoints and updates explicitly verified checklist items.
Its final `review` command moves the card to Test/Acceptance. **Only the user can
accept the task and move it to Done in the native UI.** Agent CLI calls cannot
accept tasks, remap workflow lists or create cards directly in Done. Progress is
maintained by the agent following the supplied workflow, not inferred from an
arbitrary successful build or the end of a turn.

Acceptance is a joint walkthrough in the existing chat: the AI goes through the
scope, checklist and results with the user, asks for any required manual checks
and maintains the card from those concrete results. Remaining items stay open.
The user gives the final Go after that walkthrough and accepts in Orca or Trello.

The UI refreshes after local workflow changes and checks the foreground board and
open card for external changes every 30 seconds. It slows those checks while
unfocused and pauses them while hidden. The toolbar also refreshes them
manually. This does not alter the existing native chat history refresh feature.

## Reliability and current scope

Progress, review and card creation use a retained request UUID and a durable
receipt. A confirmed repeated request returns its result. An unknown or partial
write is not repeated automatically; inspect the receipt and actual card first.
The new-card dialog exposes this recovery state instead of offering a duplicate
submission. More details and command payloads are in `orca skills get orca-trello`.

This first version connects and starts native card chats on the local desktop.
Remote workspace chat launch and paired-device acceptance are not exposed. Boards
must already exist in Trello. Card moves by dragging, arbitrary card editing,
labels and member management remain in Trello. This page provides the board,
templates and AI task workflow without replacing Orca's chats or task providers.

Implementation checks cover OAuth callback/refresh cancellation, paginated board
reads, native caller admission, subscription cleanup, preservation of history and
checklists, partial-write receipts and user-only acceptance. Synthetic fixtures
cover the board, card dialog and creation form in light and dark themes. A live
account connection and real model execution require the user's OAuth grant and
are separate from these checks.
