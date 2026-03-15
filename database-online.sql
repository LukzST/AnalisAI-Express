CREATE TABLE IF NOT EXISTS usuarios (
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
    ano_escolar VARCHAR(20) NOT NULL CHECK (ano_escolar IN ('1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL')),
    idade INTEGER NOT NULL,
    nota DECIMAL(3,1) DEFAULT 0.0,
    presenca INTEGER DEFAULT 100,
    nivel VARCHAR(20) DEFAULT 'EM DESENVOLVIMENTO' CHECK (nivel IN ('APTO', 'INAPTO', 'EM DESENVOLVIMENTO'))
);

CREATE TABLE IF NOT EXISTS notas_detalhadas (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    titulo VARCHAR(100),
    descricao TEXT,
    valor DECIMAL(4,2) CHECK (valor >= 0 AND valor <= 10),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competencias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    categoria VARCHAR(50) DEFAULT 'Técnica',
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aluno_competencias (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    competencia_id INTEGER NOT NULL REFERENCES competencias(id) ON DELETE CASCADE,
    nota DECIMAL(3,1) NOT NULL CHECK (nota >= 0 AND nota <= 10),
    observacoes TEXT,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aluno_competencias_aluno ON aluno_competencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_comp ON aluno_competencias(competencia_id);
CREATE INDEX IF NOT EXISTS idx_notas_aluno ON notas_detalhadas(aluno_id);

INSERT INTO usuarios (nome, email, senha) 
VALUES ('Lucas Eduardo', 'lucaseduarte6@gmail.com', '123456789')
ON CONFLICT (email) DO NOTHING;

INSERT INTO competencias (nome, descricao, categoria) VALUES
('Raciocínio Lógico', 'Capacidade de resolver problemas usando lógica', 'Cognitiva'),
('Comunicação', 'Habilidade de expressar ideias de forma clara', 'Comportamental'),
('Trabalho em Equipe', 'Capacidade de colaborar em grupo', 'Socioemocional'),
('Proatividade', 'Iniciativa para realizar tarefas', 'Comportamental'),
('Criatividade', 'Capacidade de pensar em soluções inovadoras', 'Cognitiva'),
('Liderança', 'Habilidade de influenciar pessoas', 'Socioemocional'),
('Organização', 'Capacidade de planejar atividades', 'Comportamental'),
('Pensamento Crítico', 'Análise fundamentada de situações', 'Cognitiva'),
('Resiliência', 'Capacidade de superar desafios', 'Socioemocional'),
('Ética', 'Compromisso com valores morais', 'Comportamental')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES 
('JOÃO PEDRO', '1º MÉDIO', 15, 6.5, 90, 'EM DESENVOLVIMENTO');

INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes)
SELECT 
    (SELECT id FROM alunos WHERE nome = 'JOÃO PEDRO'),
    c.id,
    CASE c.nome
        WHEN 'Raciocínio Lógico' THEN 6.0
        WHEN 'Comunicação' THEN 7.5
        WHEN 'Proatividade' THEN 7.0
        WHEN 'Trabalho em Equipe' THEN 8.0
        WHEN 'Organização' THEN 5.5
    END,
    'Avaliação inicial'
FROM competencias c
WHERE c.nome IN ('Raciocínio Lógico', 'Comunicação', 'Proatividade', 'Trabalho em Equipe', 'Organização');