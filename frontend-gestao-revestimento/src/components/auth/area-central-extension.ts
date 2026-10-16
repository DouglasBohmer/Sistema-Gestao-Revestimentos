import type { AreaCentralBrowserGrant } from '@workspace/api-client-react'

export type ExtensionCommand = 'PING' | 'START' | 'CANCEL' | 'FOCUS'
export interface ExtensionReply { ok: boolean; code?: string; version?: number }

/** A ponte pública transporta apenas comandos/concessão curta. Nunca cookies ou senha. */
export function areaCentralExtension(
  type: ExtensionCommand, grant?: AreaCentralBrowserGrant,
): Promise<ExtensionReply> {
  return new Promise(resolve => {
    const id = crypto.randomUUID()
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin
        || event.data?.source !== 'redeasso-extension' || event.data?.id !== id) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', listener)
      resolve({ ok: event.data.ok === true, code: event.data.code, version: event.data.version })
    }
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', listener)
      resolve({ ok: false, code: 'NOT_INSTALLED' })
    }, type === 'START' ? 8_000 : 2_000)
    window.addEventListener('message', listener)
    window.postMessage({ source: 'redeasso-web', id, type, ...(grant ? { grant } : {}) }, window.location.origin)
  })
}
