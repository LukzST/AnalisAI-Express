CREATE TABLE  IF NOT EXISTS  usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) DEFAULT 'Professor',
    status VARCHAR(20) DEFAULT 'ATIVO',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alunos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ano_escolar VARCHAR(50) NOT NULL,
    idade INTEGER NOT NULL,
    nota DECIMAL(3,1) DEFAULT 0.0,
    presenca INTEGER DEFAULT 100,
    nivel VARCHAR(30) 
);

CREATE TABLE IF NOT EXISTS notas_detalhadas (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    titulo VARCHAR(100),
    descricao TEXT,
    valor DECIMAL(4,2),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO usuarios (nome, email, senha) 
VALUES ('Administrador', 'admin', '123')
ON CONFLICT (email) DO NOTHING;

INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES 
('LUCAS SILVA', '3º MÉDIO', 17, 9.5, 100, 'APTO'),
('MARIA OLIVEIRA', '2º MÉDIO', 16, 4.2, 85, 'INAPTO'),
('JOÃO PEDRO', '1º MÉDIO', 15, 6.5, 90, 'EM DESENVOLVIMENTO'),
('ANA BEATRIZ', '9º FUNDAMENTAL', 14, 8.0, 95, 'APTO'),
('CARLOS EDUARDO', '8º FUNDAMENTAL', 13, 3.5, 60, 'INAPTO'),
('BEATRIZ SOUZA', '3º MÉDIO', 17, 7.0, 80, 'APTO');

SELECT * FROM usuarios;
SELECT * FROM alunos;






-- =====================================================
-- BANCO DE DADOS COMPLETO - ANALISAI
-- =====================================================

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) DEFAULT 'Professor',
    status VARCHAR(20) DEFAULT 'ATIVO',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Alunos
CREATE TABLE IF NOT EXISTS alunos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ano_escolar VARCHAR(50) NOT NULL,
    idade INTEGER NOT NULL,
    nota DECIMAL(3,1) DEFAULT 0.0,
    presenca INTEGER DEFAULT 100,
    nivel VARCHAR(30) DEFAULT 'EM DESENVOLVIMENTO'
);

