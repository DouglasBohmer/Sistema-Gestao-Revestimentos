package br.com.redeasso.gestao.shared.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Limita a entrada pública da extensão antes da desserialização, inclusive em chunked. */
final class BrowserTransferBodyLimitFilter extends OncePerRequestFilter {
    private static final int LIMIT = 32 * 1024;
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !(request.getContextPath()
                + "/api/auth/area-central/browser-transfers/receive").equals(request.getRequestURI());
    }
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > LIMIT) { reject(response); return; }
        byte[] body = request.getInputStream().readNBytes(LIMIT + 1);
        try {
            if (body.length > LIMIT) { reject(response); return; }
            chain.doFilter(new HttpServletRequestWrapper(request) {
                @Override public ServletInputStream getInputStream() {
                    var input = new ByteArrayInputStream(body);
                    return new ServletInputStream() {
                        public int read() { return input.read(); }
                        public int read(byte[] bytes, int offset, int length) { return input.read(bytes, offset, length); }
                        public boolean isFinished() { return input.available() == 0; }
                        public boolean isReady() { return true; }
                        public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
                    };
                }
                @Override public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8)); }
            }, response);
        } finally { java.util.Arrays.fill(body, (byte) 0); }
    }
    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(413);
        response.setContentType("application/json");
        response.getWriter().write("{\"status\":413,\"code\":\"REQUEST_TOO_LARGE\",\"message\":\"Requisição excede o limite permitido\"}");
    }
}
