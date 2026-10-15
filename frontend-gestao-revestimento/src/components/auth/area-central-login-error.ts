const KNOWN_API_ERRORS = new Set([
  'AREA_CENTRAL_UNAVAILABLE',
  'AREA_CENTRAL_LOGIN_BUSY',
  'AREA_CENTRAL_LOGIN_INCOMPLETE',
  'AREA_CENTRAL_LOGIN_NOT_FOUND',
  'INVALID_CREDENTIALS',
  'ACCESS_DENIED',
  'VALIDATION_ERROR',
])

/** Exibe apenas mensagens conhecidas da API, nunca o HTML bruto de um proxy. */
export function areaCentralLoginError(status: number, data: unknown): string {
  if (data && typeof data === 'object') {
    const { code, message } = data as { code?: unknown; message?: unknown }
    if (typeof code === 'string' && KNOWN_API_ERRORS.has(code)
      && typeof message === 'string' && message.length <= 400
      && message.trim() && !/[<>]/.test(message)) {
      return `HTTP ${status}: ${message}`
    }
  }

  if ([502, 503, 504].includes(status)) {
    return `HTTP ${status}: A comunicação com o serviço de login falhou. Não foi possível abrir ou consultar o navegador da Área Central.`
  }
  if (status === 401) return 'HTTP 401: Usuário ou senha inválidos.'
  if (status === 403) return 'HTTP 403: A sessão de segurança expirou. Feche esta janela, atualize a página e tente novamente.'
  if (status === 404) return 'HTTP 404: A tentativa de login não está mais disponível. Feche esta janela e inicie outra tentativa.'
  return `HTTP ${status}: Não foi possível concluir a operação de login da Área Central.`
}
