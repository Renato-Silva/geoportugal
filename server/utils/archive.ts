/**
 * Read-through cache over the "archive" storage mount.
 * Concurrent requests for the same key share one upstream fetch.
 */
const inflight = new Map<string, Promise<Buffer>>()

export function archived(key: string, produce: () => Promise<Buffer>): Promise<Buffer> {
  const pending = inflight.get(key)
  if (pending) return pending
  const task = (async () => {
    const storage = useStorage('archive')
    try {
      const hit = await storage.getItemRaw<Buffer | Uint8Array>(key)
      if (hit) return Buffer.from(hit)
    }
    catch (e) {
      console.warn(`[archive] read failed for ${key}:`, (e as Error).message)
    }
    const fresh = await produce()
    storage.setItemRaw(key, fresh).catch(e => console.warn(`[archive] write failed for ${key}:`, e.message))
    return fresh
  })().finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}

/** Storage keys use ":" as separator; keep ids readable but safe. */
export const keyPart = (s: string) => s.replace(/[^\w.-]+/g, '~')
