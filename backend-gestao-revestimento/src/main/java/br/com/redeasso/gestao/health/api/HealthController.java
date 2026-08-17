package br.com.redeasso.gestao.health.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/healthz")
    public ResponseEntity<HealthResponse> health() {
        return ResponseEntity.ok(new HealthResponse("ok"));
    }
}
