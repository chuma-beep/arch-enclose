import type { Project } from "@shared/api"
import { Floating } from "@/components/floating"
import { ClaudeIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"

/**
 * At the foot of the view, for a folder the user opened that has settings for Claude
 * Code of its own: whether the agent is to go by them. Asked once. Until the user says
 * yes it goes by the user's own alone, the folder's being able to run commands with no
 * asking (hooks, servers of tools) and to say what the agent is let do.
 */
export function TrustSettings({ project }: { project: Project }) {
  if (!project.settingsToTrust) return null
  const say = (trusted: boolean) =>
    void window.cad.projects.trustSettings(project.id, trusted)
  return (
    <Floating
      role="status"
      className="pointer-events-auto flex items-center gap-2.5 py-1.5 pr-1.5 pl-4"
    >
      <ClaudeIcon className="size-4 shrink-0" />
      <span
        className="mr-1 truncate"
        title="Its .claude settings can run commands without asking. Until you trust them, Claude Code goes by your own settings alone."
      >
        This folder has Claude Code settings of its own
      </span>
      {/* as a newer agent is offered: leaving them out first, trusting them last */}
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full px-3.5"
          onClick={() => say(false)}
        >
          Ignore them
        </Button>
        <Button
          size="sm"
          className="rounded-full px-3.5"
          onClick={() => say(true)}
        >
          Trust this folder's settings
        </Button>
      </div>
    </Floating>
  )
}
