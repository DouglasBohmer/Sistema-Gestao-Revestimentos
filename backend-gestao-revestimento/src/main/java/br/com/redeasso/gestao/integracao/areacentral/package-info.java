/**
 * Fronteira da integração com a Área Central.
 *
 * <p>A implementação externa ficará atrás de portas de aplicação. Controllers e
 * módulos de domínio não podem manipular credenciais ou cookies diretamente. O
 * fluxo de login permanece bloqueado até a caracterização do CAPTCHA descrita no
 * AGENTS.md.</p>
 */
package br.com.redeasso.gestao.integracao.areacentral;
