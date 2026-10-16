(() => {
  if (location.origin !== 'https://redeasso.areacentral.com.br' || window !== window.top) return
  let checking = false
  let missing = 0
  const timer = setInterval(async () => {
    // Não esperar o download das centenas de fotos do catálogo.
    if (document.readyState === 'loading' || checking) return
    checking = true
    const form = document.querySelector('#form-login, input[type="password"]')
    const authenticated = !form && Boolean(document.querySelector('.product-name'))
      && Boolean(document.querySelector('select[name="filtro[]"] option[value="PF.REFERENCIA"]'))
    try {
      const state = await chrome.runtime.sendMessage({ type: 'PORTAL_STATE', authenticated })
      // A criação da guia e o armazenamento do pareamento são assíncronos.
      if (!state?.ok && ++missing < 5) return
      if (state?.pending) return
      const loginForm = document.querySelector('#form-login')
      const username = document.querySelector('#USR_APELIDO')
      const password = document.querySelector('#USR_SENHA')
      const submit = document.querySelector('#btn-entrar')
      const turnstile = document.querySelector('[name="cf-turnstile-response"]')
      // O Chrome preencheu os dois campos; não acessar seus valores. Só submeter
      // depois da aprovação genuína do portal, uma vez por concessão.
      if (state?.ok && !authenticated && loginForm && submit && !submit.disabled
        && username?.matches(':autofill') && password?.matches(':autofill')
        && turnstile?.value && loginForm.checkValidity()) {
        const permission = await chrome.runtime.sendMessage({ type: 'CLAIM_SUBMIT' })
        if (permission?.allowSubmit) submit.click()
      }
      if (!state?.ok || authenticated) {
        clearInterval(timer)
        if (authenticated && state?.ok) {
          const notice = document.createElement('aside')
          notice.textContent = 'Sessão enviada ao RedeASSO. Volte à guia do sistema e clique em “Concluir e entrar”.'
          notice.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;z-index:2147483647;background:#18181b;color:white;padding:16px;border-radius:12px;font:15px system-ui;box-shadow:0 4px 20px #0004'
          document.body.append(notice)
        }
      }
      // Não lê usuário/senha, não altera Turnstile nem clica em desafios.
      // Sem autofill, o usuário preenche e confirma “Entrar” no próprio portal.
    } catch { clearInterval(timer) }
    finally { checking = false }
  }, 1_000)
  setTimeout(() => clearInterval(timer), 10 * 60_000)
})()
