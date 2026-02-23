import pool from '../config/db.js';

export const buscarTodos = async () => {
    const query = `
        SELECT a.nome, a.turma, v.competencia, v.nivel_desempenho 
        FROM alunos a
        LEFT JOIN avaliacoes v ON a.id = v.aluno_id
    `;
    const res = await pool.query(query);
    return res.rows;
};