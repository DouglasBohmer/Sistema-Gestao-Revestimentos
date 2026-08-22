# AGENTS.md — RedeASSO

Este arquivo registra decisões, regras de trabalho, fatos conhecidos e dúvidas em aberto do projeto. Ele se aplica a todo o repositório `Sistema-Gestao-Revestimentos`.

## 1. Autoridade e fontes

Em caso de conflito, use esta ordem:

1. Instrução mais recente e explícita do usuário.
2. Decisões confirmadas neste `AGENTS.md`.
3. Código e contratos do repositório web atual.
4. Regras observadas no projeto legado `CalculaPiso`, depois de validadas com o usuário.
5. Relatório acadêmico do semestre anterior, como visão de produto e histórico.

Regras de interpretação:

- O relatório descreve majoritariamente um protótipo de alta fidelidade feito no Figma Make, não comprova uma implementação funcional.
- O `CalculaPiso` é uma fonte de regras, dados e fluxo operacional. Ele não é um modelo de arquitetura nem deve ser copiado literalmente.
- O `CalculaPiso` é informado como sistema de uso interno da empresa.
- Questões históricas de credenciais/sessões do legado foram encerradas pelo usuário e não devem ser reabertas como pendência sem solicitação explícita.
- Comportamentos do legado que pareçam bugs, estejam incompletos ou conflitem com o relatório devem virar dúvida ou teste de caracterização antes da migração.
- O Express foi removido em 15/08/2026. Não reintroduza servidor Node, estado em memória ou rotas paralelas; todo backend de negócio pertence ao Spring/PostgreSQL.
- Dúvidas marcadas como abertas não podem ser resolvidas por suposição quando alterarem regra de negócio, segurança, persistência ou topologia de produção.
- Ao receber uma nova decisão do usuário, atualize este arquivo no mesmo trabalho, movendo a questão correspondente para “Decisões confirmadas”.

Fontes analisadas em 14/08/2026:

- Repositório web: `Sistema-Gestao-Revestimentos`, `HEAD ed6dd1b`.
- Repositório legado: `CalculaPiso`, `HEAD cbf9908`.
- Documento: `Relatorio_PAC_Fina SEMESTRE ANTERIOR.docx`.
- Memória existente: `.agents/memory/redeasso-infra.md`.

Os hashes acima são apenas o marco da análise e ficarão desatualizados após novos commits.

## 2. Objetivo do produto

O RedeASSO será a reconstrução web, organizada e sustentável do sistema desktop `CalculaPiso`. O produto atende principalmente vendedores e gestores de uma loja de materiais de construção e deve:

- centralizar o catálogo técnico de pisos e revestimentos;
- pesquisar produtos por nome, código da Área Central/ASSO ou código interno/CTC;
- calcular caixas, metragem efetivamente vendida e materiais auxiliares;
- consultar em tempo real preço, estoque, status e dados do produto na Área Central;
- manter mapas físicos de localização do estoque;
- apoiar orçamento, PDF, WhatsApp, impressão de etiquetas, histórico e dashboard;
- funcionar em navegadores modernos e suportar múltiplos usuários.

O domínio desta versão é piso/revestimento. Cálculos de tijolo, telha, ferro e forro, além de PDV e gestão financeira, estão fora do escopo. Do legado, a impressão de etiquetas faz parte da reconstrução web; impressão de cupom Elgin não foi incluída.

## 3. Decisões confirmadas

### 3.1 Stack e responsabilidades

- O backend definitivo será Java com Spring Boot e Java 21 ou superior suportado.
- O frontend continuará web em React + Vite.
- CRUD, autenticação, autorização, regras de cálculo, mapas, orçamentos, persistência, auditoria e integração externa devem ficar no backend Spring.
- O frontend é responsável por apresentação e interação. Ele não deve conter credenciais, cookies externos, regras canônicas de preço/cálculo nem autorização confiável.
- A API continuará sob `/api`; o OpenAPI deve ser a fonte do contrato e os clientes TypeScript gerados devem acompanhar qualquer mudança.

### 3.2 Autenticação e Área Central

Existirão dois caminhos de entrada no sistema:

1. `admin/admin`, provisório e voltado ao desenvolvimento/teste local.
2. Qualquer usuário e senha válidos da Área Central.

Regras obrigatórias:

