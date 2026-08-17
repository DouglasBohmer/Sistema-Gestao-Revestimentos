# syntax=docker/dockerfile:1.7

# O frontend e o backend são compilados separadamente. A imagem final contém
# somente o JRE, o JAR Spring e os arquivos estáticos gerados pelo Vite.
FROM node:22-slim AS frontend-build

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY frontend-gestao-revestimento/package.json frontend-gestao-revestimento/tsconfig.json frontend-gestao-revestimento/tsconfig.base.json ./frontend-gestao-revestimento/
COPY frontend-gestao-revestimento/lib/api-client-react/package.json ./frontend-gestao-revestimento/lib/api-client-react/
COPY frontend-gestao-revestimento/lib/api-zod/package.json ./frontend-gestao-revestimento/lib/api-zod/

RUN --mount=type=cache,id=redeasso-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @workspace/redeasso...

COPY frontend-gestao-revestimento ./frontend-gestao-revestimento

RUN PORT=5000 BASE_PATH=/ pnpm --filter @workspace/redeasso run build


FROM eclipse-temurin:21-jdk-jammy AS backend-build

WORKDIR /workspace/backend-gestao-revestimento

COPY backend-gestao-revestimento/.mvn .mvn
COPY backend-gestao-revestimento/mvnw backend-gestao-revestimento/mvnw.cmd backend-gestao-revestimento/pom.xml ./

# O checkout pode ter sido feito no Windows (CRLF); normalize o wrapper para o
# shell Linux sem alterar a configuração local do desenvolvedor.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
RUN --mount=type=cache,id=redeasso-maven,target=/root/.m2 \
    ./mvnw -B -ntp dependency:go-offline

COPY backend-gestao-revestimento/src ./src
COPY --from=frontend-build /workspace/frontend-gestao-revestimento/dist/public ./src/main/resources/static

# Executa os testes unitários antes de produzir o artefato de produção.
RUN --mount=type=cache,id=redeasso-maven,target=/root/.m2 \
    ./mvnw -B -ntp package


FROM eclipse-temurin:21-jre-alpine AS runtime

RUN addgroup -S redeasso && adduser -S -G redeasso redeasso

WORKDIR /app

COPY --from=backend-build --chown=redeasso:redeasso \
    /workspace/backend-gestao-revestimento/target/*.jar /app/redeasso.jar

USER redeasso

EXPOSE 8080

ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["java", "-jar", "/app/redeasso.jar"]
