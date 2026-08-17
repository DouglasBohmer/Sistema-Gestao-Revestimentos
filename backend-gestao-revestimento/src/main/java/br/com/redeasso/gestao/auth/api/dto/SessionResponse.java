package br.com.redeasso.gestao.auth.api.dto;

public record SessionResponse(
        boolean authenticated,
        String username,
        String authType,
        boolean areaCentralConnected) {

    public static SessionResponse anonymous() {
        return new SessionResponse(false, null, null, false);
    }

    public static SessionResponse local(String username) {
        return new SessionResponse(true, username, "LOCAL", false);
    }
}
