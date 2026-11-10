import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { NativeChatToolOutput } from './NativeChatToolOutput'
import { NativeChatDiffCard } from '../diffs/NativeChatDiffCard'
import { editFilesFromPatchText } from '../../../../../../shared/native-chat/tools/native-chat-edit-patch-files'

const patch = `diff --git a/client/config.lua b/client/config.lua
--- a/client/config.lua
+++ b/client/config.lua
@@ -1,4 +1,5 @@
 local function settings()
-    return { enabled = false, interval = 0 }
+    local interval = 500
+    return { enabled = true, interval = interval }
 end
diff --git a/src/settings.ts b/src/settings.ts
--- a/src/settings.ts
+++ b/src/settings.ts
@@ -1,2 +1,2 @@
-export const enabled = false
+export const enabled = true
 export const label = 'Demo'
`

export const patchOutput = defineFixture({
  width: 760,
  render: () => <NativeChatToolOutput body={{ type: 'tool-result', output: patch }} />,
  interact: settleSyntax
})

export const editCards = defineFixture({
  width: 760,
  render: () => (
    <div>
      {editFilesFromPatchText(patch, null)?.map((file) => (
        <NativeChatDiffCard key={file.path} file={file} initialOpen />
      ))}
    </div>
  ),
  interact: settleSyntax
})

async function settleSyntax(frame: HTMLElement): Promise<void> {
  const ready = () => {
    const colored = [...frame.querySelectorAll<HTMLElement>('span[style*="--syntax"]')]
    return (
      colored.some((span) => span.textContent?.includes('local')) &&
      colored.some((span) => span.textContent?.includes('export'))
    )
  }
  if (ready()) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (ready()) {
        observer.disconnect()
        clearTimeout(timeout)
        resolve()
      }
    })
    const timeout = setTimeout(() => {
      observer.disconnect()
      reject(new Error('Syntax colors did not finish loading'))
    }, 10000)
    observer.observe(frame, { subtree: true, childList: true })
  })
}
