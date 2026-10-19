// A file the window asks for by one of the app's own addresses (a model's parts, a
// scene's, a picture), as it is answered: read from the disk as it is sent, and not
// held whole in memory first, with what it is and how big. And with a mark of how it
// stands, its size and when it was written: asked for with the mark it had last time,
// it is answered with that and nothing more, where the file stands the same.
//
// Nothing is kept of what is sent, even so: a part's file can be written again with
// nothing else of the model's changing, and what the window asks for by the same
// address is to be the file as it is now.
import fs from "node:fs"
import { Readable } from "node:stream"

/** The mark of how a file stands: its size and when it was written, as an ETag says it. */
export const markOf = (stat: { size: number; mtimeMs: number }) =>
  `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs * 1000).toString(36)}"`

/**
 * Answer the asking for a file, which is to be there and be a file: 404 otherwise.
 * `type` is what it is, as a content type says it.
 */
export async function serveFile(
  file: string,
  request: Request,
  type: string
): Promise<Response> {
  // (opened first, and gone by from then on: what is said of it is of what is sent)
  let handle: fs.promises.FileHandle
  let stat: fs.Stats
  try {
    handle = await fs.promises.open(file, "r")
  } catch {
    return new Response(null, { status: 404 })
  }
  try {
    stat = await handle.stat()
  } catch {
    await handle.close()
    return new Response(null, { status: 404 })
  }
  if (!stat.isFile()) {
    await handle.close()
    return new Response(null, { status: 404 })
  }
  const mark = markOf(stat)
  const headers = {
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    etag: mark,
    "last-modified": stat.mtime.toUTCString(),
  }
  const marked = request.headers.get("if-none-match")
  if (
    marked !== null &&
    marked.split(",").some((one) => one.trim().replace(/^W\//, "") === mark)
  ) {
    await handle.close()
    return new Response(null, { status: 304, headers })
  }
  // (closed once it has all been read, or the asking is given up)
  const read = fs.createReadStream("", { fd: handle })
  return new Response(Readable.toWeb(read) as ReadableStream<Uint8Array>, {
    headers: { ...headers, "content-type": type },
  })
}