- `admin/admin` serve apenas para entrar e testar o RedeASSO. Ele não concede, por si só, acesso aos dados da Área Central.
- Para uma consulta externa após entrar como `admin/admin`, deve existir uma sessão externa válida vinculada; a experiência exata ainda será definida.
- Qualquer conta válida da Área Central deve poder criar sua própria sessão externa.
- A Área Central não oferece API oficial para este uso. A integração deverá reproduzir o fluxo autorizado da tela de login e as requisições do catálogo.
- O CAPTCHA aparece em todos os logins e, no fluxo atualmente observado, basta selecionar a caixa “Sou humano”; não há desafio de imagens. A solução não deve tentar automatizar ou contornar essa confirmação humana.
- O RedeASSO coleta usuário e senha da Área Central somente para uma tentativa de login e os envia por HTTPS ao Spring, que preenche o Chrome isolado. A senha é efêmera: não pode ser persistida, devolvida em JSON, registrada em log, trace, auditoria, `localStorage` ou `sessionStorage`; deve ser descartada após o preenchimento do navegador.
- O CAPTCHA nunca será clicado, resolvido ou contornado por automação. O Chromium isolado é exibido por noVNC dentro de um modal do próprio RedeASSO, sem abrir nova guia; a pessoa confirma manualmente a caixa “Sou humano” na página real da Área Central.
- O noVNC local continua restrito ao gateway publicado localmente. Em produção, Chrome/Selenium/noVNC rodam em serviço Render dedicado: WebDriver e noVNC não são publicados diretamente; o Spring usa uma chave interna e o modal recebe apenas token HMAC temporário, revogado no cancelamento/conclusão e limitado à tentativa atual.
- Depois do login externo, o backend guarda o cookie jar da Área Central e o associa à sessão do usuário do RedeASSO.
- Cookies da Área Central, incluindo `PHPSESSID`, jamais podem ser devolvidos ao navegador, incluídos em JSON, expostos em erros ou gravados em logs.
- A Área Central entrega `PHPSESSID` também a visitantes anônimos; sua mera presença não prova autenticação. A conclusão do login assistido deve exigir cookie e ausência do formulário de senha no navegador remoto. A primeira consulta autorizada ao catálogo continuará sendo a validação definitiva da sessão.
- O navegador recebe apenas uma sessão própria do RedeASSO, preferencialmente em cookie `HttpOnly`, `Secure` e `SameSite`, com proteção CSRF adequada.
- As sessões externas devem ser isoladas por usuário/sessão. É proibido restaurar o arquivo global e compartilhado de cookies do legado.
- Logout, expiração ou revogação devem eliminar o cookie jar correspondente.
- Consultas de produto/estoque devem ocorrer no backend e usar a sessão externa correta em tempo real.
- Operacionalmente, a sessão externa é renovada após reiniciar o PC e costuma permanecer utilizável durante todo o expediente. O sistema deve esperar um novo login após reinício/expiração, sem depender de cookies permanentes.

### 3.3 Infraestrutura

- Hoje a aplicação é executada localmente por Docker e isso deve continuar disponível como fallback.
- A produção usará Neon como PostgreSQL principal, Render como hospedagem do Spring Boot e Cloudflare Workers para a SPA React e proxy de `/api`.
- O servidor Docker/Tailscale deixa de ser dependência de produção e permanece apenas como fallback local ou ambiente de desenvolvimento.
- O navegador acessa um único domínio Cloudflare. O Worker entrega os assets e encaminha `/api/*` ao Render, preservando sessão e CSRF no mesmo domínio sem CORS permissivo ou cookie de terceiros.
- O serviço Render receberá deploy automático da `main` após os checks do GitHub; o Cloudflare Workers Builds receberá deploy da `main` diretamente da integração Git.
- Branches fora da `main` devem passar na validação da imagem Docker local. Previews Cloudflare somente podem apontar para uma API Render de homologação e banco Neon isolado, nunca para os dados de produção.
- Dados persistentes nunca podem depender do filesystem efêmero do container. Banco, uploads e artefatos necessários precisam de volumes e backup.
- O ambiente local não pode virar uma segunda fonte de verdade gravável sem uma estratégia explícita de replicação/failover.

### 3.4 Banco e dados

- O banco definitivo será PostgreSQL.
- Neon será a fonte de verdade PostgreSQL de produção. A primeira instância Spring/Flyway usa a conexão direta Neon com SSL; avaliar o pooler somente após caracterizar migrations e multi-instância.
- Há um PostgreSQL 17 de desenvolvimento no `docker-compose.yml`, com volume local. Ele não pode se tornar uma fonte concorrente de dados de produção.
- Os dados atuais do sistema anterior estão em MySQL/MariaDB via XAMPP e serão exportados/migrados para PostgreSQL.
- O fallback local deve acessar o Neon de forma controlada ou restaurar backup; não pode gravar independentemente em banco divergente.

