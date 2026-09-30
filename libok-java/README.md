# LiBok 2.0 — Java e Spring Boot

Nova versão do LiBok, reescrita em **Java 21 + Spring Boot 4**, com as mesmas funções da versão em Python e várias melhorias.
Continua sendo um programa de computador (`LiBok.exe`) com **banco de dados local** (SQLite), sem servidor e sem internet.

<p align="center"><img src="src/main/resources/static/img/icon.png" alt="LiBok" width="140"></p>

## Como funciona

Ao abrir o `LiBok.exe`, o programa inicia um servidor interno em `127.0.0.1:8765` e abre a interface numa janela
própria (Microsoft Edge ou Chrome em modo aplicativo, sem abas nem barra de endereço). Um ícone perto do relógio do
Windows oferece **Abrir LiBok** e **Sair**. Se o programa já estiver aberto, abrir de novo apenas mostra a janela.

Os dados ficam em `%APPDATA%\LiBok2` (banco `libok.db`, backups e `libok.log`) — pasta separada da versão antiga, que usa `%APPDATA%\LiBok`, para os dois programas poderem conviver.

## Funcionalidades

| Área | O que faz |
|---|---|
| **Painel** | Indicadores de empréstimos, novos leitores, leitores ativos e atrasos (com variação em relação ao período anterior e minigráficos); livros mais emprestados; leitores que mais leram; acervo por categoria; empréstimos ao longo do tempo; próximas devoluções. Períodos de 7/30/90 dias, ano, 12 meses ou personalizado. |
| **Acervo** | Busca instantânea (sem diferenciar acentos e maiúsculas) por título, autor, categoria, assunto, ISBN ou código; filtro por categoria e disponibilidade; ordenação; paginação. |
| **Cadastro de livro** | Título, autor, categoria (com sugestões), assunto, ISBN, ano, descrição e um código por exemplar. Gerador de códigos em sequência (ex.: `ROM-001`…), Enter pula para o próximo código (funciona com leitor de código de barras). |
| **Detalhes do livro** | Exemplares e situação de cada um, histórico de empréstimos, editar, excluir, dar baixa em exemplar perdido/danificado. |
| **Empréstimos** | Empréstimo por código do exemplar, prazo padrão configurável, renovação, devolução (também pela "devolução rápida" digitando o código), abas Em aberto / Em atraso / Devolvidos. |
| **Leitores** | Cadastro com matrícula, turma e contato; ficha com estatísticas, livros atuais e histórico de leituras. |
| **Importar e exportar** | Importação de CSV **com prévia antes de gravar** e log detalhado; importação direta do `libok.db` da versão antiga; exportação de acervo, empréstimos e leitores em CSV para o Excel. |
| **Configurações** | Nome da biblioteca, prazo, limite de livros por leitor, bloqueio de quem está em atraso; backup manual, **backup automático diário** e restauração. |

## Melhorias em relação à versão anterior

- **Empréstimos e leitores**, que não existiam (estavam em "Possíveis evoluções").
- **Cada exemplar é um registro** com código único em todo o acervo. Antes os códigos ficavam num texto só e podiam se repetir.
- A **edição também impede título duplicado** (antes só o cadastro verificava).
- **Categorias sem duplicatas**: "Romance", "romance " e "ROMANCE" viram a mesma categoria, e cada categoria mantém sempre a mesma cor.
- **Busca feita no banco** (e não carregando o acervo inteiro na memória).
- **Importação mais segura**: prévia, detecção de duplicados dentro do próprio arquivo, arquivos salvos pelo Excel (Windows-1252) e separador `;` ou `,`. Os motivos de erro de cada linha ficam registrados no histórico.
- Exemplares perdidos podem receber **baixa** sem apagar o histórico.
- **Backups** automáticos e restauração pela própria tela.
- **Segurança local**: o servidor só aceita conexões do próprio computador e recusa envios vindos de outros sites.
- **Testes automatizados** (38 testes) cobrindo regras de negócio, CSV, importação, backup e telas.

## Estrutura

```text
libok-java/
├── pom.xml
├── empacotar-windows.ps1           # gera LiBok.exe (e instalador opcional)
├── icon.ico
└── src/main/
    ├── java/br/com/libok/
    │   ├── LibokApplication.java   # início: pasta de dados, instância única, restauração pendente
    │   ├── desktop/                # janela em modo aplicativo e ícone na bandeja
    │   ├── acervo/                 # livros, exemplares e categorias
    │   ├── leitores/
    │   ├── emprestimos/
    │   ├── painel/                 # indicadores e dados dos gráficos
    │   ├── importacao/             # CSV, banco antigo e exportações
    │   ├── configuracao/           # preferências e backups
    │   ├── comum/                  # normalização de textos, conversores de data, exceções
    │   └── web/                    # proteção de acesso local, dados comuns das telas
    └── resources/
        ├── db/migration/           # esquema do banco (Flyway)
        ├── templates/              # telas (Thymeleaf)
        └── static/                 # CSS, JavaScript, ícones, Chart.js (webjar)
```

## Banco de dados

SQLite com as tabelas `livro`, `exemplar`, `categoria`, `leitor`, `emprestimo`, `importacao` e `configuracao`.
O esquema é criado e atualizado automaticamente pelo Flyway. Datas são gravadas como texto ISO (`2026-09-30`).

## Desenvolvimento

Requisitos: JDK 21 e Maven.

```bash
mvn test                 # roda os testes
mvn spring-boot:run      # inicia em http://localhost:8765 e abre a janela
java -jar target/libok.jar -Dlibok.abrir-navegador=false   # sem abrir janela
```

Propriedades úteis: `-Dlibok.pasta-dados=C:\outra\pasta`, `-Dlibok.porta=9000`, `-Dlibok.abrir-navegador=false`.

## Gerar o `.exe`

No Windows, dentro de `libok-java`:

```powershell
.\empacotar-windows.ps1              # dist\LiBok\LiBok.exe + dist\LiBok-2.0.0-windows.zip (portátil)
.\empacotar-windows.ps1 -Instalador  # também gera o instalador com atalhos (requer WiX Toolset 3)
```

O pacote leva um Java próprio e reduzido: o computador da biblioteca não precisa ter Java instalado.
O workflow `.github/workflows/libok-java.yml` roda os testes e gera o pacote para Windows automaticamente a cada push,
disponível em *Actions → LiBok Java → Artifacts*.

## Migrando da versão antiga

1. Abra o LiBok 2.0 e vá em **Importar e exportar → Trazer dados do LiBok antigo**.
2. Se o LiBok antigo (`.exe`) foi usado neste computador, o banco é encontrado sozinho: clique em **Ler agora**.
   Caso contrário, envie o arquivo `libok.db` antigo.
3. Confira a prévia e confirme. Também é possível importar um CSV exportado pela versão antiga.
