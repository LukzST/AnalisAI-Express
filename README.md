# SISTEMA DE ANÁLISE DE AVANÇOS - SENAI CIC

## SOBRE O PROJETO
O Sistema de Análise de Avanços é uma plataforma de gestão pedagógica desenvolvida para o SENAI CIC. O foco é transformar dados brutos de avaliações em indicadores visuais claros para monitoramento de competências e desempenho acadêmico.

---

## TECNOLOGIAS
* Backend: Node.js / Express
* Frontend: EJS / CSS3 (Neo-brutalismo)
* Banco de Dados: PostgreSQL
* Sessão: Express-Session

---

## ESTRUTURA DE PASTAS
### src/
* config/: Conexão com o banco de dados.
* controllers/: Lógica de rotas e renderização.
* models/: Queries SQL.
* public/: CSS, imagens e scripts front-end.
* views/: Templates e layouts.

---

## COMO INSTALAR

### 1. Clonar repositório
git clone https://github.com/seu-usuario/PROJETO-2026.git

### 2. Instalar dependências
npm install

### 3. Configurar banco de dados
Crie um banco chamado analisai e rode o arquivo schema.sql.

### 4. Variáveis de Ambiente
Crie um arquivo .env com as seguintes chaves:
* DB_USER
* DB_PASSWORD
* DB_NAME
* DB_PORT

---

## SCRIPTS DISPONÍVEIS
* npm start: Roda o servidor normalmente.
* npm run dev: Roda com Nodemon (Reinicia ao salvar arquivos .js ou .ejs).

---

## IDENTIDADE VISUAL
* Cor Primária: #FF0101 (Vermelho SENAI)
* Cor Secundária: #131313 (Dark Mode)
* Estilo: Neo-brutalismo (Bordas e sombras marcadas)