### 3.5 Parâmetros de negócio

- O preço retornado pela Área Central é sempre preço por m².
- A fórmula de preço permanece `bruto * 1,90 * 0,88`, equivalendo aos padrões de 90% de lucro e 12% de desconto.
- O resultado dessa fórmula também é preço por m²; o total do piso deve usar `m2_vendido * preco_por_m2`, e não `quantidade_de_caixas * preco`.
- Argamassa mantém como padrão 20 kg para cada 3 m².
- Rejunte mantém como padrões profundidade 9, coeficiente 1,8 e embalagem de 1 kg.
- Esses valores não serão constantes fixas no código. Serão configurações persistidas do sistema, editáveis pela área “Configurações” já prevista no menu.
- Mudanças de parâmetro devem ser validadas e auditáveis; cálculos históricos devem guardar os parâmetros efetivamente usados.

### 3.6 Mapa de estoque

- Uma posição do mapa aceita de um a quatro pisos.
- O estado atual impede repetir o mesmo piso dentro da mesma posição; manter essa regra até o usuário decidir diferente.
- A ordem dos até quatro pisos na posição deve ser preservada.
- Mapa, posições, rótulos e quantidades estão persistidos transacionalmente no PostgreSQL; a FK de piso usa `ON DELETE RESTRICT` e a API responde 409 quando um piso em uso é excluído.

## 4. Estado atual do repositório web

Retrato confirmado após a conclusão da migração em 15/08/2026:

- O Node/Express foi removido. O runtime de negócio é 100% Spring Boot. Em Docker local, o Spring ainda pode servir o bundle React; em produção, o React fica no Cloudflare Workers e o Spring Render expõe somente a API.
- CRUD/busca de pisos, cálculo, dashboard/atividades e mapas estão implementados no Spring e persistidos no PostgreSQL por JPA/Flyway.
- As migrations V1–V4 criam Spring Session, parâmetros-base, pisos/atividades e mapas/células. Dois pisos demonstrativos são carga inicial de V3; dados novos sobrevivem a restart do container.
- O mapa aceita de um a quatro pisos únicos e ordenados por posição, valida dimensões/posições/quantidades e calcula m²/caixas no backend.
- O acesso temporário `admin/admin` agora cria uma sessão real no Spring, com cookie HttpOnly, CSRF e Spring Session JDBC. O booleano falso de `sessionStorage` foi removido.
- O backend está organizado sob `br.com.redeasso.gestao`, por domínio/feature. O login assistido da Área Central usa Chrome isolado em Selenium/noVNC, tentativa única e cookie jar somente em memória por sessão; a autenticação real e a primeira consulta ainda precisam de homologação manual autorizada no portal.
- O Maven Wrapper está completo e fixado no projeto; use `mvnw`/`mvnw.cmd` em vez de depender de Maven global.
- O `pom.xml` aponta para PostgreSQL, agora confirmado como banco definitivo. O README técnico já foi atualizado; referências a Azure SQL no relatório acadêmico são históricas.
- O antigo `groupId`/pacote com o erro de grafia `calolicasc` foi substituído por `br.com.redeasso:redeasso-backend` e `br.com.redeasso.gestao` durante a estruturação consciente do backend.
- O pacote Drizzle/PostgreSQL antigo foi removido junto com o Express; JPA/Flyway são a única camada de persistência do sistema.
- O OpenAPI cobre saúde, autenticação local/sessão, login assistido da Área Central, pisos, cálculo, dashboard e mapas; os clientes React e Zod são regenerados a partir dele. Orçamentos, snapshots e etiquetas continuam fora do contrato até suas fases.
- Todas as telas atuais consomem o cliente gerado, inclusive mapas; não há `fetch` manual para as APIs de negócio.
- Toda rota de negócio sob `/api` exige sessão autenticada e CSRF nas mutações. Saúde e criação/consulta da sessão são as exceções intencionais.
- O fallback da SPA exclui `/api` e `/actuator`, portanto uma API inexistente não é convertida em HTML do React.
- Dinheiro e medidas usam `BigDecimal` no backend. `valor` significa R$/m² e `valorTotal` usa caixas × m²/caixa × preço por m².
- A margem de quebra aparece fixa em 10% no fluxo atual, apesar de o relatório exigir margem configurável.
- A tela de cálculo envia diretamente código da loja ou da rede ao endpoint Spring e não dispara mutações durante o render.
- Impressão/PDF e orçamento estão incompletos. “Adicionar a orçamento” não implementa o fluxo completo.
- O dashboard chama a quantidade de produtos cadastrados de “estoque disponível”; isso é dado fictício, não estoque real.
- O `.gitignore` ignora artefatos Maven/frontend e arquivos locais de ambiente. `target`, `dist` e `*.tsbuildinfo` não são fonte e foram retirados do conjunto versionado atual.

