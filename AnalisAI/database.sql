
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL
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