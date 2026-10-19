import * as React from "react"
import { cn } from "cn"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

/** The Markdown understood beyond the plain kind: tables, struck-out words and the like. */
const PLUGINS = [remarkGfm]

/**
 * How each kind of thing in an answer is drawn. Made once, out here: made again at each
 * drawing, each would be a new kind of thing to React, and every heading, list and line
 * of code in the conversation would be made over at every word that came in.
 */
const COMPONENTS: Components = {
  h1: (props) => (
    <h3 className="font-heading text-base font-semibold" {...props} />
  ),
  h2: (props) => (
    <h3 className="font-heading text-base font-semibold" {...props} />
  ),
  h3: (props) => <h4 className="font-medium" {...props} />,
  ul: (props) => (
    <ul className="flex list-disc flex-col gap-1 pl-5" {...props} />
  ),
  ol: (props) => (
    <ol className="flex list-decimal flex-col gap-1 pl-5" {...props} />
  ),
  a: (props) => (
    <a
      className="underline underline-offset-4"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="overflow-x-auto rounded-xl bg-muted p-3 font-mono text-xs leading-relaxed [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="rounded-md bg-muted px-1 py-0.5 font-mono text-[0.85em]"
      {...props}
    />
  ),
  table: (props) => (
    <div className="overflow-x-auto">
      <table
        className="w-full text-left text-sm [&_td]:border-t [&_td]:py-1.5 [&_td]:pr-3 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium"
        {...props}
      />
    </div>
  ),
  hr: () => <hr className="border-border" />,
}

/**
 * Claude's answers are Markdown. Raw HTML in them is shown as text, never run. Read
 * again only when the words change: the rest of a conversation is left alone as the
 * last of it comes in.
 */
export const Markdown = React.memo(function Markdown({
  children,
  className,
}: {
  children: string
  /** for where it is not an answer, and is set smaller or quieter than one */
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 text-sm leading-relaxed text-foreground/85 [&_li>p]:inline",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={PLUGINS} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  )
})
