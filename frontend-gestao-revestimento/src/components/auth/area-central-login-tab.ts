export interface AreaCentralLoginTab {
  isOpen(): boolean
  focus(): void
  navigate(interactiveUrl: string): boolean
  showError(message: string): void
  close(): void
}

/** Deve ser chamado no clique, antes de qualquer await, para evitar bloqueio de pop-up. */
export function openAreaCentralLoginTab(
  openWindow: () => Window | null = () => window.open('about:blank', '_blank'),
): AreaCentralLoginTab | null {
  let tab: Window | null = null
  try {
    tab = openWindow()
    if (!tab) return null
    // Mantém o handle somente no RedeASSO; a guia externa não controla a origem.
    tab.opener = null
    const openedTab = tab
    const document = openedTab.document
    document.documentElement.lang = 'pt-BR'
    document.title = 'Login da Área Central — RedeASSO'
    const referrer = document.createElement('meta')
    referrer.name = 'referrer'
    referrer.content = 'no-referrer'
    const viewport = document.createElement('meta')
    viewport.name = 'viewport'
    viewport.content = 'width=device-width, initial-scale=1'
    document.head.append(referrer, viewport)
    document.body.style.cssText = 'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f4f5;color:#18181b;font:16px/1.6 system-ui,sans-serif'
    const card = document.createElement('main')
    card.style.cssText = 'max-width:560px;margin:24px;padding:32px;background:white;border-radius:16px;box-shadow:0 8px 30px #0001'
    const heading = document.createElement('h1')
    heading.style.cssText = 'font-size:22px;margin:0 0 16px'
    heading.textContent = 'Abrindo o login da Área Central...'
    const message = document.createElement('p')
    message.setAttribute('role', 'status')
    message.textContent = 'Preparando a sessão protegida. Esta guia será atualizada assim que o navegador estiver disponível.'
    const instructions = document.createElement('p')
    instructions.style.cssText = 'font-size:14px;color:#52525b'
    instructions.textContent = 'Após a verificação, volte à guia do RedeASSO e clique em “Concluir e entrar”. Não é necessário copiar cookies ou senhas.'
    card.append(heading, message, instructions)
    document.body.replaceChildren(card)
    let navigated = false

    const isOpen = () => {
      try { return !openedTab.closed } catch { return false }
    }
    return {
      isOpen,
      focus() { try { openedTab.focus() } catch { /* Pode ter sido fechada. */ } },
      navigate(interactiveUrl) {
        try {
          const url = new URL(interactiveUrl)
          const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
          if (!isOpen() || (url.protocol !== 'https:' && !localHttp) || url.username || url.password) return false
          openedTab.location.replace(url.href)
          navigated = true
          return true
        } catch { return false }
      },
      showError(error) {
        // Não acessa o DOM da página externa após a navegação.
        if (navigated || !isOpen()) return
        document.title = 'Falha no login da Área Central — RedeASSO'
        heading.textContent = 'Não foi possível abrir o login da Área Central'
        message.setAttribute('role', 'alert')
        message.textContent = error
        instructions.textContent = 'Volte à guia do RedeASSO para tentar novamente. Esta guia não recebeu uma sessão do navegador remoto.'
      },
      close() { try { openedTab.close() } catch { /* O prazo da sessão continua válido no backend. */ } },
    }
  } catch {
    try { tab?.close() } catch { /* Sem uma guia utilizável, não iniciar o login. */ }
    return null
  }
}
