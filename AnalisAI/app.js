const express = require('express');
const session = require('express-session');
const db = require('./db'); 
const app = express();
const favicon = require('serve-favicon');
const path = require('path');
const flash = require('connect-flash');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'chave-secreta-meu-site',
  resave: false,
  saveUninitialized: true
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

function checkAuth(req, res, next) {
  if (req.session.user && req.session.userStatus === 'ATIVO') {
    next();
  } else {
    req.session.destroy();
    res.redirect('/login');
  }
}

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

app.get('/termos', (req, res) => {
  res.render('termos');
});

app.get('/cadastro', (req, res) => {
  res.render('cadastro', { erro: null });
});

app.post('/cadastro', async (req, res) => {
  const { nome, usuario, senha, confirmar_senha } = req.body;

  if (senha !== confirmar_senha) {
    return res.render('cadastro', { erro: 'As senhas não coincidem!' });
  }

  if (senha.length < 6) {
    return res.render('cadastro', { erro: 'A senha deve ter no mínimo 6 caracteres!' });
  }

  try {
    await db.query(
      'INSERT INTO usuarios (nome, email, senha, status, cargo) VALUES ($1, $2, $3, $4, $5)',
      [nome, usuario, senha, 'ATIVO', 'Professor']
    );
    res.redirect('/login');
  } catch (err) {
    if (err.code === '23505') {
      res.render('cadastro', { erro: 'Este e-mail já está cadastrado!' });
    } else {
      res.render('cadastro', { erro: 'Erro ao realizar cadastro.' });
    }
  }
});

app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [usuario]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      if (user.status !== 'ATIVO') {
        return res.render('login', { erro: 'Sua conta está inativa. Contate o administrador.' });
      }

      if (senha === user.senha) {
        req.session.user = user.nome;
        req.session.userStatus = user.status;
        req.session.userId = user.id;
        return res.redirect('/dashboard');
      }
    }
    res.render('login', { erro: 'Usuário ou senha inválidos!' });
  } catch (err) {
    res.render('login', { erro: 'Erro ao conectar ao banco de dados.' });
  }
});

app.get('/dashboard', checkAuth, async (req, res) => {
    try {
        const alunosResult = await db.query('SELECT * FROM alunos');
        const alunos = alunosResult.rows;

        const rankingGeralResult = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);

        const rankingMedioResult = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            LEFT JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar LIKE '%MÉDIO%'
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);

        const rankingFundamentalResult = await db.query(`
            SELECT 
                c.nome,
                COALESCE(AVG(ac.nota), 0) as media,
                COUNT(ac.id) as total_avaliacoes
            FROM competencias c
            LEFT JOIN aluno_competencias ac ON c.id = ac.competencia_id
            LEFT JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar LIKE '%FUNDAMENTAL%'
            GROUP BY c.id, c.nome
            HAVING COUNT(ac.id) > 0
            ORDER BY media DESC
        `);

        const rankingGeral = rankingGeralResult.rows.map(item => ({
            ...item,
            media: parseFloat(item.media) || 0
        }));

        const rankingMedio = rankingMedioResult.rows.map(item => ({
            ...item,
            media: parseFloat(item.media) || 0
        }));

        const rankingFundamental = rankingFundamentalResult.rows.map(item => ({
            ...item,
            media: parseFloat(item.media) || 0
        }));

        res.render('dashboard/main', { 
            user: req.session.user, 
            alunos: alunos,
            rankingGeral: rankingGeral,
            rankingMedio: rankingMedio,
            rankingFundamental: rankingFundamental
        });

    } catch (err) {
        console.error(err);
        res.render('dashboard/main', { 
            user: req.session.user, 
            alunos: [],
            rankingGeral: [],
            rankingMedio: [],
            rankingFundamental: []
        });
    }
});

