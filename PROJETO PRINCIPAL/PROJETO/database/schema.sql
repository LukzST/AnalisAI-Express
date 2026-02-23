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

INSERT INTO alunos (nome, turma) 
VALUES ('Lucas Silva', 'Técnico em TI - SENAI CIC');

INSERT INTO avaliacoes (aluno_id, competencia, nivel_desempenho, media_competencia, frequencia, observacoes)
VALUES (1, 'Lógica de Programação', 'Apto', 9.5, 100, 'Ótimo desempenho inicial');