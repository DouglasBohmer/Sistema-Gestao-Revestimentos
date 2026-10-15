function fillPortalLogin(credentials) {
  // Execute exclusivamente no documento real do portal. O Turnstile e seus
  // callbacks não são alterados: só o próprio portal pode liberar o botão.
  if (location.origin !== credentials.origin) return false;
  const form = document.querySelector('#form-login');
  const username = document.querySelector('#USR_APELIDO');
  const password = document.querySelector('#USR_SENHA');
  const button = document.querySelector('#btn-entrar');
  if (!form || !username || !password || !button) return false;

  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setValue.call(username, credentials.username);
  setValue.call(password, credentials.password);
  credentials.password = null;
  for (const field of [username, password]) {
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const deadline = Date.now() + 10 * 60 * 1000;
  const timer = setInterval(() => {
    if (Date.now() >= deadline || !form.isConnected || location.origin !== credentials.origin) {
      clearInterval(timer);
      return;
    }
    const token = document.querySelector('[name="cf-turnstile-response"]');
    const challengePresent = Boolean(document.querySelector('.cf-turnstile'));
    if (button.disabled || (challengePresent && (!token || !token.value))) return;
    clearInterval(timer);
    form.dataset.redeassoSubmitted = 'true';
    button.click();
  }, 250);
  return true;
}
