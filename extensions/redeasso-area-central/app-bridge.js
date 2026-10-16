(() => {
  const ORIGIN = 'https://redeasso.assocom.workers.dev'
  if (location.origin !== ORIGIN || window !== window.top) return
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'TRANSFER_RESULT' || !['RECEIVED', 'TRANSFER_FAILED', 'VALIDATION_FAILED'].includes(message.code)) return
    window.postMessage({ source: 'redeasso-extension', type: 'TRANSFER_RESULT', code: message.code }, ORIGIN)
  })
  window.addEventListener('message', async event => {
    const input = event.data
    if (event.source !== window || event.origin !== ORIGIN || input?.source !== 'redeasso-web'
      || !['PING', 'START', 'CANCEL', 'FOCUS'].includes(input.type)
      || typeof input.id !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(input.id)) return
    let result
    try {
      result = await chrome.runtime.sendMessage({ type: input.type,
        ...(input.type === 'START' ? { grant: input.grant } : {}) })
    } catch { result = { ok: false, code: 'EXTENSION_RELOAD' } }
    // Somente flags de estado; nunca transportar cookies nesta ponte pública.
    window.postMessage({ source: 'redeasso-extension', id: input.id,
      ok: result?.ok === true, code: result?.code, version: result?.version }, ORIGIN)
  })
})()