-- Tabela de Notas Detalhadas
CREATE TABLE IF NOT EXISTS notas_detalhadas (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    titulo VARCHAR(100),
    descricao TEXT,
    valor DECIMAL(4,2),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- NOVAS TABELAS DE COMPETÊNCIAS
-- =====================================================

-- Tabela de Competências (catálogo)
CREATE TABLE IF NOT EXISTS competencias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    categoria VARCHAR(50) DEFAULT 'Técnica',
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Aluno_Competencias (relacionamento)
CREATE TABLE IF NOT EXISTS aluno_competencias (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER NOT NULL,
    competencia_id INTEGER NOT NULL,
    nota DECIMAL(3,1) NOT NULL CHECK (nota >= 0 AND nota <= 10),
    observacoes TEXT,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
    FOREIGN KEY (competencia_id) REFERENCES competencias(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_aluno ON aluno_competencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_comp ON aluno_competencias(competencia_id);

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir usuário padrão
INSERT INTO usuarios (nome, email, senha) 
VALUES ('Administrador', 'admin', '123')
ON CONFLICT (email) DO NOTHING;

-- Inserir competências padrão
INSERT INTO competencias (nome, descricao, categoria) VALUES
('Raciocínio Lógico', 'Capacidade de resolver problemas usando lógica e pensamento estruturado', 'Cognitiva'),
('Comunicação', 'Habilidade de expressar ideias de forma clara e objetiva', 'Comportamental'),
('Trabalho em Equipe', 'Capacidade de colaborar e contribuir em grupo', 'Socioemocional'),
('Proatividade', 'Iniciativa para realizar tarefas sem necessidade de cobrança', 'Comportamental'),
('Criatividade', 'Capacidade de pensar em soluções inovadoras', 'Cognitiva'),
('Liderança', 'Habilidade de influenciar e guiar pessoas', 'Socioemocional'),
('Organização', 'Capacidade de planejar e estruturar atividades', 'Comportamental'),
('Pensamento Crítico', 'Análise e avaliação de situações de forma fundamentada', 'Cognitiva'),
('Resiliência', 'Capacidade de superar desafios e adversidades', 'Socioemocional'),
('Ética', 'Compromisso com valores e princípios morais', 'Comportamental')
ON CONFLICT (nome) DO NOTHING;

-- Inserir alunos de exemplo
INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES 
('LUCAS SILVA', '3º MÉDIO', 17, 9.5, 100, 'APTO'),
('MARIA OLIVEIRA', '2º MÉDIO', 16, 4.2, 85, 'INAPTO'),
('JOÃO PEDRO', '1º MÉDIO', 15, 6.5, 90, 'EM DESENVOLVIMENTO'),
('ANA BEATRIZ', '9º FUNDAMENTAL', 14, 8.0, 95, 'APTO'),
('CARLOS EDUARDO', '8º FUNDAMENTAL', 13, 3.5, 60, 'INAPTO'),
('BEATRIZ SOUZA', '3º MÉDIO', 17, 7.0, 80, 'APTO');

-- =====================================================
-- EXEMPLOS DE COMPETÊNCIAS PARA ALUNOS (OPCIONAL)
-- =====================================================

-- Adicionar algumas competências para os alunos de exemplo
INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes)
SELECT 
    a.id, 
    c.id, 
    CASE 
        WHEN a.nome = 'LUCAS SILVA' AND c.nome = 'Raciocínio Lógico' THEN 9.0
        WHEN a.nome = 'LUCAS SILVA' AND c.nome = 'Comunicação' THEN 8.5
        WHEN a.nome = 'LUCAS SILVA' AND c.nome = 'Liderança' THEN 9.5
        WHEN a.nome = 'MARIA OLIVEIRA' AND c.nome = 'Raciocínio Lógico' THEN 4.0
        WHEN a.nome = 'MARIA OLIVEIRA' AND c.nome = 'Comunicação' THEN 5.5
        WHEN a.nome = 'MARIA OLIVEIRA' AND c.nome = 'Organização' THEN 3.5
        WHEN a.nome = 'JOÃO PEDRO' AND c.nome = 'Raciocínio Lógico' THEN 6.0
        WHEN a.nome = 'JOÃO PEDRO' AND c.nome = 'Proatividade' THEN 7.0
        WHEN a.nome = 'ANA BEATRIZ' AND c.nome = 'Comunicação' THEN 8.5
        WHEN a.nome = 'ANA BEATRIZ' AND c.nome = 'Trabalho em Equipe' THEN 9.0
        WHEN a.nome = 'CARLOS EDUARDO' AND c.nome = 'Raciocínio Lógico' THEN 3.0
        WHEN a.nome = 'CARLOS EDUARDO' AND c.nome = 'Organização' THEN 4.0
        WHEN a.nome = 'BEATRIZ SOUZA' AND c.nome = 'Liderança' THEN 8.0
        WHEN a.nome = 'BEATRIZ SOUZA' AND c.nome = 'Comunicação' THEN 7.5
    END,
    'Avaliação inicial'
FROM alunos a, competencias c
WHERE 
    (a.nome = 'LUCAS SILVA' AND c.nome IN ('Raciocínio Lógico', 'Comunicação', 'Liderança')) OR
    (a.nome = 'MARIA OLIVEIRA' AND c.nome IN ('Raciocínio Lógico', 'Comunicação', 'Organização')) OR
    (a.nome = 'JOÃO PEDRO' AND c.nome IN ('Raciocínio Lógico', 'Proatividade')) OR
    (a.nome = 'ANA BEATRIZ' AND c.nome IN ('Comunicação', 'Trabalho em Equipe')) OR
    (a.nome = 'CARLOS EDUARDO' AND c.nome IN ('Raciocínio Lógico', 'Organização')) OR
    (a.nome = 'BEATRIZ SOUZA' AND c.nome IN ('Liderança', 'Comunicação'))
ON CONFLICT DO NOTHING;

-- =====================================================
-- CONSULTAS PARA VERIFICAR OS DADOS
-- =====================================================

-- Ver todos os usuários
SELECT * FROM usuarios;

-- Ver todos os alunos
SELECT * FROM alunos;

-- Ver competências disponíveis
SELECT * FROM competencias;

-- Ver competências dos alunos
SELECT 
    a.nome as aluno,
    c.nome as competencia,
    ac.nota,
    ac.observacoes,
    ac.data_registro
FROM aluno_competencias ac
JOIN alunos a ON ac.aluno_id = a.id
JOIN competencias c ON ac.competencia_id = c.id
ORDER BY a.nome, ac.nota DESC;