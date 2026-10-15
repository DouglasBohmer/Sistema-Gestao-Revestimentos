/**
 * Fronteira da integração com a Área Central.
 *
 * <p>A implementação externa ficará atrás de portas de aplicação. Controllers e
 * módulos de domínio não podem manipular credenciais ou cookies diretamente.
 * Credenciais são transitórias; o portal valida o Turnstile, com intervenção
 * humana quando solicitada. Nunca automatizar desafios.</p>
 */
package br.com.redeasso.gestao.integracao.areacentral;
