# Sistema de Gestão e Dimensionamento de Revestimentos Cerâmicos

Este projeto é uma plataforma Web robusta e intuitiva voltada para a automação do dimensionamento de revestimentos cerâmicos. Ele foi desenvolvido para resolver problemas operacionais em lojas de materiais de construção, substituindo cálculos manuais imprecisos por um sistema automatizado que converte a área (m²) para unidades de venda (caixas fechadas). O sistema considera variáveis críticas como margens de quebra, perdas no corte e dimensões específicas de cada fabricante.

## 🎯 Objetivos do Sistema

* **Exatidão Técnica:** Garantir que a quantidade de material calculada corresponda precisamente à necessidade da obra, reduzindo sobras e reposições.
* **Agilidade Operacional:** Reduzir o tempo de atendimento por meio de uma interface otimizada para consultas rápidas e fluxo simplificado.
* **Padronização:** Uniformizar a exibição de dados no showroom gerando automaticamente etiquetas com layout consistente em PDF.
* **Disponibilidade:** Centralizar as informações em nuvem, permitindo acesso descentralizado via navegador.
* **Redução de Erros:** Substituir processos manuais por um algoritmo validado e parametrizável.

## 🚀 Funcionalidades Principais (Escopo)

O projeto é focado em Pisos e Revestimentos. Suas principais funcionalidades incluem:

* **Módulo de Catálogo Técnico:** Registro e gerenciamento de atributos dos revestimentos, como PEI, acabamento, dimensões e tonalidade.
* **Algoritmo de Cálculo de Conversão:** Processamento dinâmico da conversão de metros quadrados para caixas, com aplicação de margem de perda configurável.
* **Interface de Consulta Integrada:** Visualização dos dados do catálogo interno em conjunto com a consulta em tempo real aos saldos de estoque no portal.
* **Motor de Exportação de Documentos:** Geração automatizada de etiquetas de mostruário em PDF.
* **Painel de Controle Administrativo:** Manutenção de dados cadastrais, configuração de margens e gerenciamento de links.

## 💻 Tecnologias Utilizadas

A stack tecnológica foi definida com base na maturidade e compatibilidade com ambientes de nuvem:

* **Backend:** Java.
* **Framework Backend:** Spring Boot, utilizando Spring Data JPA para persistência e Spring Web para APIs REST.
* **Frontend:** React.js (Vite/Create React App) integrado com HTML5 e CSS3 para uma interface responsiva.
* **Banco de Dados:** Microsoft Azure SQL Database.
* **Geração de PDF:** iTextPDF/Apache PDFBox para exportação das etiquetas técnicas.
* **Hospedagem / Nuvem:** Microsoft Azure.

## ⚙️ Arquitetura

O sistema adota o modelo de **Arquitetura em Camadas (Multi-tier Architecture)**, garantindo clareza de responsabilidades e escalabilidade:
* **Frontend:** Interface web responsiva para interação do usuário e exibição de resultados.
* **Backend:** Núcleo de execução dos algoritmos de cálculo e integração com serviços externos.
* **Database:** Servidor relacional para armazenamento seguro de todas as informações do catálogo.

## 📋 Requisitos de Destaque e Desempenho

* **Usabilidade e Rapidez:** O fluxo completo de busca de um produto e conclusão do cálculo de dimensionamento foi projetado para ser finalizado em no máximo 5 interações e em menos de 20 segundos.
* **Compatibilidade:** Totalmente acessível via navegadores modernos (Google Chrome, Mozilla Firefox, Microsoft Edge), sem a necessidade de instalações adicionais.
* **Escalabilidade:** Suporta acessos simultâneos de múltiplos usuários mantendo a integridade dos dados e o desempenho.
