package br.com.redeasso.gestao.integracao.areacentral.api;

import br.com.redeasso.gestao.auth.api.dto.SessionResponse;
import br.com.redeasso.gestao.auth.application.AreaCentralAuthenticationService;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/auth/area-central/browser-transfers")
public class AreaCentralBrowserTransferController {
    private final AreaCentralBrowserTransferService transfers;
    private final AreaCentralAuthenticationService authentication;

    public AreaCentralBrowserTransferController(AreaCentralBrowserTransferService transfers, AreaCentralAuthenticationService authentication) {
        this.transfers = transfers;
        this.authentication = authentication;
    }

    @PostMapping
    public ResponseEntity<AreaCentralBrowserTransferService.Grant> start(HttpServletRequest request) {
        return ResponseEntity.status(201).body(transfers.start(request.getSession(true).getId()));
    }

    // Somente este POST usa a concessão aleatória de uso único em vez de cookie/CSRF.
    // Não autentica a requisição da extensão; a sessão original precisa concluir com CSRF.
    @PostMapping("/receive")
    public ResponseEntity<Void> receive(@Valid @RequestBody TransferRequest input) {
        transfers.receive(input.transferToken(), input.cookies().stream().map(CookieInput::toCookie).toList());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/current")
    public AreaCentralBrowserTransferService.State current(HttpServletRequest request) {
        return transfers.current(request.getSession(true).getId());
    }

    @DeleteMapping("/current")
    public ResponseEntity<Void> cancel(HttpServletRequest request) {
        transfers.cancel(request.getSession(true).getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/complete")
    public SessionResponse complete(HttpServletRequest request, HttpServletResponse response) {
        AreaCentralAuthenticatedLogin login = transfers.complete(request.getSession(true).getId());
        var identity = authentication.authenticateOrAttach(login.username(), login.cookieJar(), request, response);
        Object type = request.getSession().getAttribute("redeasso.auth.type");
        return new SessionResponse(true, identity.getName(), type instanceof String value ? value : "AREA_CENTRAL", true);
    }

    public record TransferRequest(@NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{43}") String transferToken,
                                  @NotNull @Size(min = 1, max = 6) List<@NotNull @Valid CookieInput> cookies) {
        @Override public String toString() { return "TransferRequest[redacted]"; }
    }
    public record CookieInput(@NotBlank @Size(max = 64) String name, @NotBlank @Size(max = 4096) String value,
                              @NotBlank @Size(max = 100) String domain, @NotBlank @Size(max = 100) String path,
                              boolean secure, boolean httpOnly, @Size(max = 20) String sameSite, Instant expiresAt) {
        AreaCentralCookie toCookie() { return new AreaCentralCookie(name, value, domain, path, secure, httpOnly, sameSite, expiresAt); }
        @Override public String toString() { return "CookieInput[redacted]"; }
    }
}