## 5. Estado atual de build e deploy

- `render.yaml` define a API Docker do Render a partir de `backend-gestao-revestimento/Dockerfile.render`, com health check e variáveis sensíveis preenchidas apenas no painel Render.
- A API Render usa inicialmente o plano `free`. O Worker Cloudflare mantém um cron `*/10 * * * *` que consulta somente `/actuator/health` para evitar suspensão; ele deixa a instância ativa e consome praticamente todas as 750 horas gratuitas mensais do workspace. Manter este agendamento apenas enquanto a conta Cloudflare aceitar esse intervalo e houver saldo de horas no Render.
- `frontend-gestao-revestimento/wrangler.jsonc` é a fonte de verdade do Worker: publica assets estáticos, proxy para `/api`, `API_ORIGIN` público e o cron de health check. A URL da API não é segredo e não vai para o bundle React.
- `.github/workflows/verify.yml` testa frontend, Worker em dry-run e Spring em todos os pushes. A `main` pode usar esse check para o `autoDeployTrigger: checksPass` do Render.
- `.github/workflows/docker.yml` constrói a imagem Docker de fallback em branches fora da `main` e pull requests, sem publicar imagem ou alterar produção.
- O roteiro operacional da primeira publicação fica em `docs/DEPLOY_NEON_RENDER_CLOUDFLARE.md`; ele exige segredos no painel do Render e validação explícita antes de importar dados já existentes.
- O Docker local continua com Spring + PostgreSQL 17, volume persistente, health checks e `.env`; não é o banco de produção nem um deploy automático.
- O Dockerfile multi-stage compila React/pnpm e Spring/Maven e entrega uma imagem JRE 21 não-root com o React incorporado ao JAR.
- O acesso local temporário no Render deve usar credenciais fortes fornecidas como segredos, jamais `admin/admin`. A credencial `admin/admin` continua restrita ao Docker local de desenvolvimento.
- `docker-compose.area-central.yml` usa o mesmo gateway local do serviço gerenciado: WebDriver/noVNC ficam internos, enquanto a porta do gateway valida chave de serviço e token temporário. O fluxo de UI integrado preenche credenciais temporárias no navegador e mostra o noVNC em modal apenas para a confirmação humana. O `render.yaml` declara o equivalente `redeasso-area-central-browser`; só habilitar a integração após os segredos e URLs dos dois serviços serem configurados no painel Render.
- Atualizar código em desenvolvimento não deve exigir reconstruir a imagem a cada alteração: use execução local/hot reload ou volumes de desenvolvimento. Em produção, uma nova imagem deve ser baixada e o container recriado; os dados permanecem porque ficam fora dele.
- Releases de produção devem ter tags imutáveis e caminho de rollback. Não depender exclusivamente de `latest`.

## 6. Inventário do projeto legado

O `CalculaPiso` é uma aplicação Java 11/Swing monolítica, Maven, JDBC/MySQL, Selenium e Jsoup. Não possui testes automatizados.

Módulos relevantes:

- `Procura`: busca, cálculo de piso/materiais, consulta externa, preço, WhatsApp e impressão.
- `Cadastro`: cadastro, cópia de parâmetros, obtenção de dados externos e fila de etiquetas.
- `Pisos_Cadastrados`: pesquisa, edição e exclusão.
- `EstoqueScraper`: login assistido, captura/validação de cookie e busca na Área Central.
- `GerenciadorEtiquetas`: fila em arquivo e impressão Argox.
- `CalcTijolo` e `CalcTelha`: cálculos históricos analisados, mas explicitamente fora do escopo da versão web.
- `Menu`: também anuncia forro; tijolo, telha, ferro e forro não devem ser migrados.
- `PisoTableModel` e `TudoCadastrado`: incompletos/quebrados; não usar como comportamento esperado.

### 6.1 Dados legados

O dump `CalculaPiso/calcula_piso.sql` possui 264 registros em uma única tabela `piso`. O legado usa nome como chave primária e armazena todas as 15 colunas como `varchar(250)`:

