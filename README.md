<img src="./Public/IMG/gitlogo.png" width="100px" align="left">

### `SISTEMA DE ANÁLISE DE AVANÇOS`

![Status](https://img.shields.io/badge/STATUS-OPERATIONAL-green)
![Environment](https://img.shields.io/badge/ENV-SENAI_CIC-red)
![Stack](https://img.shields.io/badge/STACK-PERN-blue)

**SISTEMA DE ANÁLISE DE AVANÇOS** é uma plataforma de gestão pedagógica projetada para converter dados brutos de avaliações em inteligência visual, monitorando competências e desempenho acadêmico em tempo real.

<div flex="true">
  <a href="#instalação">
    Instalação
  </a>
  •
  <a href="#tecnologias">
    Tecnologias
  </a>
  •
  <a href="#identidade-visual">
    Identidade Visual
  </a>
</div>

### Estrutura do Subsistema (`/src`)

- [`config/`](./src/config) - Protocolos de conexão com o Banco de Dados.
- [`controllers/`](./src/controllers) - Lógica de processamento e roteamento de dados.
- [`models/`](./src/models) - Estruturas de Queries SQL e abstração de dados.
- [`public/`](./src/public) - Ativos estáticos e estilização Neo-brutalista.
- [`views/`](./src/views) - Templates dinâmicos via EJS Engine.

### Especificações Técnicas

- **Backend:** Node.js com Express Framework.
- **Frontend:** EJS (Embedded JavaScript) com arquitetura CSS3 Neo-brutalista.
- **Data Core:** PostgreSQL (Relacional).
- **Session Manager:** Express-Session para persistência de estado.

### Identidade Visual (System Colors)

* **Primary:** `#FF0101` (Vermelho Institucional SENAI)
* **Background:** `#131313` (Deep Dark Mode)
* **Design:** Neo-brutalismo (High contrast, hard shadows, thick borders).

<div align="center"> 
<sub>Built with ☕ and 🌙 by LukzST</sub>
</div>
