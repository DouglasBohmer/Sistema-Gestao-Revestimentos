# 🏗️ RedeAsso - Sistema de Gestão e Dimensionamento de Revestimentos Cerâmicos

Este sistema consiste em uma plataforma web focada na automação do processo de atendimento e orçamentação de pisos e revestimentos cerâmicos para o setor de construção civil.

## 📖 Descrição e Contextualização do Problema

No mercado de materiais de construção, a precisão no cálculo de quantitativos de revestimentos é um fator decisivo para a satisfação do cliente e a lucratividade das vendas. Durante a análise do fluxo de atendimento, constatou-se que o processo de conversão de área (m²) para caixas fechadas era realizado de forma manual ou por meio de planilhas genéricas que frequentemente ignoravam variáveis como a margem de quebra, as dimensões exatas de fabricação e a variação de peças por lote.

Este projeto tem como finalidade resolver essas limitações. Ao centralizar as informações técnicas e automatizar o cálculo, o sistema elimina as divergências entre a quantidade vendida e a necessária para a obra, acabando com o retrabalho dos vendedores, inconsistências visuais no mostruário e o risco de prejuízos.

## 🎯 Objetivos do Sistema

O desenvolvimento da plataforma foi pautado em cinco grandes pilares:
1. **Exatidão Técnica:** Assegurar que a quantidade de material dimensionada corresponda precisamente à demanda da obra.
2. **Agilidade Operacional:** Reduzir o tempo de cada atendimento através de um fluxo otimizado (finalização de consultas em até 5 interações ou em menos de 1 minuto).
3. **Padronização Visual:** Uniformizar a exibição de dados no showroom utilizando a geração de etiquetas automatizadas.
4. **Redução de Erros:** Mitigar falhas humanas substituindo cálculos manuais por um algoritmo parametrizável.
5. **Disponibilidade e Mobilidade:** Garantir o acesso distribuído através da hospedagem em nuvem, permitindo o uso do sistema simultaneamente por vários colaboradores em qualquer dispositivo.

## 🚀 Módulos e Funcionalidades Principais (Escopo)

O sistema abrange módulos que cobrem toda a jornada de dimensionamento e suporte à venda de cerâmicas:

* **Catálogo Técnico Centralizado (CRUD):** Registro, edição e visualização de todos os dados dos revestimentos. Os campos englobam: Nome do Piso, Código Rede, Código Loja, Largura, Altura, Rejunte, Peças/Caixa, M²/Caixa, Local de Uso, Tipo de Piso, índice PEI e Indicação de Retificação.
* **Motor de Cálculo Dinâmico:** Algoritmo que recebe a área informada pelo cliente em metros quadrados ($m^2$) e a margem de quebra estipulada, convertendo automaticamente esses dados na quantidade exata de caixas (com arredondamento para cima).
* **Consulta Integrada em Tempo Real:** Sistema de integração para busca de saldo de estoque e ficha técnica, consolidando os dados internos do aplicativo com as informações atualizadas do portal da rede.
* **Módulo de Exportação PDF e Orçamentos:** Emissão automatizada de etiquetas para o showroom contendo especificações e códigos. Conta ainda com um facilitador para exportar e encaminhar o orçamento direto para o WhatsApp do cliente.
* **Dashboard Administrativo:** Painel de controle inicial com métricas cruciais de operação (pisos cadastrados, impressões realizadas, simulações feitas, estoque geral) e atalhos rápidos.

## 📋 Requisitos Técnicos do Sistema

**Principais Requisitos Funcionais:**
- Permissão para busca inteligente e filtragem de produtos utilizando Código Loja ou Código Rede.
- Cálculo e simulação individualizada instantânea.
- Visualização de atividades recentes no feed do dashboard principal.

**Principais Requisitos Não Funcionais:**
- **Compatibilidade:** O sistema é acessível via navegadores modernos (Chrome, Firefox, Edge) de forma nativa, sem plug-ins.
- **Alta Disponibilidade e Concorrência:** A arquitetura em nuvem permite acessos simultâneos sem perda de desempenho ou bloqueios de banco de dados.

## 💻 Arquitetura e Stack Tecnológica

Para garantir a escalabilidade do código e uma fácil manutenção, o projeto utiliza a **Arquitetura em Camadas (Multi-tier Architecture)**.

| Camada / Componente | Tecnologia Adotada |
| :--- | :--- |
| **Linguagem Backend** | Java (JDK 21+) |
| **Framework Backend** | Spring Boot com Spring Web (APIs REST) e Spring Data JPA |
| **Frontend (Interface)** | React.js (com Vite), estruturado via HTML5 e CSS3 |
| **Banco de Dados** | Microsoft Azure SQL Database (Relacional em Nuvem) |
| **Geração de PDF** | Bibliotecas iTextPDF ou Apache PDFBox |
| **Infraestrutura / Nuvem** | Microsoft Azure (Azure App Service, Static Web Apps, SQL) |

A separação isola as regras de negócio das interações de tela. O design visual e o fluxo de interação foram prototipados previamente utilizando a plataforma Figma Make.

## 👨‍💻 Equipe de Desenvolvimento

Projeto de software concebido no âmbito acadêmico da disciplina de PAC Extensionista do curso de Engenharia de Software da Católica de Santa Catarina (2026):

- **Douglas Eduardo Schuller Bohmer** - Líder do Projeto / Backend
- **Gabriel Sordi** - Segurança / Levantamento de Requisitos
- **Igor Sebastian Mathias** - Testes / Wireframes / Requisitos
- **Lucas Dias** - Frontend / Backend / Wireframes
- **Walter Matheus Retke** - Frontend / Banco de Dados

**Orientação e Supervisão:** Professora Jéssica Aline Karsten
