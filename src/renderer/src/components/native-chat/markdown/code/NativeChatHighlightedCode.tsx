import { memo } from 'react'
import { useHighlightedSyntax } from '@/hooks/use-highlighted-syntax'
import type { SyntaxLine } from '@/lib/syntax-highlighting/incremental-syntax-tokenizer'
import { SYNTAX_FONT_STYLE, type SyntaxToken } from '@/lib/syntax-highlighting/syntax-highlighter'

type TokenStyle = React.CSSProperties & Record<`--syntax-${string}`, string | undefined>

// Both themes ride on the token so a scheme change needs no re-tokenizing.
const COLORED_TOKEN_CLASS = 'text-(color:--syntax-light) dark:text-(color:--syntax-dark)'
const FORMATTED_TOKEN_CLASS =
  'text-(color:--syntax-light) dark:text-(color:--syntax-dark) [font-style:var(--syntax-light-font-style)] dark:[font-style:var(--syntax-dark-font-style)] [font-weight:var(--syntax-light-font-weight)] dark:[font-weight:var(--syntax-dark-font-weight)] [text-decoration-line:var(--syntax-light-decoration)] dark:[text-decoration-line:var(--syntax-dark-decoration)]'

function formatting(theme: 'light' | 'dark', fontStyle: number): TokenStyle {
  const decorations = [
    fontStyle & SYNTAX_FONT_STYLE.underline ? 'underline' : '',
    fontStyle & SYNTAX_FONT_STYLE.strikethrough ? 'line-through' : ''
  ].filter(Boolean)
  return {
    [`--syntax-${theme}-font-style`]: fontStyle & SYNTAX_FONT_STYLE.italic ? 'italic' : 'normal',
    [`--syntax-${theme}-font-weight`]: fontStyle & SYNTAX_FONT_STYLE.bold ? 'bold' : 'normal',
    [`--syntax-${theme}-decoration`]: decorations.join(' ') || 'none'
  }
}

function tokenStyle(token: SyntaxToken, diff: boolean): TokenStyle {
  const colors: TokenStyle = {
    '--syntax-light':
      diff && token.light
        ? `color-mix(in srgb, ${token.light} 82%, var(--chat-foreground-strong))`
        : token.light,
    '--syntax-dark': token.dark
  }
  return token.lightFontStyle || token.darkFontStyle
    ? {
        ...colors,
        ...formatting('light', token.lightFontStyle),
        ...formatting('dark', token.darkFontStyle)
      }
    : colors
}

export const NativeChatHighlightedLine = memo(function NativeChatHighlightedLine({
  line,
  includeEnding = true,
  diff = false
}: {
  line: SyntaxLine
  includeEnding?: boolean
  diff?: boolean
}) {
  return (
    <>
      {line.tokens.map((token) =>
        token.content.trim() &&
        (token.light || token.dark || token.lightFontStyle || token.darkFontStyle) ? (
          <span
            key={token.offset}
            className={
              token.lightFontStyle || token.darkFontStyle
                ? FORMATTED_TOKEN_CLASS
                : COLORED_TOKEN_CLASS
            }
            style={tokenStyle(token, diff)}
          >
            {token.content}
          </span>
        ) : (
          token.content
        )
      )}
      {includeEnding ? line.ending : null}
    </>
  )
})

/** Colors `code` in place; its text is unchanged, so layout and copy match the plain fallback. */
export const NativeChatHighlightedCode = memo(function NativeChatHighlightedCode({
  code,
  language
}: {
  code: string
  language: string
}): React.ReactNode {
  const progress = useHighlightedSyntax(code, language)
  if (!progress) {
    return code
  }
  return (
    <>
      {progress.lines.map((line) => (
        <NativeChatHighlightedLine key={line.start} line={line} />
      ))}
      {code.slice(progress.highlightedLength)}
    </>
  )
})