app.get('/dashboard/edit', checkAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', nd.id,
                                'titulo', nd.titulo,
                                'descricao', nd.descricao,
                                'valor', nd.valor,
                                'data_criacao', nd.data_criacao
                            ) ORDER BY nd.id ASC
                        )
                        FROM notas_detalhadas nd
                        WHERE nd.aluno_id = a.id
                    ), 
                    '[]'::json
                ) as notas_individuais,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', ac.id,
                                'competencia_id', ac.competencia_id,
                                'nome', c.nome,
                                'descricao', c.descricao,
                                'categoria', c.categoria,
                                'nota', ac.nota,
                                'observacoes', ac.observacoes,
                                'data_registro', ac.data_registro
                            ) ORDER BY ac.id ASC
                        )
                        FROM aluno_competencias ac
                        JOIN competencias c ON ac.competencia_id = c.id
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
            ORDER BY a.id ASC
        `);

        const competenciasList = await db.query(`
            SELECT id, nome, descricao, categoria
            FROM competencias 
            ORDER BY id ASC
        `);

        res.render('dashboard/edit', { 
            alunos: result.rows,
            listaCompetencias: competenciasList.rows,
            user: req.session.user 
        });

    } catch (err) {
        console.error("ERRO NO DASHBOARD EDIT:", err);
        res.status(500).render('error', { 
            message: "Não foi possível carregar os dados do painel pedagógico.",
            error: err 
        });
    }
});

app.get('/dashboard/competencias-aluno/:id', checkAuth, async (req, res) => {
    const alunoId = req.params.id;
    
    try {
        const result = await db.query(`
            SELECT 
                ac.*, 
                c.nome, 
                c.descricao as competencia_desc,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `, [alunoId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar competências:', error);
        res.status(500).json({ error: 'Erro ao buscar competências' });
    }
});

app.post('/dashboard/adicionar-competencia', checkAuth, async (req, res) => {
    const { aluno_id, competencia_id, nota, observacoes } = req.body;
    
    if (!aluno_id || !competencia_id || !nota) {
        req.flash('error_msg', 'Todos os campos obrigatórios devem ser preenchidos');
        return res.redirect('/dashboard/edit');
    }

    if (nota < 0 || nota > 10) {
        req.flash('error_msg', 'A nota deve estar entre 0 e 10');
        return res.redirect('/dashboard/edit');
    }
    
    try {
        await db.query(
            'INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes) VALUES ($1, $2, $3, $4)',
            [aluno_id, competencia_id, nota, observacoes || null]
        );
        
        req.flash('success_msg', 'Competência adicionada com sucesso!');
        res.redirect('/dashboard/edit');
    } catch (error) {
        console.error('Erro ao adicionar competência:', error);
        req.flash('error_msg', 'Erro ao adicionar competência');
        res.redirect('/dashboard/edit');
    }
});

app.get('/dashboard/deletar-competencia/:id', checkAuth, async (req, res) => {
    const compId = req.params.id;
    
    try {
        await db.query('DELETE FROM aluno_competencias WHERE id = $1', [compId]);
        req.flash('success_msg', 'Competência removida com sucesso');
        res.redirect('/dashboard/edit');
    } catch (error) {
        console.error('Erro ao deletar competência:', error);
        req.flash('error_msg', 'Erro ao deletar competência');
        res.redirect('/dashboard/edit');
    }
});

app.post('/dashboard/atualizar-presenca', checkAuth, async (req, res) => {
    const { aluno_id, presenca } = req.body;
    
    try {
        await db.query('UPDATE alunos SET presenca = $1 WHERE id = $2', [presenca, aluno_id]);
        req.flash('success_msg', 'Presença atualizada com sucesso!');
        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao atualizar presença');
        res.redirect('/dashboard/edit');
    }
});

app.post('/dashboard/add-aluno', checkAuth, async (req, res) => {
    const { nome, ano_escolar, idade } = req.body;
    try {
        await db.query(
            'INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES ($1, $2, $3, $4, $5, $6)', 
            [nome, ano_escolar, idade, 0, 100, 'EM DESENVOLVIMENTO']
        );

        res.redirect('/dashboard/edit');
    } catch (err) { 
        console.error(err);
        res.status(500).send("Erro ao adicionar aluno"); 
    }
});

app.get('/dashboard/delete-aluno/:id', checkAuth, async (req, res) => {
    const id = req.params.id;
    
    try {
        await db.query('DELETE FROM alunos WHERE id = $1', [id]);
        const checkEmpty = await db.query('SELECT COUNT(*) FROM alunos');
        
        if (parseInt(checkEmpty.rows[0].count) === 0) {
            await db.query('ALTER SEQUENCE alunos_id_seq RESTART WITH 1');
        } else {
            await db.query("SELECT setval('alunos_id_seq', (SELECT MAX(id) FROM alunos))");
        }

        req.flash('success_msg', 'Aluno removido e IDs reajustados!');
        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao remover aluno.');
        res.redirect('/dashboard/edit');
    }
});

app.post('/dashboard/erase-all', checkAuth, async (req, res) => {
    try {
        await db.query('TRUNCATE TABLE aluno_competencias RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE notas_detalhadas RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE alunos RESTART IDENTITY CASCADE');
        
        req.flash('success_msg', 'Todos os dados foram apagados e os IDs foram resetados!');
        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao apagar os dados');
        res.redirect('/dashboard/edit');
    }
});

app.get('/dashboard/graficos', checkAuth, async (req, res) => {
    try {
        const alunosResult = await db.query(`
            SELECT 
                a.*,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'nota', ac.nota
                            )
                        )
                        FROM aluno_competencias ac
                        WHERE ac.aluno_id = a.id
                    ),
                    '[]'::json
                ) as competencias
            FROM alunos a
        `);

        const alunos = alunosResult.rows;
        
        let total = 0;
        let apto = 0;
        let inapto = 0;
        let somaMedio = 0;
        let countMedio = 0;
        let somaFundamental = 0;
        let countFundamental = 0;

        alunos.forEach(aluno => {
            total++;
            
            let mediaCompetencias = 0;
            if (aluno.competencias && aluno.competencias.length > 0) {
                const soma = aluno.competencias.reduce((acc, comp) => acc + parseFloat(comp.nota), 0);
                mediaCompetencias = soma / aluno.competencias.length;
            }

            if (mediaCompetencias >= 7 && aluno.presenca >= 75) {
                apto++;
            } else if (mediaCompetencias < 5 || aluno.presenca < 50) {
                inapto++;
            }

            if (aluno.ano_escolar.includes('MÉDIO')) {
                somaMedio += mediaCompetencias;
                countMedio++;
            } else if (aluno.ano_escolar.includes('FUNDAMENTAL')) {
                somaFundamental += mediaCompetencias;
                countFundamental++;
            }
        });

        const stats = {
            total: total,
            apto: apto,
            inapto: inapto,
            mediaMedio: countMedio > 0 ? (somaMedio / countMedio).toFixed(1) : 0,
            mediaFundamental: countFundamental > 0 ? (somaFundamental / countFundamental).toFixed(1) : 0
        };

        res.render('dashboard/graficos', { stats });

    } catch (err) {
        console.error(err);
        res.render('dashboard/graficos', { 
            stats: {
                total: 0,
                apto: 0,
                inapto: 0,
                mediaMedio: 0,
                mediaFundamental: 0
            }
        });
    }
});

app.get('/dashboard/equipe', checkAuth, (req, res) => {
  res.render('dashboard/equipe');
});

app.get('/dashboard/usuarios', checkAuth, async (req, res) => {
    try {
        const result = await db.query('SELECT id, nome, email, cargo, status FROM usuarios ORDER BY nome ASC');
        res.render('dashboard/usuarios', { usuarios: result.rows });
    } catch (err) {
        res.status(500).send("Erro ao carregar usuários");
    }
});

app.post('/dashboard/usuarios/add', checkAuth, async (req, res) => {
    const { nome, email, senha, cargo } = req.body;
    try {
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, cargo, status) VALUES ($1, $2, $3, $4, $5)',
            [nome, email, senha, cargo, 'ATIVO']
        );
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        res.status(500).send("Erro ao cadastrar usuário");
    }
});

app.post('/dashboard/usuarios/update', checkAuth, async (req, res) => {
    const { id, nome, email, cargo, status } = req.body;
    try {
        await db.query(
            'UPDATE usuarios SET nome=$1, email=$2, cargo=$3, status=$4 WHERE id=$5',
            [nome, email, cargo, status, id]
        );
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        res.status(500).send("Erro ao atualizar usuário");
    }
});

app.get('/dashboard/usuarios/delete/:id', checkAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        res.status(500).send("Erro ao excluir usuário");
    }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));