- nome;
- código Área Central/ASSO;
- código interno/CTC;
- largura e altura;
- rejunte;
- peças por caixa;
- m² por caixa;
- local de uso;
- tipo/acabamento;
- PEI/classificação de uso;
- retificado/bold;
- site;
- foto;
- ambiente.

Problemas que exigem limpeza antes de importar:

- códigos vazios e códigos repetidos;
- grafias e ordens inconsistentes em PEI/classificações;
- retificado/bold representado por textos diferentes;
- números guardados como texto, inclusive com espaços e formatos locais;
- uso de string vazia no lugar de `null`;
- nome como identidade técnica.

Não crie restrições de unicidade para ASSO/CTC antes de decidir como tratar duplicidades. A migração deve ser reproduzível, auditável e preservar o valor original para rastreio.

### 6.2 Regras de cálculo observadas

Estas fórmulas registram o legado. Preço, argamassa e rejunte tiveram seus padrões confirmados na seção 3.5; as demais ainda dependem das dúvidas correspondentes na seção 11.

Piso:

```text
area_peca_m2 = (altura_cm / 100) * (largura_cm / 100)

se o cliente informa m2:
  caixas_exatas = m2_solicitado / m2_por_caixa
  caixas_vendidas = teto(caixas_exatas)

se o cliente informa caixas:
  caixas_vendidas = teto(caixas_informadas)

m2_vendido = caixas_vendidas * m2_por_caixa
```

Peças por caixa no cadastro:

```text
pecas_por_caixa = m2_por_caixa / area_peca_m2
```

O legado formata o resultado como inteiro por arredondamento comum, sem decisão explícita entre piso/teto.

Rejunte, com profundidade fixa 9 e coeficiente fixo 1,8:

```text
soma_lados_mm = largura_cm * 10 + altura_cm * 10
area_peca_mm2 = (largura_cm * 10) * (altura_cm * 10)
kg_rejunte_por_m2 =
  (soma_lados_mm * profundidade * junta_mm * coeficiente) / area_peca_mm2
kg_rejunte_total = m2_vendido * kg_rejunte_por_m2
embalagens_rejunte = teto(kg_rejunte_total)
```

O padrão de embalagem de rejunte de 1 kg foi confirmado; ele será configurável.

Argamassa:

```text
sacos_teoricos = m2_vendido / 3
kg_teoricos = sacos_teoricos * 20
sacos_vendidos = teto(sacos_teoricos)
```

Isso representa 20 kg para 3 m², mas o legado mostra kg fracionário e sacos inteiros, gerando resultados visualmente inconsistentes.

Preço:

```text
preco = bruto * (1 + lucro_percentual / 100) * (1 - desconto_percentual / 100)
```

Os padrões de 90% de lucro e 12% de desconto foram confirmados. No novo sistema, eles e os parâmetros de argamassa/rejunte serão configurações persistidas, e não valores fixos no código.

O relatório adiciona uma regra que não existe claramente no legado:

```text
area_com_margem = area_informada * (1 + margem_quebra_percentual / 100)
caixas = teto(area_com_margem / m2_por_caixa)
```

As calculadoras de tijolo, telha, ferro e forro são apenas contexto histórico e não devem ser implementadas nesta versão.

### 6.3 Classificações e status observados

- Retificado seleciona 2 mm de junta por padrão; bold seleciona 5 mm.
- Juntas disponíveis: 1; 1,5; 2; 3; 4; 5 mm.
- Classificações LA a LE têm descrições no legado, mas são persistidas como texto cumulativo e inconsistente.
- Estados externos encontrados: `PADRAO`, `ACABAR`, `NEGOCIACAO`, “Fora de linha” e “Produto local”.
- Há regras de cor baseadas em status/estoque, mas o caso de estoque exatamente igual a 1 cai em lacunas condicionais. Não portar essa fronteira sem decisão.

### 6.4 Fluxo legado da Área Central

A consulta confirmada faz POST para a página de catálogo da Área Central, filtra por `PF.REFERENCIA` e envia `PHPSESSID`. Ela extrai:

- múltiplo/m² por caixa;
- estoque;
- status;
- nome;
- valor bruto.

O login do código atual não é HTTP direto:

1. abre Chrome Windows com perfil isolado e porta de depuração 9222;
2. o usuário resolve login e CAPTCHA manualmente;
3. Selenium conecta ao Chrome existente;
4. captura `PHPSESSID`;
5. valida por códigos fixos;
6. acrescenta o cookie a um arquivo de rede compartilhado;
7. encerra o ChromeDriver.

