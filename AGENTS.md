# ComissGest — memória e regras do projeto

Leia este arquivo antes de analisar ou alterar o projeto. Ele registra decisões aprovadas pelo responsável e padrões que devem ser mantidos em qualquer continuação do desenvolvimento. Se uma instrução nova do responsável atualizar uma decisão daqui, siga a instrução mais recente e atualize este documento quando autorizado.

## Contexto do produto

ComissGest é uma aplicação SaaS para gestão individual de vendas, comissões, produtos e metas em múltiplas empresas.

- Frontend: React, TypeScript e Vite.
- Navegação: React Router, com suporte a SPA no GitHub Pages.
- Dados e autenticação: Firebase Authentication e Cloud Firestore.
- Hospedagem prevista: GitHub Pages, com publicação automatizada após merge na `main`.
- Firebase Storage não está habilitado e não deve ser introduzido sem nova autorização.
- Não criar backend próprio.
- Manter o projeto e as configurações existentes; não iniciar outro projeto.

## Fluxo obrigatório de trabalho

O responsável exige aprovação antes da execução de cada etapa de desenvolvimento.

Antes de qualquer ação que altere o projeto, apresente:

1. Objetivo.
2. Plano ordenado.
3. Arquivos que serão criados, alterados ou removidos.
4. Dependências ou serviços necessários.
5. Impactos, validações e riscos relevantes.

Depois, aguarde autorização explícita. Perguntas, comentários e sugestões não autorizam a execução. Uma autorização vale somente para o escopo aprovado naquela etapa; não é permanente. Se surgir uma alteração fora do escopo, pare, explique e apresente um novo plano para aprovação.

Exceção: o responsável pode autorizar expressamente uma correção sem plano ou aprovação. Essa exceção se limita ao escopo indicado na mensagem e não se estende a tarefas futuras.

Ao concluir, informe o que mudou, os arquivos afetados, as validações realizadas e eventuais limitações. Não faça commit ou push sem solicitação explícita; o responsável já autorizou commits sem nova confirmação, mas não pushes.

## Organização e arquitetura

Manter o código modular e tipado. Separar responsabilidades entre componentes, páginas, layouts, hooks, contextos, serviços/repositórios, tipos, schemas, utils e integração Firebase. Evitar `any`, regras de negócio dentro de componentes grandes e duplicação de regras.

Antes de implementar, inspecione os arquivos e padrões existentes. Preserve configurações funcionais e alterações não relacionadas. Não remova dependências ou configurações sem justificativa e autorização.

## Identidade visual, temas e cores

### Regra principal

Toda tela autenticada associada a uma empresa deve usar as cores calculadas da empresa ativa e do tema atual do usuário. Isso vale para páginas, componentes, modais, campos, estados, gráficos, ícones, bordas, fundos, placeholders, foco, hover, carregamento e mensagens.

- O tema inicial segue a preferência do sistema operacional; a escolha manual do usuário deve continuar funcionando.
- Cada empresa tem uma cor principal para o tema claro e outra para o tema escuro.
- Derivar a paleta por meio da lógica centralizada em `src/utils/brandColors.ts` e aplicar os tokens pelo contexto da empresa e pelas variáveis CSS.
- Consultar os tokens existentes antes de criar novos. Exemplos: `--brand-primary`, `--brand-text`, `--brand-soft`, `--brand-border`, `--brand-hover`, `--app-background`, `--app-header`, `--app-surface`, `--app-control`, `--app-border`, `--app-text`, `--app-muted-text`, `--app-placeholder` e tokens de sucesso, erro e aviso.
- Evitar ao máximo cores literais em CSS, JSX, SVG e estilos inline. Não inserir azuis, verdes ou outras cores decorativas fixas em telas de empresa.
- As únicas telas autorizadas a manter cores fixas próprias são login/cadastro/recuperação de senha e seleção de empresa, que podem usar a paleta padrão do sistema por não terem uma empresa ativa.
- Cores semânticas de sucesso, erro e aviso devem vir da paleta calculada, preservando distinção e contraste.
- Placeholders devem usar um tom neutro mais apagado que o texto digitado; não usar a cor de destaque da empresa para placeholders.
- Ao adicionar uma cor derivada ou um token, atualizar a função central de paleta e a seção “Variações da identidade” em configurações da empresa para manter a prévia completa.
- O favicon deve acompanhar a cor da identidade quando isso for aplicável; não reintroduzir o favicon genérico do Vite.

### Arquivos centrais de tema

- `src/utils/brandColors.ts`: cálculo da paleta e valores padrão da marca.
- `src/contexts/CompanyContext.tsx`: empresa ativa, aplicação dos tokens e identidade no documento.
- `src/index.css`: aliases globais dos tokens e seleção de tema.
- `src/App.css`: estilos da interface; preferir tokens em vez de valores literais.
- `src/pages/companies/CompanySettingsPage.tsx`: configuração e prévia das variações de cores.

## Navegação, cabeçalho e responsividade

- Nas telas autenticadas onde cabe navegação, manter o header com marca e botão de menu hambúrguer.
- Adicionar ao menu uma opção para cada nova tela autenticada quando ela fizer sentido no fluxo. Usar rotas existentes e contexto da empresa atual; não criar links sem destino ou rotas ambíguas.
- O menu pode reunir navegação, seleção/troca de empresa, perfil, tema e saída conforme o contexto da tela. Em `/empresas`, não exibir como selecionada uma empresa que não está aberta.
- Manter o header visível durante rolagem quando esse for o padrão da área autenticada.
- Projetar mobile-first. Validar layouts em larguras pequenas: sem cortes horizontais, controles acessíveis, cards padronizados e empilhados quando necessário, modais roláveis e conteúdo essencial visível.
- O botão de lançar venda no dashboard deve permanecer acessível na visão mobile durante a rolagem.
- Usar skeletons que representem a estrutura carregada em vez de telas de espera apenas com texto, sempre que houver carregamento de conteúdo.

