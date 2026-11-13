'use client'

import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const plugins = [remarkGfm]

export const AiMarkdown = memo(function AiMarkdown({ text }: { text: string }) {
  return <div className="ai-markdown"><Markdown remarkPlugins={plugins} skipHtml
    components={{
      // A summary never needs to fetch remote media or embed arbitrary HTML.
      img: ({ alt }) => <span>{alt}</span>,
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    }}>{text}</Markdown></div>
})