Não existe API oficial: o novo backend deve reproduzir o login do portal, guardar o cookie jar obtido e reutilizá-lo nas pesquisas. O fluxo legado Windows-only e global não funciona como está em um Docker remoto. Como há CAPTCHA em todo login, o desenho precisa prever a participação legítima do usuário quando o portal exigir a caixa ou imagens; não presumir bypass automático. Antes de implementar, caracterizar o contrato HTTP, redirects, tokens e cookies e decidir entre navegador automatizado controlado ou outra integração compatível com o CAPTCHA.

O parser atual depende de seletores HTML frágeis, timeout fixo de 5 segundos e códigos de teste fixos. O novo adaptador precisa distinguir claramente: sessão expirada, produto inexistente, portal indisponível, HTML incompatível e timeout.

### 6.5 Etiquetas e impressão

- A fila é texto semelhante a JSON em compartilhamento de rede e não é segura para concorrência.
- Campos: nome, códigos ASSO/CTC, m²/caixa, peças/caixa, PEI, preço e quantidade.
- A impressão tenta duas etiquetas por folha de 100 x 150 mm em Argox.
- A impressão de cupom Elgin/NFCE é apenas contexto do legado e está fora do escopo confirmado.
- Um container no servidor remoto não enxerga automaticamente impressoras Windows da loja. Impressão direta exigirá PDF no navegador ou um agente/serviço local de impressão.

## 7. Arquitetura-alvo recomendada

Organizar o Spring por domínio/feature, mantendo as fronteiras abaixo:

- `auth`: identidade do RedeASSO, sessão local e autorização.
- `integracao.areacentral`: login externo, cookie jar, cliente HTTP, parser e erros externos.
- `catalogo`: produto/revestimento e dados técnicos locais.
- `calculo`: serviços puros para piso, preço e materiais.
- `mapa`: mapas, posições e até quatro itens ordenados por posição.
- `orcamento`: orçamento, itens, totais, PDF e compartilhamento.
- `snapshot`: capturas externas, diferenças e alertas.
- `etiqueta`: geração e fila de impressão.
- `auditoria`: atividades e eventos relevantes.
- `configuracao`: parâmetros de negócio versionados.

Práticas obrigatórias:

- controllers finos, DTOs próprios e validação Bean Validation;
- regras em services puros/testáveis;
- repositories Spring Data JPA e transações explícitas nas operações compostas;
- migrations versionadas com Flyway ou Liquibase;
- IDs técnicos, timestamps, auditoria e, onde houver edição concorrente, versionamento otimista;
- `BigDecimal` para dinheiro e medidas que exigem precisão; unidade explícita nos nomes/campos;
- credenciais e configuração apenas por variáveis/segredos de ambiente;
- respostas de erro estáveis, sem stack trace ou dados externos;
- logs estruturados com redaction;
- cliente da Área Central atrás de interface própria, para permitir fixtures e testes sem conta real;
- OpenAPI atualizado antes/junto da implementação e clientes gerados sem edição manual;
- nenhuma dependência do backend em caminhos Windows, unidade de rede, GUI ou impressora local.

Modelo conceitual inicial, ainda sujeito às decisões abertas:

- `Usuario` / `SessaoAplicacao`;
- `SessaoAreaCentral` ou armazenamento de sessão equivalente;
- `Piso` e possíveis classificações/ambientes normalizados;
- `Calculo` / `Simulacao`;
- `Mapa`, `PosicaoMapa`, `ItemPosicaoMapa` com índice de ordem 1..4;
- `Orcamento`, `ItemOrcamento`;
- `SnapshotProduto`, `MudancaProduto`;
- `AtividadeAuditoria`;
- `ParametroSistema` com valor, unidade, validade e trilha de alteração;
- `Etiqueta` / `ItemFilaImpressao` para a impressão de etiquetas confirmada no escopo.

## 8. Segurança do novo sistema

- Nunca usar credencial real em teste automatizado, fixture, screenshot, issue, commit ou log.
- Sanitizar HTML gravado para fixtures e remover cookies, nomes de usuário e dados comerciais sensíveis.
- Usar consultas parametrizadas/JPA; jamais portar SQL por concatenação.
- Manter credenciais transitórias e cookie jars isolados conforme a seção 3.2.
- Não automatizar a resolução ou o contorno do CAPTCHA; permitir a interação legítima do usuário quando necessária.

## 9. Persistência, disponibilidade e fallback