## Empresas e isolamento multi-tenant

- Um usuário pode criar ou participar de uma ou mais empresas.
- Uma empresa contém seus próprios produtos, vendas e configurações.
- Após autenticar, o fluxo principal leva a `/empresas`. Selecionar uma empresa abre `/empresas/:companyId`; essa rota contém o dashboard da empresa.
- Vendas e demais recursos da empresa devem usar rotas contextualizadas por empresa, por exemplo `/empresas/:companyId/vendas`.
- Cada venda pertence a exatamente uma empresa e a um usuário autenticado (`userId`/UID).
- Cada usuário só pode consultar, editar e excluir suas próprias vendas dentro da empresa atual. Ser proprietário da empresa não concede acesso às vendas dos demais membros.
- Nunca confiar só nas validações do frontend. Firestore Security Rules devem validar autenticação, associação à empresa, UID da venda e permissões, impedindo consulta/alteração de dados de terceiros e associações arbitrárias.
- Não enfraquecer regras de segurança para contornar erros de interface. Mudanças de regras precisam de plano, aprovação e validação apropriada.
- Convites devem ser autorizados no backend com identidade e e-mail autenticado/verificado, sem confiar em e-mail fornecido livremente pelo cliente.

## Regras de negócio por módulo

### Vendas e comissões

- A venda pertence à empresa atual e ao usuário que a cadastrou.
- Data e hora devem vir preenchidas com o momento atual, mas ser selecionáveis/editáveis conforme o fluxo.
- Valor da venda e valor da comissão são valores em reais; a interface exibe padrão brasileiro com duas casas decimais. Não converter silenciosamente o domínio para centavos: conferir o modelo e os serviços existentes antes de mudar persistência ou cálculos.
- Comissão é calculada a partir do valor da venda e do percentual informado.
- Percentual pode ser digitado e a tela deve oferecer atalhos de 1% a 10%, em incrementos de 0,5%.
- Produto na venda é opcional.
- Observação é opcional, editável e preservada ao editar a venda.
- Histórico deve respeitar usuário e empresa, filtros de período, paginação quando aplicável, totalizadores coerentes e exportação CSV.
- Ações de edição e exclusão ficam no menu de ações do registro; exclusão exige confirmação. Editar abre modal e preserva o estado/fluxo sem recarregar a página.

### Produtos

- Produtos pertencem à empresa, não globalmente ao usuário.
- Cadastro inicial pede o nome; os metadados podem incluir criação/alteração e os UIDs responsáveis.
- Criar produto pela tela de venda ou pelo modal de edição deve atualizar as opções e devolver o usuário ao formulário/modal original sem recarregar a tela nem perder o estado.

### Metas

- Metas são individuais por usuário e por empresa; um usuário pode ter várias metas.
- A meta registra início, fim, valor em reais, dias úteis e descrição opcional.
- Para esse cálculo, dias úteis são de segunda a sábado, sem feriados, com quantidade inicialmente pré-calculada e editável.
- Indicadores de meta devem considerar vendas do usuário e o intervalo da meta: meta, realizado, percentual atingido, restante em reais e percentual, meta diária, necessidade diária considerando dias úteis restantes e média diária nos dias úteis declarados.
- Preferências do dashboard são por usuário e por empresa.
- O dashboard pode filtrar dia, semana, mês, ano e intervalo personalizado; aplicar período atualiza todos os indicadores relacionados.
- Ao entrar em empresa, se não houver meta vigente para o mês e a solicitação estiver habilitada nas configurações da empresa, mostrar o aviso configurado com atalho para cadastro.

### Dashboard

- Indicadores e gráficos devem usar a empresa e o período selecionados.
- Manter visibilidade e ordem dos widgets configuráveis por usuário e empresa.
- Comissão é o foco do produto e deve ter hierarquia visual clara.
- Gráficos equivalentes devem compartilhar a paleta e o estilo; usar os tokens de marca para séries, eixos, grid e tooltips.
- Incluir indicadores de vendas e comissões por percentual e por produto conforme os widgets existentes; controles de visibilidade devem permitir ocultar gráfico e indicadores de forma independente quando previstos.

## Segurança, segredos e publicação

- Não adicionar `.env.local`, credenciais privadas, chaves de serviço ou arquivos locais ao Git.
- Variáveis Firebase `VITE_*` usadas no navegador são configuração pública do cliente, não segredo de servidor. Proteger dados com Firestore Security Rules, restrições adequadas da API key e configuração Firebase; nunca colocar credenciais administrativas no frontend.
- Segredos necessários ao deploy devem ficar em GitHub Actions Secrets. Não imprimir valores secretos em logs.
- O deploy planejado é GitHub Pages após merge na `main`, com base path e fallback/navegação SPA adequados.
- Não publicar, fazer push, alterar projeto Firebase ou rodar deploy sem autorização específica para essa ação.

## Validação

- Validar TypeScript/build e conferir `git diff --check` quando essas validações estiverem no escopo aprovado.
- Para mudanças visuais, verificar os temas claro e escuro, pelo menos uma empresa com cor personalizada e larguras desktop/mobile.
- Para regras de acesso, conferir primeiro as Firestore Security Rules e testes existentes; não afirmar isolamento seguro só porque a interface filtra dados.
- Não criar ou executar testes fora do escopo solicitado/aprovado.
