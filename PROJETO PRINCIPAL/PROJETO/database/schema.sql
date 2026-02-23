CREATE TABLE IF NOT EXISTS alunos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    turma VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS avaliacoes (
    id SERIAL PRIMARY KEY,
    aluno_id INTEGER REFERENCES alunos(id) ON DELETE CASCADE,
    competencia TEXT NOT NULL,
    nivel_desempenho VARCHAR(30), -- 'Apto', 'Em desenvolvimento', 'Inapto'
    media_competencia DECIMAL(4,2),
    frequencia INTEGER,
    observacoes TEXT,
    data_avaliacao DATE DEFAULT CURRENT_DATE
);