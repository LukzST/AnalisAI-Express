import * as alunoModel from '../models/alunoModel.js';

export const exibirDashboard = async (req, res) => {
    try {
        const alunos = await alunoModel.buscarTodos();
        res.render('index', { 
            title: 'SENAI CIC', 
            alunos,
            isDashboard: true
        });
    } catch (err) {
        console.error(err);
        res.send("Erro ao buscar dados.");
    }
};