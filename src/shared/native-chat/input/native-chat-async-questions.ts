import { parseCodexAsyncQuestionReply } from '../../codex-async-question-input'
import type { NativeChatMessage } from '../native-chat-types'
import type { AsyncQuestionContributor } from './native-chat-ask'
import type { AskPrompt, AskQuestion } from './native-chat-ask-types'
import { quotedByQueuedAnswer } from './native-chat-ask-answer'

export function asyncQuestionOccurrenceId(
  sourceScope: string,
  contributor: AsyncQuestionContributor
): string {
  return JSON.stringify([
    'async-question',
    sourceScope,
    contributor.sourceRowId,
    contributor.callSlot
  ])
}

export function aggregateAsyncQuestions(
  contributors: readonly AsyncQuestionContributor[],
  sourceScope?: string,
  hiddenIds?: ReadonlySet<string>,
  queuedTexts: readonly string[] = []
): AskPrompt | null {
  const questions: AskQuestion[] = []
  const occurrenceIds: string[] = []
  for (const contributor of contributors) {
    const id =
      sourceScope === undefined ? undefined : asyncQuestionOccurrenceId(sourceScope, contributor)
    if (id !== undefined && hiddenIds?.has(id)) {
      continue
    }
    if (contributor.questions.some((question) => quotedByQueuedAnswer(question, queuedTexts))) {
      continue
    }
    if (id !== undefined) {
      occurrenceIds.push(id)
    }
    questions.push(...contributor.questions)
  }
  return questions.length > 0
    ? { questions, replyAsMessage: true, ...(sourceScope === undefined ? {} : { occurrenceIds }) }
    : null
}

/** Correlation also repairs histories where an older importer placed replies before questions. */
export function createAsyncQuestionReplies() {
  const answered = new Map<string, Set<number>>()
  return {
    record(message: NativeChatMessage): boolean {
      const text = message.blocks
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
      const replies = parseCodexAsyncQuestionReply(text)
      if (replies === null) {
        return false
      }
      for (const { callId, questionIndex } of replies) {
        const indices = answered.get(callId) ?? new Set<number>()
        indices.add(questionIndex)
        answered.set(callId, indices)
      }
      return true
    },
    remaining(contributor: AsyncQuestionContributor): AsyncQuestionContributor {
      const replies = contributor.callId ? answered.get(contributor.callId) : undefined
      if (!replies) {
        return contributor
      }
      const indices = contributor.questionIndices ?? contributor.questions.map((_, index) => index)
      return {
        ...contributor,
        questions: contributor.questions.filter((_, index) => !replies.has(indices[index]!)),
        questionIndices: indices.filter((index) => !replies.has(index))
      }
    }
  }
}