- PostgreSQL será a fonte de verdade definitiva.
- Containers da aplicação devem ser descartáveis; banco, arquivos e backups não.
- O fallback local precisa apresentar os mesmos dados do servidor. Ainda é necessário escolher entre acesso ao PostgreSQL principal, réplica promovível ou restauração controlada de backup.
- Nunca permitir que servidor e fallback gravem independentemente em bases divergentes sem reconciliação definida.
- Definir RPO, RTO, frequência de backup, retenção, restauração testada e responsável operacional.
- Migrations devem rodar uma única vez de forma segura e ser compatíveis com rollback operacional.
- Sessões externas armazenadas apenas na memória de uma instância desaparecem em restart/failover. Se precisarem sobreviver ou houver múltiplas réplicas, usar armazenamento compartilhado seguro; a tecnologia ainda será decidida.

## 10. Estratégia de migração confirmada

O usuário confirmou em 15/08/2026 a seguinte ordem de execução. Não antecipar uma fase posterior enquanto a anterior não estiver funcional e validada:

1. **Concluído:** migrar para Spring todos os endpoints e comportamentos anteriormente atendidos pelo Express: catálogo de pisos, cálculos, dashboard/atividades e mapas.
2. **Concluído:** persistir esses módulos no PostgreSQL, cobri-los por testes, trocar o runtime/Docker para Spring e retirar integralmente o Express da aplicação.
3. **Em homologação:** o login assistido já abre Chrome isolado por noVNC, captura o cookie jar apenas em memória e vincula-o à sessão RedeASSO. Validar manualmente o contrato real do portal e a primeira consulta externa antes de considerar a fase concluída. O login local `admin/admin` permanece somente como acesso de desenvolvimento/testes.
4. Somente depois da homologação do login, implementar a configuração editável dos parâmetros de cálculo e sua auditoria/histórico.
5. Depois dessas fases, avançar nos módulos ainda não especificados integralmente: orçamento/PDF/WhatsApp, snapshots e impressão de etiquetas.
6. Implantar em Neon/Render/Cloudflare, ensaiar backup/rollback e manter Docker local como fallback controlado.

Evite uma troca total sem compatibilidade. Preserve contratos úteis do frontend, migre endpoint a endpoint e retire o Express somente quando o equivalente Spring estiver persistido, autenticado e testado.

## 11. Dúvidas em aberto

### Prioridade 1 — autenticação e Área Central

- **Q04.** Qual é o contrato real de login — URL, campos, token CSRF/CAPTCHA, redirects e cookies? O canal de interação foi decidido: navegador Chromium isolado exibido por noVNC em modal, entregue por gateway protegido com token curto, para que o usuário complete legitimamente a caixa “Sou humano”. Foi caracterizado que a página pública já entrega `PHPSESSID`; não usá-lo sozinho como validação. Ainda é necessário levantar o contrato em sessão autorizada, sem registrar a senha, confirmar a transição da tela e validar uma consulta real ao catálogo no servidor.
- **Q05.** Além da validade usual durante o expediente, um novo login invalida sessões anteriores? A mesma conta pode ser usada simultaneamente?
- **Decidido (Q07).** Quem entrou com `admin/admin` vincula a própria conta externa na ação “Conectar Área Central”, pelo mesmo fluxo noVNC e CAPTCHA manual. Não há conta de serviço global.
- **Q08.** Todos os usuários externos terão as mesmas permissões no RedeASSO? Haverá papéis de vendedor, gestor e administrador?
- **Q09.** O login externo também cria uma identidade persistente/auditoria local ou só uma sessão efêmera?
- **Q10.** Quais limites, termos de uso e autorização se aplicam à automação? Qual frequência de consulta é aceitável?

### Prioridade 1 — banco, servidor e deploy

- **Q12.** Como o fallback local terá os mesmos dados: acesso ao PostgreSQL principal, réplica promovível ou restauração controlada de backup?
- **Q13.** Qual RPO/RTO é aceitável e onde ficarão backups fora da máquina principal?
- **Decidido (Q15).** Neon e Render usarão Ohio (`us-east-2` / `ohio`) para reduzir a latência entre API e banco.
- **Q16.** Haverá ambiente de homologação próprio (Render + branch Neon) para os previews Cloudflare de branches?
- **Decidido (Q17).** A `main` é a branch de produção: Render publica após CI e Cloudflare Workers Builds publica diretamente pela integração Git. Outras branches passam pelo build Docker; não podem tocar banco de produção.
- **Q18.** Como será feito rollback e quem recebe alertas de falha de deploy/health check?

