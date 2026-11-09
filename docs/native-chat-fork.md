# Native conversation refresh and sidebar drop

This fork extends Orca's existing chats for Codex and Claude. It does not require a plugin or a separate chat interface.

- Open a native Codex or Claude chat and click **Reload conversation history** in its upper-right toolbar. In German this is **Chatverlauf neu laden**.
- Continue the same conversation in the original application, then reload it in Orca to see the newly saved entries. Reload is manual; it does not send a prompt or start an agent.
- Drag a conversation's **title** from Session History onto a workspace card in the left sidebar. Orca opens its existing native chat, or uses its normal **Resume in New Chat** action to adopt the conversation there.
- An already adopted conversation reopens in its owning workspace. Claude conversations require their original workspace; Codex follows Orca's existing workspace and recording-host eligibility rules.

Reload reads host-registered account stores, including the original system account when adoption copied a conversation into an Orca-managed home. It keeps Orca-owned messages, queued input, removed entries, and the current journal epoch. It refuses a stale read if the owning conversation or active Orca turn changes. A refresh exceeding the existing history catch-up bound fails before publishing partial results.

Only saved history can be reloaded. An unsaved streaming fragment may appear after the source application flushes it. Remote hosts need this fork's new `agentSession.refreshHistory` capability; older servers keep their existing UI. There is no simultaneous message broadcasting between two independent agent processes.

## Windows download

The **Native chat fork (Windows)** GitHub Actions workflow builds an unsigned Windows x64 ZIP, available as the `orca-sky-windows` artifact after a successful run. Extract it and open `Orca.exe`. The package is named **Orca Sky**, uses a separate application profile, and points its updater at this fork. Your official Orca installation and its project setup stay in their own profile.

## Build locally

Use the Node, Bun and pnpm versions pinned by this repository. Windows also needs Visual Studio's C++ build tools and Windows SDK for Orca's patched native addons.

```sh
pnpm install --frozen-lockfile
pnpm -C mobile install --frozen-lockfile
pnpm tc
pnpm test src/main/native-chat/agent-session-wire/acquisition/structured-agent-session-history-refresh.test.ts --maxWorkers=2
pnpm build:release
pnpm exec electron-builder --config config/electron-builder.sky.cjs --win --publish never
```

Keep `ORCA_BACKGROUND_LAUNCH=1` for automated tests or launches. The ZIP is written to `dist-sky/orca-sky-windows-x64.zip`.
