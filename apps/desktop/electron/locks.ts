// One thing at a time in a project's folder, whatever it is: the folder put as another
// conversation has it (versions.ts), a turn's change taken back or put back, the folder
// put aside before a turn and gone through after it (changes.ts), what it holds
// committed (backups.ts). Each waits for what was asked of the folder before it, in the
// order it was asked, so that none of them finds the folder half way through another:
// a commit of one conversation's files taken as the folder becomes another's, say.
// Projects do not wait on each other.

export class Locks {
  private queues = new Map<string, Promise<unknown>>()

  /**
   * Do something in a project's folder once what was asked of it before is done, or
   * has failed. Resolves, or rejects, as it does. Nothing done this way may wait on
   * something else done this way in the same project: it would wait for good.
   */
  hold<T>(id: string, work: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(id) ?? Promise.resolve()).then(work, work)
    const over = next.then(
      () => {},
      () => {}
    )
    this.queues.set(id, over)
    void over.then(() => {
      if (this.queues.get(id) === over) this.queues.delete(id)
    })
    return next
  }
}