### Prioridade 1 — dados e cálculos

- **Q19.** Os 264 produtos/dados do XAMPP ainda são a carga oficial a exportar? Quais campos são locais e quais devem sempre ser atualizados pela Área Central?
- **Q20.** Código ASSO, código CTC e nome devem ser únicos? Como resolver as duplicidades e vazios existentes?
- **Q21.** O campo externo “múltiplo” é sempre o m² por caixa e pode atualizar automaticamente o cadastro local?
- **Q23.** Qual é o padrão e os limites da margem de quebra? Ela se aplica antes do arredondamento de caixas e pode ser alterada por quem?
- **Q25.** Os kg exibidos devem ser consumo teórico ou quantidade efetivamente vendida após arredondar embalagens?
- **Q26.** Peças por caixa devem ser digitadas, derivadas ou apenas validadas? Se derivadas, usar arredondamento comum, piso ou teto?
- **Q27.** Como tratar estoque exatamente igual a 1 e quais status externos são canônicos? As cores são apenas apresentação, não regra de domínio.
- **Q28.** O estoque consultado representa rede, filial, depósito ou combinação? Como escolher a unidade e tratar estoque insuficiente/indisponibilidade externa?

### Prioridade 2 — mapa, orçamento, snapshot e impressão

- **Q29.** O mapa representa somente localização física ou também saldo/reserva? Alterar uma posição deve afetar estoque ou orçamento?
- **Q30.** Em cada item do mapa, `m2` e `caixas` são informativos, calculados ou a quantidade física real? O mesmo piso pode aparecer em várias posições?
- **Q31.** Quais limites de linhas/colunas, rótulos e regras de movimentação/auditoria devem valer no mapa?
- **Q32.** Quais dados formam um orçamento: cliente, validade, vendedor, descontos, frete, vários pisos, estoque, numeração e status?
- **Q33.** WhatsApp deve apenas abrir uma mensagem/link, gerar PDF para download ou enviar por uma integração oficial?
- **Q34.** Snapshot compara quais campos (preço, estoque, status, ficha técnica), em que frequência e por qual canal avisa mudanças?
- **Q35.** A impressão de etiquetas será PDF pelo navegador ou impressão direta em Argox por meio de agente/serviço local?
- **Q36.** O layout 100 x 150 mm, duas etiquetas por folha, continua correto?

### Prioridade 2 — escopo e qualidade

- **Q38.** O limite acadêmico de três telas foi abandonado com mapa/orçamento ou deve ser reinterpretado como três fluxos principais?
- **Q39.** Upload e armazenamento de imagens entram agora? Onde os arquivos serão persistidos e copiados no fallback?
- **Q40.** Quantos usuários simultâneos, qual latência máxima e qual disponibilidade devem ser testados?
- **Q41.** Quando a Área Central estiver fora, mostrar último snapshot, bloquear orçamento ou permitir continuar com aviso?

## 12. Regras para qualquer implementação futura

- Antes de alterar, leia este arquivo e verifique `git status` nos dois repositórios. Preserve alterações do usuário.
- Não modificar o `CalculaPiso` sem pedido explícito; ele é referência histórica.
- Não executar exclusão de volumes, banco ou dados sem autorização explícita.
- Não implementar uma questão aberta como fato. Registre a decisão primeiro.
- Para cada regra migrada do legado, criar testes de caracterização com exemplos aprovados e casos de borda.
- Testar valores zero/nulos, decimais brasileiros, arredondamento, estoque exatamente 1, sessão expirada e portal indisponível.
- Nunca chamar a Área Central com conta real em testes automatizados. Usar fixtures HTML sanitizadas e um cliente falso.
- Testar que cookies/senhas externas nunca aparecem no corpo da API, logs, traces ou frontend.
- Testar persistência após restart do container e concorrência nas edições de mapa/orçamento.
- Atualizar OpenAPI, implementação, clientes gerados e documentação juntos.
- Não editar arquivos gerados manualmente quando houver gerador configurado.
- Manter frontend e backend executáveis no Windows para desenvolvimento e em containers Linux para produção.
- Usar configurações por ambiente, health checks e logs sem segredos.
- Não depender de caminhos absolutos, IPs LAN, Chrome gráfico, porta de debug global ou impressoras locais no backend.
- Todo deploy que altera schema precisa de backup/restauração testável e plano de rollback compatível.
- Ao concluir uma fase, remover somente o componente transitório que já possua equivalente persistente, autenticado e testado.
