const express = require('express');
const session = require('express-session');
const db = require('./db'); 
const app = express();
const favicon = require('serve-favicon');
const path = require('path');
const flash = require('connect-flash');
const fs = require('fs')

app.use(favicon(path.join(__dirname, 'Public', 'favicon.ico')));

app.set('view engine', 'ejs');
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

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

app.post('/dashboard/importar-dados', checkAuth, async (req, res) => {
    try {
        const { alunos } = req.body;
        
        if (!alunos || !Array.isArray(alunos)) {
            return res.json({ sucesso: false, erro: 'Dados inválidos' });
        }
        
        let importados = 0;
        
        for (const aluno of alunos) {
            await db.query(
                'INSERT INTO alunos (nome, ano_escolar, idade, presenca, nivel) VALUES ($1, $2, $3, $4, $5)',
                [aluno.nome, aluno.ano_escolar, aluno.idade, aluno.presenca, 'EM DESENVOLVIMENTO']
            );
            importados++;
        }
        
        res.json({ sucesso: true, importados });
        
    } catch (err) {
        console.error(err);
        res.json({ sucesso: false, erro: err.message });
    }
});

app.get('/termos', (req, res) => {
  res.render('termos');
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

app.post('/dashboard/importar-dados-completos', checkAuth, async (req, res) => {
    try {
        const { alunos } = req.body;
        
        if (!alunos || !Array.isArray(alunos)) {
            return res.json({ sucesso: false, erro: 'Dados inválidos' });
        }
        
        let importados = 0;
        let totalCompetencias = 0;
        
        for (const aluno of alunos) {
            const result = await db.query(
                'INSERT INTO alunos (nome, ano_escolar, idade, presenca, nivel) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [aluno.nome, aluno.ano_escolar, aluno.idade, aluno.presenca, 'EM DESENVOLVIMENTO']
            );
            
            const alunoId = result.rows[0].id;
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
            totalCompetencias 
        });
        
    } catch (err) {
        console.error('Erro na importação:', err);
        res.json({ sucesso: false, erro: err.message });
    }
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

app.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE email = $1', [usuario]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      if (user.status !== 'ATIVO') {
        req.flash('error_msg', 'Sua conta está inativa. Contate o administrador.');
        return res.redirect('/login');
      }

      if (senha === user.senha) {
        req.session.user = user.nome;
        req.session.userStatus = user.status;
        req.session.userId = user.id;
        req.session.userCargo = user.cargo;
        req.flash('success_msg', `Bem-vindo, ${user.nome}!`);
        return res.redirect('/dashboard');
      }
    }
    req.flash('error_msg', 'Usuário ou senha inválidos!');
    res.redirect('/login');
  } catch (err) {
    req.flash('error_msg', 'Erro ao conectar ao banco de dados.');
    res.redirect('/login');
  }
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
            rankingFundamental: rankingFundamental
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
            user: req.session.user 
        });

    } catch (err) {
        console.error("ERRO NO DASHBOARD EDIT:", err);
        req.flash('error_msg', 'Não foi possível carregar os dados');
        res.redirect('/dashboard');
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
    
    const anosPermitidos = ['1º MÉDIO', '2º MÉDIO', '3º MÉDIO', '9º FUNDAMENTAL'];
    
    if (!anosPermitidos.includes(ano_escolar)) {
        req.flash('error_msg', 'Ano escolar inválido. Use: 1º MÉDIO, 2º MÉDIO, 3º MÉDIO, 9º FUNDAMENTAL');
        return res.redirect('/dashboard/edit');
    }
    
    if (idade < 10 || idade > 20) {
        req.flash('error_msg', 'A idade deve estar entre 10 e 20 anos');
        return res.redirect('/dashboard/edit');
    }
    
    try {
        await db.query(
            'INSERT INTO alunos (nome, ano_escolar, idade, nota, presenca, nivel) VALUES ($1, $2, $3, $4, $5, $6)', 
            [nome, ano_escolar, idade, 0, 100, 'EM DESENVOLVIMENTO']
        );

        req.flash('success_msg', 'Aluno cadastrado com sucesso!');
        res.redirect('/dashboard/edit');
    } catch (err) { 
        console.error(err);
        req.flash('error_msg', 'Erro ao cadastrar aluno');
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
        await db.query('TRUNCATE TABLE aluno_competencias RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE notas_detalhadas RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE alunos RESTART IDENTITY CASCADE');
        
        req.flash('success_msg', 'Todos os dados foram apagados com sucesso!');
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

app.get('/manual-de-uso', (req, res) => {
  res.render('manual-de-uso');
});

app.get('/dashboard/usuarios', checkAuth, async (req, res) => {
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

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.use((req, res) => {
    res.status(404).render('error', {
        titulo: 'PÁGINA NÃO ENCONTRADA',
        mensagem: 'A página que você está procurando não existe.',
        erroDetalhe: null
    });
});


app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (err.code === '23514') {
        req.flash('error_msg', err.detail || 'Erro de validação');
        return res.redirect(req.get('referer') || '/dashboard');
    }
    
    req.flash('error_msg', 'Erro interno no servidor');
    res.redirect('/dashboard');
});

app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));