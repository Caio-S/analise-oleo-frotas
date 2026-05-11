# Prototipo - Controle de Analise de Oleo de Frotas

Este prototipo foi criado para apresentacao inicial a diretoria. Ele e um site estatico, portanto pode ser aberto diretamente no navegador e tambem publicado gratuitamente no GitHub Pages.

## Telas incluidas

- Dashboard operacional com indicadores de coleta e criticidade.
- Base de frotas com busca conectada ao Supabase.
- Programacao de coletas com visualizacao semanal e mensal.
- Registro demonstrativo de resultados de analise.

## Arquitetura recomendada para o sistema real

- Frontend: HTML/CSS/JavaScript ou React.
- Hospedagem: GitHub Pages.
- Banco de dados: Supabase Free.
- Login e permissoes: Supabase Auth.
- Anexos de laudos: Supabase Storage.

## Conexao Supabase

O prototipo ja esta preparado para autenticar no Supabase e carregar a tabela `frotas`.

Configuracao atual em `app.js`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://xgfxsvvypffmibyuhdrd.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_hyItLlFEiF9BFn9JNxtj9A_48NwLfeX
```

A chave usada e a `Publishable key`, adequada para frontend quando as politicas de RLS estao configuradas. Nunca coloque `Secret key` no site.

## Proximas decisoes para a diretoria

1. Definir quem pode cadastrar, editar, aprovar e consultar dados.
2. Definir frequencia de coleta por tipo de equipamento.
3. Definir relatorios obrigatorios para manutencao e gestao.

## Como abrir

Abra o arquivo `index.html` no navegador.

Para que o navegador carregue o CSV real pela funcao `fetch`, prefira abrir por um servidor local simples dentro desta pasta:

```powershell
python -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080
```

Se abrir direto pelo arquivo `index.html`, alguns navegadores podem bloquear leituras locais por seguranca.

Quando estiver logado no Supabase, a tela de frota tentara carregar os dados da tabela `frotas`. Sem login, o sistema mostra apenas a tela de entrada.

## Base atual identificada

Arquivo: `database/base_frotas.csv`

Colunas:

- `CodFrota`
- `descricao_especialidade`
- `descricao_especialidadeAgrup`
- `descricao_frota`

Quantidade inicial analisada: 1.208 equipamentos.

## Relatorio CHB para dashboard

Arquivo gerado: `database/analises_chb.csv`

Origem: `ExportTFR62TExportToExcel-7800.xlsx`

Campos principais usados:

- Coluna B / `cod_frota`: codigo da frota.
- Coluna F / `cod_compartimento`: codigo do compartimento coletado.
- Coluna G / `compartimento`: descricao do compartimento.
- Coluna N / `data_coleta`: data usada para coletas por dia e media diaria.
- Coluna BV / `resultado`: descricao do resultado da analise.

Quantidade inicial analisada: 355 analises.

Na tela Dashboard, o usuario pode subir novamente o relatorio CHB em formato `.xlsx`, `.xls` ou `.csv`. O prototipo usa as mesmas posicoes do arquivo original:

- B: codigo da frota.
- F: codigo do compartimento.
- G: descricao do compartimento.
- N: data da coleta.
- BV: resultado da analise.

Tambem ha filtro por data inicial e data final usando a data da coleta.

## Cadastro de novas frotas

Na tela Frota, o usuario pode adicionar uma nova frota diretamente na tabela `frotas` do Supabase.

Campos gravados:

- `cod_frota`
- `descricao_especialidade_agrup`
- `descricao_especialidade`
- `descricao_frota`
- `status` com valor `Ativo`

Para funcionar, o usuario precisa estar logado e a tabela `frotas` precisa permitir `insert` para usuarios autenticados nas politicas RLS.

## Banco de dados

O frontend ja esta conectado ao Supabase usando a `Publishable key` em `app.js`.

Tabelas usadas:

- `frotas`: cadastro e consulta de frotas.
- `programacao_coletas`: programacao, status do servico, resultado da analise e detalhamento de anomalia/criticidade.

Para criar a tabela de programacao, rode o conteudo de `supabase_schema.sql` no SQL Editor do Supabase.

## Programacao de coletas

A aba Programacao permite distribuir frotas pela semana e pelo mes.

- Modo semanal: mostra as coletas planejadas por dia e permite marcar cada item como realizado.
- Modo mensal: mostra o mes completo; cada dia tem preenchimento visual proporcional ao total de coletas realizadas naquele dia.
- Agendamento rapido: adiciona uma frota em uma data.
- Programacao em lote: cola uma lista de frotas e distribui automaticamente nos dias selecionados da semana, por exemplo segunda, terca e quarta.

Neste prototipo, a programacao ainda usa dados demonstrativos em memoria. O proximo passo e gravar esses agendamentos em uma tabela do Supabase.
