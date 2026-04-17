const MobileDetect = require('mobile-detect');
const express = require('express');
const session = require('express-session');
const db = require('./db'); 
const app = express();
const favicon = require('serve-favicon');
const path = require('path');
const flash = require('connect-flash');
const fs = require('fs')
const crypto = require('crypto');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'tarefa-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, 
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido'));
        }
    }
});

app.use(favicon(path.join(__dirname, 'Public', 'favicon.ico')));
app.set('view engine', 'ejs');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('Public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

function checkAdmin(req, res, next) {
  if (req.session.userCargo === 'Admin') {
    next();
  } else {
    req.flash('error_msg', 'Acesso negado. Apenas administradores podem gerenciar usuários.');
    res.redirect('/dashboard');
  }
}

function checkAlunoAuth(req, res, next) {
  if (req.session.aluno) {
    next();
  } else {
    res.redirect('/login');
  }
}


app.use((req, res, next) => {
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return next();
    }
    
    const ignoreRoutes = ['/logout', '/api/', '/auth/'];
    if (ignoreRoutes.some(route => req.path.startsWith(route))) {
        return next();
    }
    
    const userAgent = req.headers['user-agent'];
    const md = new MobileDetect(userAgent);
    
    const isMobile = !!md.mobile();
    const isTablet = !!md.tablet();
    
    if (isMobile || isTablet) {
        if (req.path !== '/mobile-warning' && !req.session.ignoredWarning) {
            req.session.originalUrl = req.originalUrl;
            return res.redirect('/mobile-warning');
        }
    }
    
    next();
});

