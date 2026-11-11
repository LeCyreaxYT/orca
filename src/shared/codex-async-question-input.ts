import type { AskPrompt, AskQuestion } from './native-chat/input/native-chat-ask-types'

/** Return accepted immediately; nonblocking questions receive answers in later user messages ({questions:[{title, options?: string[]}]}). */
export const CODEX_ASYNC_QUESTION_TOOL = 'request_user_input_async'

export function parseCodexAsyncQuestionReply(
  text: string
): { callId: string; questionIndex: number }[] | null {
  const match =
    /^\s*<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>\s*$/.exec(
      text
    )
  if (!match) {
    return null
  }
  try {
    const replies: unknown = JSON.parse(match[1]!)
    if (!Array.isArray(replies)) {
      return null
    }
    return replies.flatMap((reply) => {
      if (!reply || typeof reply.questionItemId !== 'string' || typeof reply.answer !== 'string') {
        return []
      }
      let id: unknown
      try {
        id = JSON.parse(reply.questionItemId)
      } catch {
        return []
      }
      return Array.isArray(id) &&
        id[0] === CODEX_ASYNC_QUESTION_TOOL &&
        typeof id[1] === 'string' &&
        typeof id[2] === 'number' &&
        Number.isSafeInteger(id[2]) &&
        id[2] >= 0
        ? [{ callId: id[1], questionIndex: id[2] }]
        : []
    })
  } catch {
    return null
  }
}

export function parseCodexAsyncQuestionsInput(input: unknown): AskPrompt | null {
  if (!input || typeof input !== 'object' || !('questions' in input)) {
    return null
  }
  const rawQuestions = Array.isArray(input.questions) ? input.questions : []
  const questions: AskQuestion[] = []
  for (const raw of rawQuestions) {
    if (raw && typeof raw === 'object' && 'title' in raw && typeof raw.title === 'string') {
      const options: unknown[] = 'options' in raw && Array.isArray(raw.options) ? raw.options : []
      questions.push({
        question: raw.title,
        multiSelect: false,
        options: options.flatMap((label) => (typeof label === 'string' ? [{ label }] : []))
      })
    }
  }
  return questions.length > 0 ? { questions, replyAsMessage: true } : null
}

/** Codex's default `chat.skip_question` key (Ctrl+]) as legacy, kitty and modifyOtherKeys bytes;
 *  a remapped key is not seen. */
const CODEX_SKIP_QUESTION_INPUTS: ReadonlySet<string> = new Set([
  '\x1d',
  '\x1b[93;5u',
  '\x1b[93;5:1u',
  '\x1b[27;5;93~'
])

export function isCodexSkipQuestionInput(data: string): boolean {
  return CODEX_SKIP_QUESTION_INPUTS.has(data)
}
