
-- acho q novo 
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
    ano_escolar VARCHAR(50) NOT NULL CHECK (ano_escolar IN ('1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL')),
    idade INTEGER NOT NULL,
    nota DECIMAL(3,1) DEFAULT 0.0,
    presenca INTEGER DEFAULT 100,
    nivel VARCHAR(30) DEFAULT 'EM DESENVOLVIMENTO'
);

CREATE TABLE IF NOT EXISTS alunos_login (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    aluno_id INTEGER UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ATIVO',
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso TIMESTAMP,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
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
    aluno_id INTEGER NOT NULL,
    competencia_id INTEGER NOT NULL,
    nota DECIMAL(3,1) NOT NULL CHECK (nota >= 0 AND nota <= 10),
    observacoes TEXT,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE,
    FOREIGN KEY (competencia_id) REFERENCES competencias(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notas_detalhadas (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    titulo VARCHAR(100),
    descricao TEXT,
    valor DECIMAL(4,2),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tarefas (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    turma VARCHAR(50) NOT NULL,
    competencia_id INTEGER REFERENCES competencias(id) ON DELETE SET NULL,
    data_entrega DATE,
    prioridade VARCHAR(20) DEFAULT 'MEDIA',
    status VARCHAR(20) DEFAULT 'ATIVA',
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tarefas_alunos (
    id SERIAL PRIMARY KEY,
    tarefa_id INTEGER NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    nota DECIMAL(3,1) CHECK (nota >= 0 AND nota <= 10),
    feedback TEXT,
    resposta_texto TEXT,
    resposta_arquivo VARCHAR(255),
    data_entrega TIMESTAMP,
    data_avaliacao TIMESTAMP,
    UNIQUE(tarefa_id, aluno_id)
);
CREATE TABLE IF NOT EXISTS notificacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensagem TEXT,
    link VARCHAR(255),
    icone VARCHAR(50) DEFAULT 'fas fa-bell',
    cor VARCHAR(20) DEFAULT '#ff0101',
    lida BOOLEAN DEFAULT FALSE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (usuario_id IS NOT NULL AND aluno_id IS NULL) OR
        (usuario_id IS NULL AND aluno_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS configuracoes_notificacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    notificacoes_ativas BOOLEAN DEFAULT TRUE,
    notificacoes_email BOOLEAN DEFAULT FALSE,
    notificacoes_tarefas BOOLEAN DEFAULT TRUE,
    notificacoes_avaliacoes BOOLEAN DEFAULT TRUE,
    notificacoes_competencias BOOLEAN DEFAULT TRUE,
    CHECK (
        (usuario_id IS NOT NULL AND aluno_id IS NULL) OR
        (usuario_id IS NULL AND aluno_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS calendario_eventos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(50) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE,
    turma VARCHAR(50),
    cor VARCHAR(20) DEFAULT '#ff0101',
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feriados (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    data DATE NOT NULL,
    recorrente BOOLEAN DEFAULT FALSE,
    UNIQUE(data, nome)
);

CREATE TABLE IF NOT EXISTS solicitacoes_senha (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    email VARCHAR(100) NOT NULL,
    token VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_resposta TIMESTAMP,
    respondido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calendario_data ON calendario_eventos(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_calendario_turma ON calendario_eventos(turma);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id, lida, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_aluno ON notificacoes(aluno_id, lida, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_alunos_login_email ON alunos_login(email);
CREATE INDEX IF NOT EXISTS idx_alunos_login_matricula ON alunos_login(matricula);
CREATE INDEX IF NOT EXISTS idx_alunos_login_aluno ON alunos_login(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_aluno ON aluno_competencias(aluno_id);
CREATE INDEX IF NOT EXISTS idx_aluno_competencias_comp ON aluno_competencias(competencia_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_turma ON tarefas(turma);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_alunos_aluno ON tarefas_alunos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_alunos_tarefa ON tarefas_alunos(tarefa_id);

UPDATE alunos_login SET ultimo_acesso = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' WHERE aluno_id = $1

INSERT INTO usuarios (nome, email, senha, cargo, status) 
VALUES ('Lucas Eduardo', 'lucaseduarte6@gmail.com', 'Lucas2018', 'Admin', 'ATIVO')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE alunos_login 
ADD CONSTRAINT check_nome_sem_numeros 
CHECK (nome !~ '[0-9]');

ALTER TABLE alunos_login 
ADD CONSTRAINT check_nome_sem_especiais 
CHECK (nome ~ '^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$');

ALTER TABLE alunos 
ADD CONSTRAINT check_nome_sem_numeros 
CHECK (nome !~ '[0-9]');

ALTER TABLE alunos 
ADD CONSTRAINT check_nome_sem_especiais 
CHECK (nome ~ '^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$');

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

INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES 
('LUCAS SILVA', '3º MÉDIO', 17, 9.5, 100, 'APTO'),
('MARIA OLIVEIRA', '2º MÉDIO', 16, 4.2, 85, 'INAPTO'),
('JOÃO PEDRO', '1º MÉDIO', 15, 6.5, 90, 'EM DESENVOLVIMENTO'),
('ANA BEATRIZ', '9º FUNDAMENTAL', 14, 8.0, 95, 'APTO'),
('CARLOS EDUARDO', '8º FUNDAMENTAL', 13, 3.5, 60, 'INAPTO'),
('BEATRIZ SOUZA', '3º MÉDIO', 17, 7.0, 80, 'APTO');

DO $$
DECLARE
    aluno_id INTEGER;
BEGIN
    SELECT id INTO aluno_id FROM alunos WHERE nome = 'LUCAS SILVA' LIMIT 1;
    
    IF aluno_id IS NOT NULL THEN
        INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status) 
        VALUES ('LUCAS SILVA', 'lucas.silva@aluno.analisai.com', 'aluno123', 'ALU2024001', aluno_id, 'ATIVO')
        ON CONFLICT (email) DO NOTHING;
    END IF;
END $$;

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