async function criarNotificacao(tipo, usuarioId, alunoId, titulo, mensagem, link, icone = 'fas fa-bell', cor = '#ff0101') {
    try {
        await db.query(
            `INSERT INTO notificacoes (usuario_id, aluno_id, tipo, titulo, mensagem, link, icone, cor) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [usuarioId || null, alunoId || null, tipo, titulo, mensagem, link, icone, cor]
        );
    } catch (err) {
        console.error('Erro ao criar notificação:', err);
    }
}

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/termos', (req, res) => {
  res.render('termos');
});

app.get('/manual-de-uso', (req, res) => {
  res.render('manual-de-uso', {
    userCargo: req.session.userCargo,
    isAdmin: req.session.userCargo === 'Admin'
  });
});

app.get('/manual-do-aluno', (req, res) => {
  res.render('manual-do-aluno', {
    userCargo: req.session.userCargo,
    isAdmin: req.session.userCargo === 'Admin'
  });
});

app.get('/cadastro', (req, res) => {
  res.render('cadastro', { erro: null });
});

app.post('/cadastro', async (req, res) => {
  const { nome, usuario, senha, confirmar_senha } = req.body;
  if (senha !== confirmar_senha) {
    req.flash('error_msg', 'As senhas não coincidem!');
    return res.redirect('/cadastro');
  }
  if (senha.length < 6) {
    req.flash('error_msg', 'A senha deve ter no mínimo 6 caracteres!');
    return res.redirect('/cadastro');
  }
  try {
    await db.query(
      'INSERT INTO usuarios (nome, email, senha, status, cargo) VALUES ($1, $2, $3, $4, $5)',
      [nome, usuario, senha, 'ATIVO', 'Professor']
    );
    req.flash('success_msg', 'Cadastro realizado com sucesso! Faça login.');
    res.redirect('/login');
  } catch (err) {
    if (err.code === '23505') {
      req.flash('error_msg', 'Este e-mail já está cadastrado!');
    } else {
      req.flash('error_msg', 'Erro ao realizar cadastro.');
    }
    res.redirect('/cadastro');
  }
});

app.get('/login', (req, res) => {
    const tipo = req.query.tipo || 'professor';
    res.render('login', {
        error_msg: req.flash('error_msg')[0],
        success_msg: req.flash('success_msg')[0],
        tipo: tipo
    });
});

app.post('/login/professor', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [usuario]);
        if (result.rows.length === 0) {
            req.flash('error_msg', 'E-mail não encontrado');
            return res.render('login', { error_msg: req.flash('error_msg')[0], success_msg: null, tipo: 'professor' });
        }
        const user = result.rows[0];
        if (user.status !== 'ATIVO') {
            req.flash('error_msg', 'Sua conta está inativa. Contate o administrador.');
            return res.render('login', { error_msg: req.flash('error_msg')[0], success_msg: null, tipo: 'professor' });
        }
        if (senha !== user.senha) {
            req.flash('error_msg', 'Senha incorreta');
            return res.render('login', { error_msg: req.flash('error_msg')[0], success_msg: null, tipo: 'professor' });
        }
        req.session.user = user.nome;
        req.session.userStatus = user.status;
        req.session.userId = user.id;
        req.session.userCargo = user.cargo;
        req.flash('success_msg', `Bem-vindo, ${user.nome}!`);
        return res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao conectar ao banco de dados.');
        return res.render('login', { error_msg: req.flash('error_msg')[0], success_msg: null, tipo: 'professor' });
    }
});

app.post('/login/aluno', async (req, res) => {
    const { matricula, email, senha } = req.body;
    const tipo = 'aluno';
    
    if (!matricula && !email) {
        req.flash('error_msg', 'Informe matrícula ou e-mail');
        return res.render('login', {
            error_msg: req.flash('error_msg')[0],
            success_msg: null,
            tipo: tipo
        });
    }

    try {
        let query;
        let params;
        
        if (matricula) {
            query = 'SELECT * FROM alunos_login WHERE matricula = $1';
            params = [matricula];
        } else {
            query = 'SELECT * FROM alunos_login WHERE email = $1';
            params = [email];
        }
        
        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            req.flash('error_msg', 'Matrícula/E-mail não encontrado');
            return res.render('login', {
                error_msg: req.flash('error_msg')[0],
                success_msg: null,
                tipo: tipo
            });
        }

        const aluno = result.rows[0];
        
        if (aluno.status !== 'ATIVO') {
            req.flash('error_msg', 'Acesso bloqueado. Contate a secretaria.');
            return res.render('login', {
                error_msg: req.flash('error_msg')[0],
                success_msg: null,
                tipo: tipo
            });
        }

        if (senha !== aluno.senha) {
            req.flash('error_msg', 'Senha incorreta');
            return res.render('login', {
                error_msg: req.flash('error_msg')[0],
                success_msg: null,
                tipo: tipo
            });
        }

        const alunoDados = await db.query(
            'SELECT id, nome, ano_escolar, presenca FROM alunos WHERE id = $1',
            [aluno.aluno_id]
        );

        if (alunoDados.rows.length === 0) {
            req.flash('error_msg', 'Erro ao carregar dados do aluno');
            return res.render('login', {
                error_msg: req.flash('error_msg')[0],
                success_msg: null,
                tipo: tipo
            });
        }

        const dados = alunoDados.rows[0];

        req.session.aluno = {
            id: aluno.aluno_id,
            nome: aluno.nome,
            matricula: aluno.matricula,
            ano_escolar: dados.ano_escolar,
            login_id: aluno.id
        };

        req.flash('success_msg', `Bem-vindo, ${aluno.nome}!`);
        return res.redirect('/aluno/dashboard');

    } catch (err) {
        console.error('ERRO NO LOGIN DO ALUNO:', err);
        req.flash('error_msg', 'Erro ao conectar ao banco de dados.');
        return res.render('login', {
            error_msg: req.flash('error_msg')[0],
            success_msg: null,
            tipo: tipo
        });
    }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/dashboard', checkAuth, async (req, res) => {
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
            ORDER BY a.nome ASC
        `);
        const alunos = alunosResult.rows;
        const alunosComNivel = alunos.map(aluno => {
            let mediaCompetencias = 0;
            if (aluno.competencias && aluno.competencias.length > 0) {
                const soma = aluno.competencias.reduce((acc, comp) => acc + parseFloat(comp.nota), 0);
                mediaCompetencias = soma / aluno.competencias.length;
            }
            let nivel = 'EM DESENVOLVIMENTO';
            if (mediaCompetencias >= 7 && aluno.presenca >= 75) {
                nivel = 'APTO';
            } else if (mediaCompetencias < 5 || aluno.presenca < 50) {
                nivel = 'INAPTO';
            }
            return {
                ...aluno,
                nivel: nivel,
                media_competencias: mediaCompetencias.toFixed(1)
            };
        });
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
            alunos: alunosComNivel,
            rankingGeral: rankingGeral,
            rankingMedio: rankingMedio,
            rankingFundamental: rankingFundamental,
            userCargo: req.session.userCargo,
            isAdmin: req.session.userCargo === 'Admin'
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao carregar dados do dashboard');
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
            user: req.session.user,
            userCargo: req.session.userCargo,
            isAdmin: req.session.userCargo === 'Admin'
        });
    } catch (err) {
        console.error("ERRO NO DASHBOARD EDIT:", err);
        req.flash('error_msg', 'Não foi possível carregar os dados');
        res.redirect('/dashboard');
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
        res.render('dashboard/graficos', { 
            stats ,
            userCargo: req.session.userCargo,
            isAdmin: req.session.userCargo === 'Admin'
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao carregar gráficos');
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

app.get('/dashboard/usuarios', checkAuth, checkAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT id, nome, email, cargo, status FROM usuarios ORDER BY nome ASC');
        const isAdmin = req.session.userCargo === 'Admin';
        const userCargo = req.session.userCargo;
        const userId = req.session.userId;
        const user = req.session.user;
        res.render('dashboard/usuarios', { 
            usuarios: result.rows,
            isAdmin: isAdmin,
            userCargo: userCargo,
            userId: userId,
            user: user,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao carregar usuários');
        res.redirect('/dashboard');
    }
});

app.post('/dashboard/usuarios/add', checkAuth, checkAdmin, async (req, res) => {
    const { nome, email, senha, cargo } = req.body;
    try {
        await db.query(
            'INSERT INTO usuarios (nome, email, senha, cargo, status) VALUES ($1, $2, $3, $4, $5)',
            [nome, email, senha, cargo, 'ATIVO']
        );
        req.flash('success_msg', 'Usuário cadastrado com sucesso!');
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        req.flash('error_msg', 'Erro ao cadastrar usuário');
        res.redirect('/dashboard/usuarios');
    }
});

app.post('/dashboard/usuarios/update', checkAuth, checkAdmin, async (req, res) => {
    const { id, nome, email, cargo, status } = req.body;
    try {
        await db.query(
            'UPDATE usuarios SET nome=$1, email=$2, cargo=$3, status=$4 WHERE id=$5',
            [nome, email, cargo, status, id]
        );
        req.flash('success_msg', 'Usuário atualizado com sucesso!');
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        req.flash('error_msg', 'Erro ao atualizar usuário');
        res.redirect('/dashboard/usuarios');
    }
});

app.get('/dashboard/usuarios/delete/:id', checkAuth, checkAdmin, async (req, res) => {
    try {
        await db.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
        req.flash('success_msg', 'Usuário removido com sucesso!');
        res.redirect('/dashboard/usuarios');
    } catch (err) {
        req.flash('error_msg', 'Erro ao excluir usuário');
        res.redirect('/dashboard/usuarios');
    }
});

app.get('/dashboard/tarefas', checkAuth, async (req, res) => {
    try {
        const turmaFilter = req.query.turma || '';
        const statusFilter = req.query.status || '';
        let query = `
            SELECT 
                t.*,
                u.nome as professor_nome,
                COUNT(ta.id) as total_alunos,
                COUNT(CASE WHEN ta.status = 'CONCLUIDA' THEN 1 END) as concluidas,
                COUNT(CASE WHEN ta.status = 'ENTREGUE' THEN 1 END) as entregues,
                COUNT(CASE WHEN ta.status = 'DEVOLVIDA' THEN 1 END) as devolvidas,
                COUNT(CASE WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN 1 END) as atrasadas,
                COUNT(CASE WHEN ta.status = 'PENDENTE' AND t.data_entrega >= CURRENT_DATE THEN 1 END) as pendentes
            FROM tarefas t
            LEFT JOIN usuarios u ON t.criado_por = u.id
            LEFT JOIN tarefas_alunos ta ON t.id = ta.tarefa_id
            WHERE 1=1
        `;
        const params = [];
        if (turmaFilter) {
            params.push(turmaFilter);
            query += ` AND t.turma = $${params.length}`;
        }
        if (statusFilter) {
            params.push(statusFilter);
            query += ` AND t.status = $${params.length}`;
        }
        query += ` GROUP BY t.id, u.nome ORDER BY 
                    CASE 
                        WHEN t.status = 'ATIVA' THEN 1
                        ELSE 2
                    END,
                    t.data_criacao DESC`;
        const tarefasResult = await db.query(query, params);
        const alunosResult = await db.query(`
            SELECT id, nome, ano_escolar 
            FROM alunos 
            ORDER BY nome ASC
        `);
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'ATIVA' THEN 1 END) as ativas,
                COUNT(CASE WHEN data_entrega < CURRENT_DATE AND status = 'ATIVA' THEN 1 END) as atrasadas,
                (
                    SELECT COUNT(*) 
                    FROM tarefas_alunos 
                    WHERE status = 'ENTREGUE'
                ) as aguardando_correcao
            FROM tarefas
        `);
        const competenciasResult = await db.query(
            'SELECT id, nome FROM competencias ORDER BY nome ASC'
        );
        res.render('dashboard/tarefas', {
            tarefas: tarefasResult.rows,
            alunos: alunosResult.rows,
            stats: statsResult.rows[0],
            user: req.session.user,
            userCargo: req.session.userCargo,
            listaCompetencias: competenciasResult.rows,
            filtros: { turma: turmaFilter, status: statusFilter }
        });
    } catch (err) {
        console.error('Erro ao carregar tarefas:', err);
        req.flash('error_msg', 'Erro ao carregar tarefas');
        res.redirect('/dashboard');
    }
});

app.post('/dashboard/tarefas/criar', checkAuth, async (req, res) => {
    const { titulo, descricao, turma, data_entrega, prioridade, alunos, competencia_id } = req.body;
    if (!titulo || !turma) {
        req.flash('error_msg', 'Título e turma são obrigatórios');
        return res.redirect('/dashboard/tarefas');
    }
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const tarefaResult = await client.query(
            `INSERT INTO tarefas (titulo, descricao, turma, data_entrega, prioridade, competencia_id, criado_por, data_atualizacao) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) RETURNING id`,
            [titulo, descricao, turma, data_entrega || null, prioridade || 'MEDIA', competencia_id || null, req.session.userId]
        );
        const tarefaId = tarefaResult.rows[0].id;
        if (alunos && alunos.length > 0) {
            for (const alunoId of alunos) {
                await client.query(
                    `INSERT INTO tarefas_alunos (tarefa_id, aluno_id, status) VALUES ($1, $2, 'PENDENTE')`,
                    [tarefaId, alunoId]
                );
                await criarNotificacao(
                    'tarefa',
                    null,
                    alunoId,
                    'Nova Tarefa',
                    `Você recebeu uma nova tarefa: ${titulo}`,
                    `/aluno/tarefas`,
                    'fas fa-tasks',
                    '#217346'
                );
            }
        } else {
            const alunosTurma = await client.query(
                'SELECT id FROM alunos WHERE ano_escolar = $1',
                [turma]
            );
            for (const aluno of alunosTurma.rows) {
                await client.query(
                    `INSERT INTO tarefas_alunos (tarefa_id, aluno_id, status) VALUES ($1, $2, 'PENDENTE')`,
                    [tarefaId, aluno.id]
                );
                await criarNotificacao(
                    'tarefa',
                    null,
                    aluno.id,
                    'Nova Tarefa',
                    `Você recebeu uma nova tarefa: ${titulo}`,
                    `/aluno/tarefas`,
                    'fas fa-tasks',
                    '#217346'
                );
            }
        }
        await client.query('COMMIT');
        req.flash('success_msg', 'Tarefa criada com sucesso!');
        res.redirect('/dashboard/tarefas');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar tarefa:', err);
        req.flash('error_msg', 'Erro ao criar tarefa');
        res.redirect('/dashboard/tarefas');
    } finally {
        client.release();
    }
});

app.post('/dashboard/tarefas/avaliar-aluno', checkAuth, async (req, res) => {
    const { tarefa_id, aluno_id, nota, feedback } = req.body;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE tarefas_alunos 
             SET nota = $1, feedback = $2, status = 'CONCLUIDA', data_avaliacao = CURRENT_TIMESTAMP
             WHERE tarefa_id = $3 AND aluno_id = $4`,
            [nota, feedback, tarefa_id, aluno_id]
        );
        const tarefa = await client.query(
            'SELECT competencia_id FROM tarefas WHERE id = $1',
            [tarefa_id]
        );
        let virouCompetencia = false;
        if (tarefa.rows[0].competencia_id) {
            await client.query(
                `INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes)
                 VALUES ($1, $2, $3, $4)`,
                [aluno_id, tarefa.rows[0].competencia_id, nota, `Avaliado via tarefa ID ${tarefa_id}`]
            );
            virouCompetencia = true;
            const media = await client.query(
                'SELECT AVG(nota) as media FROM aluno_competencias WHERE aluno_id = $1',
                [aluno_id]
            );
            if (media.rows[0].media) {
                await client.query(
                    'UPDATE alunos SET nota = $1 WHERE id = $2',
                    [media.rows[0].media, aluno_id]
                );
            }
        }
        await criarNotificacao(
            'avaliacao',
            null,
            aluno_id,
            'Tarefa Avaliada',
            `Sua tarefa foi avaliada com nota ${nota}`,
            `/aluno/tarefas`,
            'fas fa-star',
            '#217346'
        );
        await client.query('COMMIT');
        res.json({ success: true, virouCompetencia: virouCompetencia });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao avaliar tarefa:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

app.post('/dashboard/tarefas/devolver-aluno', checkAuth, async (req, res) => {
    const { tarefa_id, aluno_id } = req.body;
    try {
        await db.query(
            `UPDATE tarefas_alunos 
             SET status = 'DEVOLVIDA', nota = NULL, feedback = NULL, data_avaliacao = NULL
             WHERE tarefa_id = $1 AND aluno_id = $2`,
            [tarefa_id, aluno_id]
        );
        await criarNotificacao(
            'devolucao',
            null,
            aluno_id,
            'Tarefa Devolvida',
            `Sua tarefa foi devolvida para correção`,
            `/aluno/tarefas`,
            'fas fa-undo-alt',
            '#ffa500'
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao devolver tarefa:', err);
        res.status(500).json({ success: false });
    }
});

app.get('/dashboard/tarefas/:id', checkAuth, async (req, res) => {
    try {
        const tarefaId = req.params.id;
        const tarefaResult = await db.query(`
            SELECT 
                t.*,
                c.nome as competencia_nome,
                u.nome as professor_nome
            FROM tarefas t
            LEFT JOIN competencias c ON t.competencia_id = c.id
            LEFT JOIN usuarios u ON t.criado_por = u.id
            WHERE t.id = $1
        `, [tarefaId]);
        if (tarefaResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tarefa não encontrada' });
        }
        const alunosResult = await db.query(`
            SELECT 
                a.id,
                a.nome,
                a.ano_escolar,
                COALESCE(ta.status, 'PENDENTE') as status_tarefa,
                ta.nota,
                ta.feedback,
                ta.resposta_texto,
                ta.resposta_arquivo,
                ta.data_entrega as data_entrega_aluno,
                ta.data_avaliacao,
                TO_CHAR(ta.data_entrega, 'DD/MM/YYYY HH24:MI') as data_entrega_formatada
            FROM alunos a
            LEFT JOIN tarefas_alunos ta ON a.id = ta.aluno_id AND ta.tarefa_id = $1
            WHERE a.ano_escolar = $2
            ORDER BY 
                CASE 
                    WHEN ta.status = 'ENTREGUE' THEN 1
                    WHEN ta.status = 'DEVOLVIDA' THEN 2
                    WHEN ta.status = 'PENDENTE' THEN 3
                    ELSE 4
                END,
                a.nome ASC
        `, [tarefaId, tarefaResult.rows[0].turma]);
        res.json({
            tarefa: tarefaResult.rows[0],
            alunos: alunosResult.rows
        });
    } catch (err) {
        console.error('Erro ao buscar tarefa:', err);
        res.status(500).json({ error: 'Erro ao buscar tarefa' });
    }
});

app.post('/dashboard/tarefas/editar/:id', checkAuth, async (req, res) => {
    const tarefaId = req.params.id;
    const { titulo, descricao, data_entrega, prioridade, status } = req.body;
    try {
        await db.query(
            `UPDATE tarefas 
             SET titulo = $1, descricao = $2, data_entrega = $3, prioridade = $4, status = $5, data_atualizacao = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [titulo, descricao, data_entrega || null, prioridade, status, tarefaId]
        );
        req.flash('success_msg', 'Tarefa atualizada com sucesso!');
        res.redirect('/dashboard/tarefas');
    } catch (err) {
        console.error('Erro ao editar tarefa:', err);
        req.flash('error_msg', 'Erro ao editar tarefa');
        res.redirect('/dashboard/tarefas');
    }
});

app.post('/dashboard/tarefas/excluir/:id', checkAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
        req.flash('success_msg', 'Tarefa excluída com sucesso!');
        res.redirect('/dashboard/tarefas');
    } catch (err) {
        console.error('Erro ao excluir tarefa:', err);
        req.flash('error_msg', 'Erro ao excluir tarefa');
        res.redirect('/dashboard/tarefas');
    }
});

app.post('/dashboard/tarefas/atualizar-status-aluno', checkAuth, async (req, res) => {
    const { tarefa_id, aluno_id, status, observacoes } = req.body;
    try {
        await db.query(
            `UPDATE tarefas_alunos 
             SET status = $1, observacoes = $2, data_entrega = CASE WHEN $1 = 'CONCLUIDA' THEN CURRENT_TIMESTAMP ELSE data_entrega END
             WHERE tarefa_id = $3 AND aluno_id = $4`,
            [status, observacoes, tarefa_id, aluno_id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao atualizar status:', err);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

app.get('/dashboard/api/tarefas-stats', checkAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'ATIVA' THEN 1 END) as ativas,
                COUNT(CASE WHEN data_entrega < CURRENT_DATE AND status = 'ATIVA' THEN 1 END) as atrasadas,
                COUNT(CASE WHEN prioridade = 'ALTA' AND status = 'ATIVA' THEN 1 END) as prioridade_alta
            FROM tarefas
        `);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar estatísticas:', err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

app.get('/dashboard/config', checkAuth, async (req, res) => {
    try {
        const aba = req.query.aba || 'dados';
        
        const configResult = await db.query(
            `SELECT * FROM configuracoes_notificacoes WHERE usuario_id = $1`,
            [req.session.userId]
        );
        
        const config = configResult.rows[0] || {
            notificacoes_ativas: true,
            notificacoes_email: false,
            notificacoes_tarefas: true,
            notificacoes_avaliacoes: true,
            notificacoes_competencias: true
        };
        
        const userResult = await db.query(
            'SELECT nome, email, cargo, data_criacao FROM usuarios WHERE id = $1',
            [req.session.userId]
        );
        
        const statsResult = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM tarefas WHERE criado_por = $1) as tarefas,
                (SELECT COUNT(DISTINCT aluno_id) FROM tarefas_alunos WHERE tarefa_id IN (SELECT id FROM tarefas WHERE criado_por = $1)) as alunos
        `, [req.session.userId]);
        
        res.render('dashboard/config', {
            config,
            nome: userResult.rows[0].nome,
            email: userResult.rows[0].email,
            cargo: userResult.rows[0].cargo,
            dataCadastro: new Date(userResult.rows[0].data_criacao).toLocaleDateString('pt-BR'),
            ultimoAcesso: req.session.ultimoAcesso || '---',
            stats: statsResult.rows[0],
            abaAtiva: aba,
            userCargo: req.session.userCargo,
            isAdmin: req.session.userCargo === 'Admin'
        });
    } catch (err) {
        console.error('Erro ao carregar configurações:', err);
        req.flash('error_msg', 'Erro ao carregar configurações');
        res.redirect('/dashboard');
    }
});


app.post('/dashboard/alterar-senha', checkAuth, async (req, res) => {
    const { senha_atual, nova_senha, confirmar_senha } = req.body;
    
    try {
        const result = await db.query(
            'SELECT senha FROM usuarios WHERE id = $1',
            [req.session.userId]
        );
        
        if (result.rows.length === 0) {
            req.flash('error_msg', 'Usuário não encontrado');
            return res.redirect('/dashboard/config?aba=senha');
        }
        
        const user = result.rows[0];
        
        if (senha_atual !== user.senha) {
            req.flash('error_msg', 'Senha atual incorreta');
            return res.redirect('/dashboard/config?aba=senha');
        }
        
        if (nova_senha.length < 6) {
            req.flash('error_msg', 'A nova senha deve ter no mínimo 6 caracteres');
            return res.redirect('/dashboard/config?aba=senha');
        }
        
        if (nova_senha !== confirmar_senha) {
            req.flash('error_msg', 'As senhas não coincidem');
            return res.redirect('/dashboard/config?aba=senha');
        }
        
        await db.query(
            'UPDATE usuarios SET senha = $1 WHERE id = $2',
            [nova_senha, req.session.userId]
        );
        
        req.flash('success_msg', 'Senha alterada com sucesso!');
        res.redirect('/dashboard/config?aba=senha');
        
    } catch (err) {
        console.error('Erro ao alterar senha:', err);
        req.flash('error_msg', 'Erro ao alterar senha');
        res.redirect('/dashboard/config?aba=senha');
    }
});

app.get('/dashboard/aluno-dados/:id', checkAuth, async (req, res) => {
    try {
        const alunoId = req.params.id;
        const result = await db.query(`
            SELECT 
                a.id,
                a.nome,
                a.presenca,
                al.email,
                al.senha
            FROM alunos a
            LEFT JOIN alunos_login al ON a.id = al.aluno_id
            WHERE a.id = $1
        `, [alunoId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar dados do aluno:', err);
        res.status(500).json({ error: 'Erro ao buscar dados' });
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
        await criarNotificacao(
            'competencia',
            null,
            aluno_id,
            'Nova Competência',
            `Uma nova competência foi registrada: ${nota}`,
            `/aluno/competencias`,
            'fas fa-trophy',
            '#217346'
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
    if (!nome || !ano_escolar || !idade) {
        req.flash('error_msg', 'Todos os campos são obrigatórios');
        return res.redirect('/dashboard/edit');
    }
    try {
        const nomeLower = nome.toLowerCase().replace(/\s+/g, '.');
        const numeroAleatorio = Math.floor(Math.random() * 90 + 10);
        const email = `${nomeLower}${numeroAleatorio}@aluno.analisai.com`;
        const senha = 'aluno123';
        const matricula = `ALU${Date.now().toString().slice(-8)}`;
        
        const alunoResult = await db.query(
            `INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) 
             VALUES ($1, $2, $3, 0, 100, 'EM DESENVOLVIMENTO') RETURNING id`,
            [nome, ano_escolar, idade]
        );
        
        const alunoId = alunoResult.rows[0].id;
        
        await db.query(
            `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status) 
             VALUES ($1, $2, $3, $4, $5, 'ATIVO')`,
            [nome, email, senha, matricula, alunoId]
        );
        
        req.flash('success_msg', `Aluno cadastrado com sucesso! Login: ${email} / Senha: ${senha}`);
        res.redirect('/dashboard/edit');
        
    } catch (err) { 
        console.error('Erro ao adicionar aluno:', err);
        if (err.code === '23505') {
            if (err.constraint === 'alunos_login_email_key') {
                const nomeLower = nome.toLowerCase().replace(/\s+/g, '.');
                const timestamp = Date.now().toString().slice(-6);
                const emailAlternativo = `${nomeLower}.${timestamp}@aluno.analisai.com`;
                req.flash('error_msg', `Email já existente. Tente novamente ou use: ${emailAlternativo}`);
            } else if (err.constraint === 'alunos_login_matricula_key') {
                req.flash('error_msg', 'Matrícula já existente. Tente novamente.');
            } else {
                req.flash('error_msg', 'Email ou matrícula já existente. Tente novamente.');
            }
        } else {
            req.flash('error_msg', 'Erro ao adicionar aluno');
        }
        res.redirect('/dashboard/edit');
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
        req.flash('success_msg', 'Aluno removido com sucesso!');
        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao remover aluno');
        res.redirect('/dashboard/edit');
    }
});

app.post('/dashboard/erase-all', checkAuth, async (req, res) => {
    try {
        await db.query('TRUNCATE TABLE tarefas_alunos RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE tarefas RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE aluno_competencias RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE notas_detalhadas RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE alunos_login RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE alunos RESTART IDENTITY CASCADE');
        req.flash('success_msg', 'Todos os dados foram apagados com sucesso!');
        res.redirect('/dashboard/edit');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Erro ao apagar os dados');
        res.redirect('/dashboard/edit');
    }
});

app.post('/dashboard/importar-dados', checkAuth, async (req, res) => {
    try {
        const { alunos } = req.body;
        if (!alunos || !Array.isArray(alunos)) {
            return res.json({ sucesso: false, erro: 'Dados inválidos' });
        }
        let importados = 0;
        let duplicados = 0;
        for (const aluno of alunos) {
            const existe = await db.query(
                'SELECT id FROM alunos WHERE nome = $1',
                [aluno.nome]
            );
            if (existe.rows.length > 0) {
                duplicados++;
                continue;
            }
            const result = await db.query(
                `INSERT INTO alunos (nome, ano_escolar, idade, presenca, nivel) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [aluno.nome, aluno.ano_escolar, aluno.idade, aluno.presenca || 100, 'EM DESENVOLVIMENTO']
            );
            const alunoId = result.rows[0].id;
            const nomeLower = aluno.nome.toLowerCase().replace(/\s+/g, '.');
            const numeroAleatorio = Math.floor(Math.random() * 90 + 10);
            const email = `${nomeLower}${numeroAleatorio}@aluno.analisai.com`;
            const senha = 'aluno123';
            const matricula = `ALU${Date.now().toString().slice(-8)}${importados}`;
            await db.query(
                `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status) 
                 VALUES ($1, $2, $3, $4, $5, 'ATIVO')`,
                [aluno.nome, email, senha, matricula, alunoId]
            );
            importados++;
        }
        res.json({ 
            sucesso: true, 
            importados,
            duplicados,
            mensagem: `${importados} alunos importados com sucesso! ${duplicados} duplicados ignorados.`
        });
    } catch (err) {
        console.error('Erro na importação:', err);
        res.json({ sucesso: false, erro: err.message });
    }
});

app.post('/dashboard/importar-dados-completos', checkAuth, async (req, res) => {
    try {
        const { alunos } = req.body;
        if (!alunos || !Array.isArray(alunos)) {
            return res.json({ sucesso: false, erro: 'Dados inválidos' });
        }
        let importados = 0;
        let duplicados = 0;
        let totalCompetencias = 0;
        for (const aluno of alunos) {
            const existe = await db.query(
                'SELECT id FROM alunos WHERE nome = $1',
                [aluno.nome]
            );
            if (existe.rows.length > 0) {
                duplicados++;
                continue;
            }
            const result = await db.query(
                `INSERT INTO alunos (nome, ano_escolar, idade, presenca, nivel) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [aluno.nome, aluno.ano_escolar, aluno.idade, aluno.presenca || 100, 'EM DESENVOLVIMENTO']
            );
            const alunoId = result.rows[0].id;
            const nomeLower = aluno.nome.toLowerCase().replace(/\s+/g, '.');
            const numeroAleatorio = Math.floor(Math.random() * 90 + 10);
            const email = `${nomeLower}${numeroAleatorio}@aluno.analisai.com`;
            const senha = 'aluno123';
            const matricula = `ALU${Date.now().toString().slice(-8)}${importados}`;
            await db.query(
                `INSERT INTO alunos_login (nome, email, senha, matricula, aluno_id, status) 
                 VALUES ($1, $2, $3, $4, $5, 'ATIVO')`,
                [aluno.nome, email, senha, matricula, alunoId]
            );
            importados++;
            if (aluno.competencias && aluno.competencias.length > 0) {
                for (const comp of aluno.competencias) {
                    const compResult = await db.query(
                        'SELECT id FROM competencias WHERE nome = $1',
                        [comp.nome]
                    );
                    if (compResult.rows.length > 0) {
                        const competenciaId = compResult.rows[0].id;
                        await db.query(
                            'INSERT INTO aluno_competencias (aluno_id, competencia_id, nota, observacoes) VALUES ($1, $2, $3, $4)',
                            [alunoId, competenciaId, comp.nota, 'Importado via planilha']
                        );
                        totalCompetencias++;
                    }
                }
            }
        }
        res.json({ 
            sucesso: true, 
            importados, 
            duplicados,
            totalCompetencias,
            mensagem: `${importados} alunos importados com ${totalCompetencias} competências! ${duplicados} duplicados ignorados.`
        });
    } catch (err) {
        console.error('Erro na importação:', err);
        res.json({ sucesso: false, erro: err.message });
    }
});

app.get('/baixar-modelo-importacao', checkAuth, async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Relatório AnalisAI');
        worksheet.columns = [
            { key: 'A', width: 10 },
            { key: 'B', width: 20 },
            { key: 'C', width: 20 },
            { key: 'D', width: 24 },
            { key: 'E', width: 12 },
            { key: 'F', width: 12 },
            { key: 'G', width: 25 },
            { key: 'H', width: 120 }
        ];
        try {
            const logoPath = path.join(process.cwd(), 'Public', 'IMG', 'xls-logo.png');
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
                worksheet.addImage(logoId, { tl: { col: 0, row: 0 }, br: { col: 3, row: 6 } });
            }
        } catch (e) {
            console.log("Logo não encontrado", e);
        }
        worksheet.mergeCells('D2:G4');
        const titleCell = worksheet.getCell('D2');
        titleCell.value = 'MODELO DE IMPORTAÇÃO - PREENCHA OS DADOS';
        titleCell.font = { size: 16, bold: true, color: { argb: 'FFFF0101' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        const headerRow = worksheet.getRow(8);
        headerRow.values = ['ID', 'ALUNO', 'ANO ESCOLAR', 'IDADE', 'MÉDIA', 'PRESENÇA', 'NÍVEL', 'COMPETÊNCIAS'];
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0101' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        worksheet.addRow(['', 'JOÃO SILVA', '1º MÉDIO', 15, '', '90%', '', 'Raciocínio Lógico: 8.5; Comunicação: 7.0']);
        worksheet.addRow(['', 'MARIA OLIVEIRA', '2º MÉDIO', 16, '', '85%', '', 'Proatividade: 9.0; Organização: 6.5']);
        worksheet.addRow(['', 'PEDRO SANTOS', '3º MÉDIO', 17, '', '95%', '', 'Liderança: 8.0; Trabalho em Equipe: 7.5']);
        worksheet.addRow(['', 'ANA BEATRIZ', '9º FUNDAMENTAL', 14, '', '100%', '', 'Comunicação: 9.5; Criatividade: 8.0']);
        let currentRow = 8 + 5 + 2;
        const titleRow = worksheet.getRow(currentRow);
        titleRow.getCell(1).value = 'INSTRUÇÕES DE PREENCHIMENTO:';
        titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFF0101' } };
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        const inst1 = worksheet.getRow(currentRow);
        inst1.getCell(1).value = '1. ID: Deixe em branco (será gerado automaticamente)';
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        const inst2 = worksheet.getRow(currentRow);
        inst2.getCell(1).value = '2. ALUNO: Nome completo (apenas letras)';
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        const inst3 = worksheet.getRow(currentRow);
        inst3.getCell(1).value = '3. ANO ESCOLAR: Use 1º MÉDIO, 2º MÉDIO, 3º MÉDIO ou 9º FUNDAMENTAL';
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        const inst4 = worksheet.getRow(currentRow);
        inst4.getCell(1).value = '4. IDADE: Número entre 10 e 20';
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        const inst5 = worksheet.getRow(currentRow);
        inst5.getCell(1).value = '5. MÉDIA: Deixe em branco (calculada automaticamente)';
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        const inst6 = worksheet.getRow(currentRow);
        inst6.getCell(1).value = '6. PRESENÇA: Número entre 0 e 100 (pode usar %)';
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        const inst7 = worksheet.getRow(currentRow);
        inst7.getCell(1).value = '7. NÍVEL: Deixe em branco (calculado automaticamente)';
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        const inst8 = worksheet.getRow(currentRow);
        inst8.getCell(1).value = '8. COMPETÊNCIAS: Formato "Competência: Nota; Competência: Nota"';
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        currentRow++;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=modelo_importacao_analisai.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao gerar modelo');
    }
});

app.get('/aluno/dashboard', checkAlunoAuth, async (req, res) => {
    try {
        const alunoId = req.session.aluno.id;
        const alunoResult = await db.query(`
            SELECT 
                a.*,
                al.matricula,
                al.email,
                al.status,
                TO_CHAR(al.data_criacao, 'DD/MM/YYYY') as data_cadastro
            FROM alunos a
            JOIN alunos_login al ON a.id = al.aluno_id
            WHERE a.id = $1
        `, [alunoId]);
        if (alunoResult.rows.length === 0) {
            req.flash('error_msg', 'Aluno não encontrado');
            return res.redirect('/logout');
        }
        const aluno = alunoResult.rows[0];
        const competenciasResult = await db.query(`
            SELECT 
                ac.*,
                c.nome,
                c.descricao,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `, [alunoId]);
        const competencias = competenciasResult.rows;
        let mediaGeral = 0;
        if (competencias.length > 0) {
            const soma = competencias.reduce((acc, comp) => acc + parseFloat(comp.nota), 0);
            mediaGeral = soma / competencias.length;
        }
        const categoriasMap = new Map();
        competencias.forEach(comp => {
            if (!categoriasMap.has(comp.categoria)) {
                categoriasMap.set(comp.categoria, {
                    categoria: comp.categoria,
                    soma: 0,
                    count: 0,
                    media: 0
                });
            }
            const cat = categoriasMap.get(comp.categoria);
            cat.soma += parseFloat(comp.nota);
            cat.count++;
            cat.media = (cat.soma / cat.count) * 10;
        });
        const categorias = Array.from(categoriasMap.values());
        await db.query(
            "UPDATE alunos_login SET ultimo_acesso = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' WHERE aluno_id = $1",
            [alunoId]
        );
        res.render('aluno/main', {
            aluno,
            competencias,
            mediaGeral,
            categorias,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (err) {
        console.error('Erro no dashboard do aluno:', err);
        req.flash('error_msg', 'Erro ao carregar dashboard');
        res.redirect('/logout');
    }
});

app.get('/aluno/competencias', checkAlunoAuth, async (req, res) => {
    try {
        const alunoId = req.session.aluno.id;
        const alunoResult = await db.query(
            'SELECT nome, ano_escolar FROM alunos WHERE id = $1',
            [alunoId]
        );
        const aluno = alunoResult.rows[0];
        const competenciasResult = await db.query(`
            SELECT 
                ac.*,
                c.nome,
                c.descricao,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada,
                TO_CHAR(ac.data_registro, 'HH24:MI') as hora_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `, [alunoId]);
        const stats = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE nota >= 7) as aptas,
                COUNT(*) FILTER (WHERE nota >= 5 AND nota < 7) as desenvolvimento,
                COUNT(*) FILTER (WHERE nota < 5) as inaptas,
                COALESCE(AVG(nota), 0) as media_geral
            FROM aluno_competencias
            WHERE aluno_id = $1
        `, [alunoId]);
        res.render('aluno/competencias', {
            aluno,
            competencias: competenciasResult.rows,
            stats: stats.rows[0],
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (err) {
        console.error('Erro ao carregar competências do aluno:', err);
        req.flash('error_msg', 'Erro ao carregar competências');
        res.redirect('/aluno/dashboard');
    }
});

app.get('/aluno/evolucao', checkAlunoAuth, async (req, res) => {
    try {
        const alunoId = req.session.aluno.id;
        const alunoResult = await db.query(
            'SELECT nome, ano_escolar, presenca FROM alunos WHERE id = $1',
            [alunoId]
        );
        const aluno = alunoResult.rows[0];
        const competenciasResult = await db.query(`
            SELECT 
                ac.*,
                c.nome,
                c.descricao,
                c.categoria,
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data_formatada
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY ac.data_registro DESC
        `, [alunoId]);
        const competencias = competenciasResult.rows;
        const historicoResult = await db.query(`
            SELECT 
                TO_CHAR(ac.data_registro, 'DD/MM/YYYY') as data,
                COUNT(*) as total_avaliacoes,
                COALESCE(AVG(ac.nota), 0) as media_dia
            FROM aluno_competencias ac
            WHERE ac.aluno_id = $1
            GROUP BY TO_CHAR(ac.data_registro, 'DD/MM/YYYY')
            ORDER BY data DESC
        `, [alunoId]);
        const historico = historicoResult.rows;
        const categoriasMap = new Map();
        competencias.forEach(comp => {
            if (!categoriasMap.has(comp.categoria)) {
                categoriasMap.set(comp.categoria, {
                    categoria: comp.categoria,
                    soma: 0,
                    count: 0,
                    media: 0
                });
            }
            const cat = categoriasMap.get(comp.categoria);
            cat.soma += parseFloat(comp.nota);
            cat.count++;
            cat.media = (cat.soma / cat.count) * 10;
        });
        const categorias = Array.from(categoriasMap.values());
        res.render('aluno/evolucao', {
            aluno,
            competencias,
            historico,
            categorias,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (err) {
        console.error('Erro ao carregar evolução:', err);
        req.flash('error_msg', 'Erro ao carregar evolução');
        res.redirect('/aluno/dashboard');
    }
});

app.get('/aluno/config', checkAlunoAuth, async (req, res) => {
    try {
        const aba = req.query.aba || 'dados';
        const alunoId = req.session.aluno.id;
        const result = await db.query(`
            SELECT 
                a.*,
                al.email,
                al.matricula,
                al.status,
                TO_CHAR(al.data_criacao, 'DD/MM/YYYY') as data_cadastro,
                al.ultimo_acesso
            FROM alunos a
            JOIN alunos_login al ON a.id = al.aluno_id
            WHERE a.id = $1
        `, [alunoId]);
        
        const aluno = result.rows[0];
        
        const ultimoAcesso = aluno.ultimo_acesso ? 
            new Date(aluno.ultimo_acesso).toLocaleString('pt-BR', { 
                timeZone: 'America/Sao_Paulo',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false 
            }) : '---';
        
        aluno.ultimo_acesso_formatado = ultimoAcesso;
        
        const competenciasResult = await db.query(`
            SELECT COUNT(*) as total
            FROM aluno_competencias
            WHERE aluno_id = $1
        `, [alunoId]);
        
        const competencias = {
            length: parseInt(competenciasResult.rows[0].total) || 0
        };
        
        res.render('aluno/perfil', {
            aluno,
            competencias,
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg'),
            abaAtiva: aba
        });
        
    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
        req.flash('error_msg', 'Erro ao carregar perfil');
        res.redirect('/aluno/dashboard');
    }
});

app.post('/aluno/alterar-senha', checkAlunoAuth, async (req, res) => {
    const { senha_atual, nova_senha, confirmar_senha } = req.body;
    const alunoId = req.session.aluno.id;
    const aba = 'senha';
    
    try {
        const result = await db.query(
            'SELECT senha FROM alunos_login WHERE aluno_id = $1',
            [alunoId]
        );
        
        if (result.rows.length === 0) {
            req.flash('error_msg', 'Aluno não encontrado');

            const alunoData = await db.query(`
                SELECT 
                    a.*,
                    al.email,
                    al.matricula,
                    al.status,
                    TO_CHAR(al.data_criacao, 'DD/MM/YYYY') as data_cadastro,
                    al.ultimo_acesso
                FROM alunos a
                JOIN alunos_login al ON a.id = al.aluno_id
                WHERE a.id = $1
            `, [alunoId]);


            const aluno = alunoData.rows[0];

            const ultimoAcesso = aluno.ultimo_acesso ? 
                new Date(aluno.ultimo_acesso).toLocaleString('pt-BR', { 
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false 
                }) : '---';

            aluno.ultimo_acesso_formatado = ultimoAcesso;
            const competencias = { length: 0 };
            
            return res.render('aluno/perfil', {
                aluno,
                competencias,
                error_msg: req.flash('error_msg')[0],
                success_msg: null,
                abaAtiva: aba
            });
        }
        
        const aluno = result.rows[0];
        
        if (senha_atual !== aluno.senha) {
            req.flash('error_msg', 'Senha atual incorreta');
            const alunoData = await db.query(`
                SELECT 
                    a.*,
                    al.email,
                    al.matricula,
                    al.status,
                    TO_CHAR(al.data_criacao, 'DD/MM/YYYY') as data_cadastro,
                    al.ultimo_acesso
                FROM alunos a
                JOIN alunos_login al ON a.id = al.aluno_id
                WHERE a.id = $1
            `, [alunoId]);
            const aluno = alunoData.rows[0];

            const ultimoAcesso = aluno.ultimo_acesso ? 
                new Date(aluno.ultimo_acesso).toLocaleString('pt-BR', { 
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false 
                }) : '---';

            aluno.ultimo_acesso_formatado = ultimoAcesso;
            const competencias = { length: 0 };
            
            return res.render('aluno/perfil', {
                aluno: aluno,
                competencias,
                error_msg: req.flash('error_msg')[0],
                success_msg: null,
                abaAtiva: aba
            });
        }
        
        if (nova_senha.length < 6) {
            req.flash('error_msg', 'A nova senha deve ter no mínimo 6 caracteres');
            const alunoData = await db.query(`
                SELECT 
                    a.*,
                    al.email,
                    al.matricula,
                    al.status,
                    TO_CHAR(al.data_criacao, 'DD/MM/YYYY') as data_cadastro,
                    al.ultimo_acesso
                FROM alunos a
                JOIN alunos_login al ON a.id = al.aluno_id
                WHERE a.id = $1
            `, [alunoId]);
            const aluno = alunoData.rows[0];

            const ultimoAcesso = aluno.ultimo_acesso ? 
                new Date(aluno.ultimo_acesso).toLocaleString('pt-BR', { 
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false 
                }) : '---';

            aluno.ultimo_acesso_formatado = ultimoAcesso;
            const competencias = { length: 0 };
            
            return res.render('aluno/perfil', {
                aluno: aluno,
                competencias,
                error_msg: req.flash('error_msg')[0],
                success_msg: null,
                abaAtiva: aba
            });
        }
        
        if (nova_senha !== confirmar_senha) {
            req.flash('error_msg', 'As senhas não coincidem');
            const alunoData = await db.query(
                'SELECT * FROM alunos WHERE id = $1',
                [alunoId]
            );
            const alunoInfo = alunoData.rows[0];
            const competencias = { length: 0 };
            
            return res.render('aluno/perfil', {
                aluno: aluno,
                competencias,
                error_msg: req.flash('error_msg')[0],
                success_msg: null,
                abaAtiva: aba
            });
        }
        
        await db.query(
            'UPDATE alunos_login SET senha = $1 WHERE aluno_id = $2',
            [nova_senha, alunoId]
        );
        
        req.flash('success_msg', 'Senha alterada com sucesso!');
        
        const alunoData = await db.query(
            'SELECT * FROM alunos WHERE id = $1',
            [alunoId]
        );
        const alunoInfo = alunoData.rows[0];
        const competencias = { length: 0 };
        
        res.render('aluno/perfil', {
            aluno: alunoInfo,
            competencias,
            error_msg: null,
            success_msg: req.flash('success_msg')[0],
            abaAtiva: aba
        });
        
    } catch (err) {
        console.error('Erro ao alterar senha:', err);
        req.flash('error_msg', 'Erro ao alterar senha');
        
        const alunoData = await db.query(
            'SELECT * FROM alunos WHERE id = $1',
            [alunoId]
        );
        const alunoInfo = alunoData.rows[0];
        const competencias = { length: 0 };
        
        res.render('aluno/perfil', {
            aluno: alunoInfo,
            competencias,
            error_msg: req.flash('error_msg')[0],
            success_msg: null,
            abaAtiva: 'senha'
        });
    }
});

app.get('/aluno/tarefas', checkAlunoAuth, async (req, res) => {
    try {
        const alunoId = req.session.aluno.id;
        const tarefasResult = await db.query(`
            SELECT 
                ta.id as tarefa_aluno_id,
                t.id as tarefa_id,
                t.titulo,
                t.descricao,
                t.turma,
                t.data_entrega as data_limite,
                c.nome as competencia_nome,
                ta.status,
                ta.nota,
                ta.feedback,
                ta.data_entrega as data_entrega_aluno,
                ta.data_avaliacao,
                TO_CHAR(t.data_entrega, 'DD/MM/YYYY') as data_limite_formatada,
                TO_CHAR(ta.data_entrega, 'DD/MM/YYYY HH24:MI') as data_entrega_formatada,
                TO_CHAR(ta.data_avaliacao, 'DD/MM/YYYY') as data_avaliacao_formatada,
                CASE 
                    WHEN ta.status = 'ENTREGUE' THEN 'Aguardando correção'
                    WHEN ta.status = 'CONCLUIDA' THEN 'Corrigida'
                    WHEN ta.status = 'DEVOLVIDA' THEN 'Devolvida para correção'
                    WHEN ta.status = 'ATRASADA' THEN 'Atrasada'
                    ELSE 'Pendente'
                END as status_texto,
                CASE
                    WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN 'ATRASADA'
                    ELSE ta.status
                END as status_real
            FROM tarefas t
            JOIN tarefas_alunos ta ON t.id = ta.tarefa_id
            LEFT JOIN competencias c ON t.competencia_id = c.id
            WHERE ta.aluno_id = $1
            ORDER BY 
                CASE 
                    WHEN ta.status = 'PENDENTE' AND t.data_entrega < CURRENT_DATE THEN 1
                    WHEN ta.status = 'PENDENTE' THEN 2
                    WHEN ta.status = 'DEVOLVIDA' THEN 3
                    WHEN ta.status = 'ENTREGUE' THEN 4
                    WHEN ta.status = 'CONCLUIDA' THEN 5
                    ELSE 6
                END,
                t.data_entrega ASC NULLS LAST
        `, [alunoId]);
        for (const tarefa of tarefasResult.rows) {
            if (tarefa.status_real === 'ATRASADA' && tarefa.status !== 'ATRASADA') {
                await db.query(
                    `UPDATE tarefas_alunos SET status = 'ATRASADA' WHERE id = $1`,
                    [tarefa.tarefa_aluno_id]
                );
            }
        }
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'PENDENTE' AND data_entrega >= CURRENT_DATE THEN 1 END) as pendentes,
                COUNT(CASE WHEN status = 'ENTREGUE' THEN 1 END) as aguardando,
                COUNT(CASE WHEN status = 'CONCLUIDA' THEN 1 END) as concluidas,
                COUNT(CASE WHEN status = 'DEVOLVIDA' THEN 1 END) as devolvidas,
                COUNT(CASE WHEN status = 'ATRASADA' OR (status = 'PENDENTE' AND data_entrega < CURRENT_DATE) THEN 1 END) as atrasadas
            FROM tarefas_alunos
            WHERE aluno_id = $1
        `, [alunoId]);
        res.render('aluno/tarefas', {
            aluno: req.session.aluno,
            tarefas: tarefasResult.rows,
            stats: statsResult.rows[0] || {
                total: 0,
                pendentes: 0,
                aguardando: 0,
                concluidas: 0,
                devolvidas: 0,
                atrasadas: 0
            },
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (err) {
        console.error('Erro ao carregar tarefas do aluno:', err);
        req.flash('error_msg', 'Erro ao carregar tarefas');
        res.redirect('/aluno/dashboard');
    }
});

app.post('/aluno/tarefas/enviar/:id', checkAlunoAuth, upload.single('arquivo'), async (req, res) => {
    const tarefaAlunoId = req.params.id;
    const alunoId = req.session.aluno.id;
    const { resposta_texto } = req.body;
    const arquivo = req.file;
    try {
        let query = `UPDATE tarefas_alunos 
                     SET status = 'ENTREGUE', 
                         data_entrega = CURRENT_TIMESTAMP`;
        let params = [];
        let paramIndex = 1;
        if (resposta_texto && resposta_texto.trim() !== '') {
            query += `, resposta_texto = $${paramIndex}`;
            params.push(resposta_texto.trim());
            paramIndex++;
        }
        if (arquivo) {
            query += `, resposta_arquivo = $${paramIndex}`;
            params.push(arquivo.filename);
            paramIndex++;
        }
        query += ` WHERE id = $${paramIndex} AND aluno_id = $${paramIndex + 1} 
                   AND status IN ('PENDENTE', 'DEVOLVIDA', 'ATRASADA') RETURNING id`;
        params.push(tarefaAlunoId, alunoId);
        const result = await db.query(query, params);
        if (result.rows.length > 0) {
            const tarefaInfo = await db.query(
                'SELECT criado_por, titulo FROM tarefas WHERE id = (SELECT tarefa_id FROM tarefas_alunos WHERE id = $1)',
                [tarefaAlunoId]
            );
            if (tarefaInfo.rows[0]?.criado_por) {
                await criarNotificacao(
                    'entrega',
                    tarefaInfo.rows[0].criado_por,
                    null,
                    'Tarefa Entregue',
                    `${req.session.aluno.nome} entregou a tarefa: ${tarefaInfo.rows[0].titulo}`,
                    `/dashboard/tarefas`,
                    'fas fa-check-circle',
                    '#ff0101'
                );
            }
            req.flash('success_msg', 'Tarefa enviada com sucesso!');
        } else {
            req.flash('error_msg', 'Não foi possível enviar esta tarefa');
        }
        res.redirect('/aluno/tarefas');
    } catch (err) {
        console.error('Erro ao enviar tarefa:', err);
        req.flash('error_msg', 'Erro ao enviar tarefa');
        res.redirect('/aluno/tarefas');
    }
});

app.get('/aluno/api/dados-grafico', checkAlunoAuth, async (req, res) => {
    try {
        const alunoId = req.session.aluno.id;
        const result = await db.query(`
            SELECT 
                c.nome,
                ac.nota,
                c.categoria
            FROM aluno_competencias ac
            JOIN competencias c ON ac.competencia_id = c.id
            WHERE ac.aluno_id = $1
            ORDER BY c.categoria, ac.nota DESC
        `, [alunoId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar dados do gráfico:', err);
        res.status(500).json({ error: 'Erro ao carregar dados' });
    }
});

app.get('/aluno/api/ranking-comparativo', checkAlunoAuth, async (req, res) => {
    try {
        const alunoId = req.session.aluno.id;
        const aluno = req.session.aluno;
        const alunoMedia = await db.query(`
            SELECT COALESCE(AVG(nota), 0) as media
            FROM aluno_competencias
            WHERE aluno_id = $1
        `, [alunoId]);
        const turmaMedia = await db.query(`
            SELECT COALESCE(AVG(ac.nota), 0) as media
            FROM aluno_competencias ac
            JOIN alunos a ON ac.aluno_id = a.id
            WHERE a.ano_escolar = $1
        `, [aluno.ano_escolar]);
        const geralMedia = await db.query(`
            SELECT COALESCE(AVG(nota), 0) as media
            FROM aluno_competencias
        `);
        res.json({
            aluno: parseFloat(alunoMedia.rows[0].media).toFixed(1),
            turma: parseFloat(turmaMedia.rows[0].media).toFixed(1),
            geral: parseFloat(geralMedia.rows[0].media).toFixed(1)
        });
    } catch (err) {
        console.error('Erro ao buscar ranking comparativo:', err);
        res.status(500).json({ error: 'Erro ao carregar dados' });
    }
});

app.get('/aluno/equipe', checkAlunoAuth, (req, res) => {
  res.render('dashboard/equipe');
});

app.get('/aluno/config', checkAlunoAuth, async (req, res) => {
    try {
        const configResult = await db.query(
            `SELECT * FROM configuracoes_notificacoes WHERE aluno_id = $1`,
            [req.session.aluno.id]
        );
        const config = configResult.rows[0] || {
            notificacoes_ativas: true,
            notificacoes_email: false,
            notificacoes_tarefas: true,
            notificacoes_avaliacoes: true,
            notificacoes_competencias: true
        };
        res.render('aluno/config', {
            config,
            aluno: req.session.aluno
        });
    } catch (err) {
        console.error('Erro ao carregar configurações:', err);
        req.flash('error_msg', 'Erro ao carregar configurações');
        res.redirect('/aluno/dashboard');
    }
});

app.get('/api/notificacoes', async (req, res) => {
    try {
        let query = '';
        let params = [];
        if (req.session.aluno) {
            query = `SELECT * FROM notificacoes WHERE aluno_id = $1 AND lida = false ORDER BY data_criacao DESC LIMIT 20`;
            params = [req.session.aluno.id];
        } else if (req.session.user) {
            query = `SELECT * FROM notificacoes WHERE usuario_id = $1 AND lida = false ORDER BY data_criacao DESC LIMIT 20`;
            params = [req.session.userId];
        } else {
            return res.json({ notificacoes: [], totalNaoLidas: 0 });
        }
        const result = await db.query(query, params);
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM notificacoes WHERE ${req.session.aluno ? 'aluno_id' : 'usuario_id'} = $1 AND lida = false`,
            [req.session.aluno ? req.session.aluno.id : req.session.userId]
        );
        res.json({
            notificacoes: result.rows,
            totalNaoLidas: parseInt(countResult.rows[0].total)
        });
    } catch (err) {
        console.error('Erro ao buscar notificações:', err);
        res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
});

app.post('/api/notificacoes/marcar-lida/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let query = '';
        let params = [];
        if (req.session.aluno) {
            query = `UPDATE notificacoes SET lida = true WHERE id = $1 AND aluno_id = $2 RETURNING id`;
            params = [id, req.session.aluno.id];
        } else if (req.session.user) {
            query = `UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2 RETURNING id`;
            params = [id, req.session.userId];
        } else {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        const result = await db.query(query, params);
        if (result.rows.length > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Notificação não encontrada' });
        }
    } catch (err) {
        console.error('Erro ao marcar notificação como lida:', err);
        res.status(500).json({ error: 'Erro ao processar' });
    }
});

app.post('/api/notificacoes/marcar-todas-lidas', async (req, res) => {
    try {
        let query = '';
        let params = [];
        if (req.session.aluno) {
            query = `UPDATE notificacoes SET lida = true WHERE aluno_id = $1 AND lida = false`;
            params = [req.session.aluno.id];
        } else if (req.session.user) {
            query = `UPDATE notificacoes SET lida = true WHERE usuario_id = $1 AND lida = false`;
            params = [req.session.userId];
        } else {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        await db.query(query, params);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao marcar todas como lidas:', err);
        res.status(500).json({ error: 'Erro ao processar' });
    }
});

app.get('/api/configuracoes-notificacoes', async (req, res) => {
    try {
        let query = '';
        let params = [];
        if (req.session.aluno) {
            query = `SELECT * FROM configuracoes_notificacoes WHERE aluno_id = $1`;
            params = [req.session.aluno.id];
        } else if (req.session.user) {
            query = `SELECT * FROM configuracoes_notificacoes WHERE usuario_id = $1`;
            params = [req.session.userId];
        } else {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        let result = await db.query(query, params);
        if (result.rows.length === 0) {
            if (req.session.aluno) {
                result = await db.query(
                    `INSERT INTO configuracoes_notificacoes (aluno_id) VALUES ($1) RETURNING *`,
                    [req.session.aluno.id]
                );
            } else {
                result = await db.query(
                    `INSERT INTO configuracoes_notificacoes (usuario_id) VALUES ($1) RETURNING *`,
                    [req.session.userId]
                );
            }
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao buscar configurações:', err);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

app.post('/api/configuracoes-notificacoes', async (req, res) => {
    try {
        const { notificacoes_ativas, notificacoes_email, notificacoes_tarefas, notificacoes_avaliacoes, notificacoes_competencias } = req.body;
        let query = '';
        let params = [];
        if (req.session.aluno) {
            const check = await db.query(
                'SELECT id FROM configuracoes_notificacoes WHERE aluno_id = $1',
                [req.session.aluno.id]
            );
            if (check.rows.length > 0) {
                query = `UPDATE configuracoes_notificacoes SET 
                         notificacoes_ativas = $1, notificacoes_email = $2, notificacoes_tarefas = $3, 
                         notificacoes_avaliacoes = $4, notificacoes_competencias = $5
                         WHERE aluno_id = $6 RETURNING *`;
                params = [notificacoes_ativas, notificacoes_email, notificacoes_tarefas, notificacoes_avaliacoes, notificacoes_competencias, req.session.aluno.id];
            } else {
                query = `INSERT INTO configuracoes_notificacoes 
                         (aluno_id, notificacoes_ativas, notificacoes_email, notificacoes_tarefas, notificacoes_avaliacoes, notificacoes_competencias) 
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
                params = [req.session.aluno.id, notificacoes_ativas, notificacoes_email, notificacoes_tarefas, notificacoes_avaliacoes, notificacoes_competencias];
            }
        } else if (req.session.user) {
            const check = await db.query(
                'SELECT id FROM configuracoes_notificacoes WHERE usuario_id = $1',
                [req.session.userId]
            );
            if (check.rows.length > 0) {
                query = `UPDATE configuracoes_notificacoes SET 
                         notificacoes_ativas = $1, notificacoes_email = $2, notificacoes_tarefas = $3, 
                         notificacoes_avaliacoes = $4, notificacoes_competencias = $5
                         WHERE usuario_id = $6 RETURNING *`;
                params = [notificacoes_ativas, notificacoes_email, notificacoes_tarefas, notificacoes_avaliacoes, notificacoes_competencias, req.session.userId];
            } else {
                query = `INSERT INTO configuracoes_notificacoes 
                         (usuario_id, notificacoes_ativas, notificacoes_email, notificacoes_tarefas, notificacoes_avaliacoes, notificacoes_competencias) 
                         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
                params = [req.session.userId, notificacoes_ativas, notificacoes_email, notificacoes_tarefas, notificacoes_avaliacoes, notificacoes_competencias];
            }
        } else {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        const result = await db.query(query, params);
        res.json({ success: true, config: result.rows[0] });
    } catch (err) {
        console.error('Erro ao salvar configurações:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/dashboard/calendario', checkAuth, async (req, res) => {
    try {
        const turmaFilter = req.query.turma || '';
        const mes = req.query.mes || new Date().getMonth() + 1;
        const ano = req.query.ano || new Date().getFullYear();
        
        let eventosQuery = `
            SELECT * FROM calendario_eventos 
            WHERE (EXTRACT(MONTH FROM data_inicio) = $1 OR EXTRACT(MONTH FROM data_fim) = $1)
            AND EXTRACT(YEAR FROM data_inicio) = $2
        `;
        const params = [mes, ano];
        
        if (turmaFilter) {
            eventosQuery += ` AND (turma = $3 OR turma IS NULL)`;
            params.push(turmaFilter);
        }
        
        eventosQuery += ` ORDER BY data_inicio ASC`;
        
        const eventosResult = await db.query(eventosQuery, params);
        const feriadosResult = await db.query(`
            SELECT * FROM feriados 
            WHERE (EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2)
            OR (recorrente = true AND EXTRACT(MONTH FROM data) = $1)
            ORDER BY 
                CASE 
                    WHEN EXTRACT(YEAR FROM data) = $2 THEN 0 
                    ELSE 1 
                END,
                data ASC
        `, [mes, ano]);
        
        const tiposResult = await db.query(`
            SELECT 
                tipo,
                COUNT(*) as total,
                MIN(cor) as cor
            FROM calendario_eventos 
            GROUP BY tipo
            ORDER BY total DESC
        `);
        
        res.render('dashboard/calendario', {
            user: req.session.user,
            userCargo: req.session.userCargo,
            eventos: eventosResult.rows,
            feriados: feriadosResult.rows,
            tipos: tiposResult.rows,
            filtros: {
                turma: turmaFilter,
                mes: parseInt(mes),
                ano: parseInt(ano)
            }
        });
    } catch (err) {
        console.error('Erro ao carregar calendário:', err);
        req.flash('error_msg', 'Erro ao carregar calendário');
        res.redirect('/dashboard');
    }
});

app.post('/dashboard/calendario/evento', checkAuth, async (req, res) => {
    const { titulo, descricao, tipo, data_inicio, data_fim, turma, cor } = req.body;
    
    if (!titulo || !data_inicio) {
        req.flash('error_msg', 'Título e data de início são obrigatórios');
        return res.redirect('/dashboard/calendario');
    }
    
    try {
        await db.query(
            `INSERT INTO calendario_eventos (titulo, descricao, tipo, data_inicio, data_fim, turma, cor, criado_por) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [titulo, descricao, tipo || 'evento', data_inicio, data_fim || null, turma || null, cor || '#ff0101', req.session.userId]
        );
        
        req.flash('success_msg', 'Evento adicionado com sucesso!');
        res.redirect('/dashboard/calendario');
    } catch (err) {
        console.error('Erro ao criar evento:', err);
        req.flash('error_msg', 'Erro ao criar evento');
        res.redirect('/dashboard/calendario');
    }
});

app.post('/dashboard/calendario/feriado', checkAuth, async (req, res) => {
    const { nome, data, recorrente } = req.body;
    
    if (!nome || !data) {
        req.flash('error_msg', 'Nome e data são obrigatórios');
        return res.redirect('/dashboard/calendario');
    }
    
    try {
        await db.query(
            `INSERT INTO feriados (nome, data, recorrente) 
             VALUES ($1, $2, $3)
             ON CONFLICT (data, nome) DO NOTHING`,
            [nome, data, recorrente === 'true']
        );
        
        req.flash('success_msg', 'Feriado adicionado com sucesso!');
        res.redirect('/dashboard/calendario');
    } catch (err) {
        console.error('Erro ao adicionar feriado:', err);
        req.flash('error_msg', 'Erro ao adicionar feriado');
        res.redirect('/dashboard/calendario');
    }
});

app.delete('/dashboard/calendario/evento/:id', checkAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM calendario_eventos WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar evento:', err);
        res.status(500).json({ success: false });
    }
});

app.delete('/dashboard/calendario/feriado/:id', checkAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM feriados WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao deletar feriado:', err);
        res.status(500).json({ success: false });
    }
});

app.get('/dashboard/api/calendario/mes', checkAuth, async (req, res) => {
    try {
        const { mes, ano, turma } = req.query;
        
        const eventos = await db.query(`
            SELECT * FROM calendario_eventos 
            WHERE (EXTRACT(MONTH FROM data_inicio) = $1 OR EXTRACT(MONTH FROM data_fim) = $1)
            AND EXTRACT(YEAR FROM data_inicio) = $2
            AND (turma = $3 OR turma IS NULL)
            ORDER BY data_inicio ASC
        `, [mes, ano, turma || '']);
        
        const feriados = await db.query(
            'SELECT * FROM feriados WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(YEAR FROM data) = $2',
            [mes, ano]
        );
        
        res.json({
            eventos: eventos.rows,
            feriados: feriados.rows
        });
    } catch (err) {
        console.error('Erro ao buscar dados do calendário:', err);
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
});

app.get('/esqueci-senha', (req, res) => {
    res.render('esqueci-senha', {
        error_msg: req.flash('error_msg')[0],
        success_msg: req.flash('success_msg')[0]
    });
});

app.post('/esqueci-senha/solicitar', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        req.flash('error_msg', 'E-mail é obrigatório');
        return res.render('esqueci-senha', {
            error_msg: req.flash('error_msg')[0],
            success_msg: null
        });
    }
    
    try {
        const result = await db.query(
            'SELECT id, nome FROM usuarios WHERE email = $1',
            [email]
        );
        
        if (result.rows.length === 0) {
            req.flash('error_msg', 'E-mail não encontrado');
            return res.render('esqueci-senha', {
                error_msg: req.flash('error_msg')[0],
                success_msg: null
            });
        }
        
        const usuario = result.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        
        await db.query(
            `INSERT INTO solicitacoes_senha (usuario_id, email, token, status) 
             VALUES ($1, $2, $3, 'PENDENTE')`,
            [usuario.id, email, token]
        );
        
        const admins = await db.query(
            'SELECT id FROM usuarios WHERE cargo = $1',
            ['Admin']
        );
        
        for (const admin of admins.rows) {
            await criarNotificacao(
                'solicitacao_senha',
                admin.id,
                null,
                'Solicitação de Redefinição de Senha',
                `${usuario.nome} (${email}) solicitou redefinição de senha`,
                `/dashboard/solicitacoes-senha`,
                'fas fa-key',
                '#ff0101'
            );
        }
        
        req.flash('success_msg', 'Solicitação enviada! Um administrador irá analisar.');
        res.render('esqueci-senha', {
            error_msg: null,
            success_msg: req.flash('success_msg')[0]
        });
        
    } catch (err) {
        console.error('Erro ao solicitar recuperação:', err);
        req.flash('error_msg', 'Erro ao processar solicitação');
        return res.render('esqueci-senha', {
            error_msg: req.flash('error_msg')[0],
            success_msg: null
        });
    }
});

app.get('/dashboard/solicitacoes-senha', checkAuth, checkAdmin, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                s.*,
                u.nome
            FROM solicitacoes_senha s
            JOIN usuarios u ON s.usuario_id = u.id
            WHERE s.status = 'PENDENTE'
            ORDER BY s.data_solicitacao DESC
        `);
        
        res.render('dashboard/solicitacoes', {
            solicitacoes: result.rows,
            user: req.session.user,
            userCargo: req.session.userCargo,
            isAdmin: req.session.userCargo === 'Admin'
        });
    } catch (err) {
        console.error('Erro ao carregar solicitações:', err);
        req.flash('error_msg', 'Erro ao carregar solicitações');
        res.redirect('/dashboard');
    }
});

app.post('/dashboard/solicitacoes-senha/aprovar/:id', checkAuth, checkAdmin, async (req, res) => {
    const { nova_senha } = req.body;
    const solicitacaoId = req.params.id;
    
    if (!nova_senha || nova_senha.length < 6) {
        req.flash('error_msg', 'A nova senha deve ter no mínimo 6 caracteres');
        return res.redirect('/dashboard/solicitacoes-senha');
    }
    
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const solicitacao = await client.query(
            'SELECT * FROM solicitacoes_senha WHERE id = $1 AND status = $2',
            [solicitacaoId, 'PENDENTE']
        );
        
        if (solicitacao.rows.length === 0) {
            req.flash('error_msg', 'Solicitação não encontrada');
            return res.redirect('/dashboard/solicitacoes-senha');
        }
        
        const s = solicitacao.rows[0];
        
        await client.query(
            'UPDATE usuarios SET senha = $1 WHERE id = $2',
            [nova_senha, s.usuario_id]
        );
        
        await criarNotificacao(
            'senha_alterada',
            s.usuario_id,
            null,
            'Senha Redefinida',
            'Sua senha foi redefinida por um administrador',
            `/login`,
            'fas fa-check-circle',
            '#217346'
        );
        
        await client.query(
            `UPDATE solicitacoes_senha 
             SET status = 'APROVADA', data_resposta = CURRENT_TIMESTAMP, respondido_por = $1 
             WHERE id = $2`,
            [req.session.userId, solicitacaoId]
        );
        
        await client.query('COMMIT');
        
        req.flash('success_msg', 'Senha redefinida com sucesso!');
        res.redirect('/dashboard/solicitacoes-senha');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao aprovar solicitação:', err);
        req.flash('error_msg', 'Erro ao aprovar solicitação');
        res.redirect('/dashboard/solicitacoes-senha');
    } finally {
        client.release();
    }
});

app.post('/dashboard/solicitacoes-senha/rejeitar/:id', checkAuth, checkAdmin, async (req, res) => {
    const { motivo } = req.body;
    const solicitacaoId = req.params.id;
    
    try {
        const solicitacao = await db.query(
            'SELECT * FROM solicitacoes_senha WHERE id = $1 AND status = $2',
            [solicitacaoId, 'PENDENTE']
        );
        
        if (solicitacao.rows.length === 0) {
            req.flash('error_msg', 'Solicitação não encontrada');
            return res.redirect('/dashboard/solicitacoes-senha');
        }
        
        const s = solicitacao.rows[0];
        
        await db.query(
            `UPDATE solicitacoes_senha 
             SET status = 'REJEITADA', data_resposta = CURRENT_TIMESTAMP, respondido_por = $1 
             WHERE id = $2`,
            [req.session.userId, solicitacaoId]
        );
        
        await criarNotificacao(
            'solicitacao_rejeitada',
            s.usuario_id,
            null,
            'Solicitação de Senha Rejeitada',
            motivo || 'Sua solicitação foi rejeitada. Contate o administrador.',
            `/login`,
            'fas fa-times-circle',
            '#ff0101'
        );
        
        req.flash('success_msg', 'Solicitação rejeitada');
        res.redirect('/dashboard/solicitacoes-senha');
        
    } catch (err) {
        console.error('Erro ao rejeitar solicitação:', err);
        req.flash('error_msg', 'Erro ao rejeitar solicitação');
        res.redirect('/dashboard/solicitacoes-senha');
    }
});

app.get('/mobile', (req, res) => {
    res.render('mobile', {
        user: req.session?.user,
        userCargo: req.session?.userCargo,
        isAdmin: req.session?.userCargo === 'Admin'
    });
})

app.post('/ignore-mobile', (req, res) => {
    req.session.ignoreMobile = true;
    const redirectUrl = req.session.originalUrl || '/';
    req.session.originalUrl = null;
    res.redirect(redirectUrl);
})

app.use((req, res) => {
    res.status(404).render('error', {
        titulo: 'PÁGINA NÃO ENCONTRADA',
        mensagem: 'A página que você está procurando não existe.',
        erroDetalhe: null,
        user: req.session?.user,
        userCargo: req.session?.userCargo,
        isAdmin: req.session?.userCargo === 'Admin'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.code === '23514') {
        req.flash('error_msg', err.detail || 'Erro de validação');
        return res.redirect(req.get('referer') || '/dashboard');
    }
    return res.status(500).render('error', {
        titulo: 'ERRO NO SERVIDOR',
        mensagem: 'Ocorreu um erro interno no servidor.',
        erroDetalhe: process.env.NODE_ENV === 'development' ? err.message : null,
        user: req.session?.user,
        userCargo: req.session?.userCargo,
        isAdmin: req.session?.userCargo === 'Admin'
    });
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));