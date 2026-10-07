# Pulsik · Siará Tech Summit

Aplicação Next.js/React/TypeScript para cadastro, roleta, comprovante, estoque e painel administrativo. Evento: 7 a 9/10/2026, Fortaleza. Interface responsiva com glassmorphism; TSX para apresentação, hooks TS para comportamento e CSS em `styles/`.

## Arquitetura atual

- **Vercel:** hospedagem do front-end Next.js e das rotas de servidor.
- **Supabase:** banco PostgreSQL com cadastros, participações, sorteios e estoque.
- **SMTP:** envio dos códigos de acesso por e-mail.

Google e códigos por e-mail são autenticados pelo NextAuth na aplicação. A entrada como convidado utiliza uma sessão própria e não depende de envio por SMTP.

## Autenticação e banco

NextAuth gerencia Google, código de seis dígitos por e-mail e usuário/senha do administrador. Supabase é usado somente como banco, acessado pelas rotas do servidor. O navegador não recebe a chave de serviço. A implementação usa NextAuth **5.0.0-beta.32**, fixado no package.json, com sessões JWT de oito horas.

Google e e-mail confirmado convergem para o mesmo usuário pelo e-mail normalizado. O painel exige login pelo provedor de credenciais administrativo e autorização atual no banco. Entrar com Google no e-mail do administrador não libera o painel. A sessão do navegador é compartilhada: entrar no painel substitui a sessão de participante.

## Ativar a migração na Vercel

Para desenvolvimento local, crie **`.env.local`** na raiz (com o ponto inicial), usando as variáveis de `.env.nextauth.example`, e configure `AUTH_URL=http://localhost:3000`. Reinicie `npm run dev` após configurar o arquivo. Os nomes `env.local` e `env.nextauth.private` não são carregados automaticamente pelo Next.js; sem `AUTH_SECRET`, as rotas de autenticação retornam erro de configuração (`ClientFetchError` no navegador). Para testar Google localmente, cadastre também `http://localhost:3000/api/auth/callback/google` como URI de redirecionamento no cliente OAuth.

1. Use `.env.nextauth.example` como referência para preencher `.env.local` e as variáveis de ambiente da Vercel. O antigo `.env.example`, com variáveis públicas, corresponde à integração anterior e não configura esta versão. Gere `AUTH_SECRET` com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Não versione os valores reais.
2. Configure `AUTH_URL=https://pulsik-feira.vercel.app`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A chave service_role fica exclusivamente no servidor, nunca em uma variável `NEXT_PUBLIC_`.
3. No cliente OAuth Web do Google Cloud, configure a origem JavaScript `https://pulsik-feira.vercel.app` e o URI de redirecionamento autorizado **`https://pulsik-feira.vercel.app/api/auth/callback/google`**. O ID e segredo desse cliente ficam agora na Vercel. Referência: [Google no Auth.js](https://authjs.dev/getting-started/providers/google).
4. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM` na Vercel para envio de códigos. Use um remetente autorizado no provedor SMTP. As configurações de e-mail do Supabase Auth não são utilizadas. Porta 465 usa TLS direto; outras portas exigem STARTTLS.
5. Com uma cópia de segurança do banco, execute no SQL Editor **`supabase/migrations/202609210002_nextauth.sql`**, depois das três migrações anteriores. Em banco já configurado, não reexecute as migrações antigas. Em banco novo, aplique todos os arquivos de `supabase/migrations/` na ordem dos nomes.
6. Publique esta versão na Vercel com preset **Next.js**, build `npm run build` e diretório de saída padrão. Remova qualquer sobrescrita de saída para `out`: esta versão precisa de rotas de servidor. A configuração histórica `.openai/hosting.json` não é usada na implantação Vercel.
7. Valide Google, código por e-mail, login administrativo, cadastro, giro e retirada em ambiente de teste. O banco de produção só libera cadastro/giro durante a janela do evento.

A aplicação anterior deixa de acessar o banco quando a migração revoga as permissões antigas; coordene sua execução com a publicação. As sessões antigas não são aproveitadas: usuários entram novamente. A migração copia os UUIDs e usuários existentes, preserva participações, resultados, estoques e hashes das senhas dos administradores autorizados. Não exclua os registros antigos do Supabase Auth durante a transição. E-mails duplicados após normalização precisam ser resolvidos antes de executar a migração; a transação falha sem aplicar parcialmente as mudanças.

Para testes locais, use `AUTH_URL=http://localhost:3000` e autorize `http://localhost:3000/api/auth/callback/google` no Google. O cadastro OAuth e a tela de consentimento do Google continuam necessários.

## Administrador

O administrador já autorizado em `pulsik_admins` é migrado com seu UUID e hash de senha. O usuário `pulsikadmin` é associado ao e-mail administrativo existente. A senha não fica no código ou nas variáveis públicas. `supabase/setup-admin.sql` contém as instruções para provisionar uma nova conta diretamente nas tabelas da aplicação, sem Supabase Auth.

Para recuperar a senha, use um novo hash bcrypt de custo 12 em `supabase/setup-admin.sql` e altere `v_reset_password` para `true` antes de executar no SQL Editor. O script preserva o UUID e os vínculos da conta administrativa existente; não é necessário excluí-la. Ele não promove um participante existente a administrador. A troca de senha não encerra sessões NextAuth já abertas, que expiram em até oito horas. Se houve bloqueio por tentativas de login, aguarde a janela de quinze minutos.

## Rodar e verificar

Node.js 24 e npm 11.17.0. Execute `npm ci`, `npm run dev`. Verificação: `npm run typecheck`, `npm test`, `npm run build`. Para servir o build de produção, execute `npm start`.

Os testes cobrem migração de identidades, preservação de prêmios/estoques, permissões das rotas e do banco, senha administrativa, código de uso único, limites de tentativas, telefone, probabilidades, idempotência e retirada. Usam PostgreSQL local via PGlite e substitutos dos serviços externos; não substituem o login real no Google e a entrega real de mensagens SMTP.

## Regras da campanha

- Copo: 30 unidades, 4%; chaveiro: 200, 23%; caneta: 200, 23%; sem prêmio: 20%; tente novamente: 30%.
- Sorteio real: função `pulsik_spin_v2`, atualizada em `202609210004_prize_chances.sql`. Estoque e resultado são gravados na mesma transação. Prêmio esgotado converte sua chance em sem prêmio.
- Um resultado final por usuário/e-mail na campanha; tente novamente mantém o direito de girar. Repetir a mesma requisição devolve o resultado existente.
- Telefone obrigatório com 11 dígitos. Máscara em `lib/phone.ts`: `(85) 98925-5170`.
- Campanha aberta de 07/10/2026 00:00 a 10/10/2026 00:00, UTC−3.
- Textos, redes sociais e campanha em `lib/config.ts`; logotipos no cabeçalho `components/shell.tsx`.

## Rotas e proteção

`/` participação real; `/demo` demonstração local sem consumir estoque; `/admin` painel de equipe; `/regras` e `/privacidade` informações públicas. Falta de configuração não ativa demonstração silenciosamente.

`auth.ts` configura a autenticação; `lib/server/` concentra acesso ao banco e validação; `app/api/` contém autenticação, envio de código, participação, giro e administração. As rotas derivam a identidade da sessão e verificam a autorização no servidor. As mutações verificam a origem. A migração bloqueia o acesso direto de anon/authenticated às tabelas e funções da aplicação.

Códigos expiram em dez minutos, são armazenados como HMAC e consumidos uma única vez. Cinco erros bloqueiam o código; são permitidas 600 solicitações por IP em 5 minutos e um envio por e-mail a cada 20 segundos (até 3 por minuto). O contador e a interface usam `lib/auth-limits.ts`. As novas chaves de contagem não herdam bloqueios da configuração anterior. Login administrativo tem limite persistente de tentativas por usuário. A biblioteca SMTP foi atualizada, com override no package.json, para evitar a versão antiga sugerida pelo peer opcional do NextAuth. Não usamos o provedor Nodemailer interno do NextAuth.

## Entrada como convidado e limites para a feira

Antes de publicar esta versão, aplique **uma vez** `supabase/migrations/20261005230228_guest_registration.sql`, após as migrações anteriores. Ela adiciona sessões de convidados e uma função de cadastro atômico; não modifica usuários, resultados, probabilidades ou estoques existentes. Depois publique a aplicação. Não há novas variáveis obrigatórias. Para reverter o código, as estruturas novas podem permanecer no banco.

**Entrar como convidado** abre o formulário com e-mail editável, sem enviar mensagem SMTP. O servidor normaliza o e-mail e cria usuário, participação e sessão na mesma transação. Se o e-mail já existir em `pulsik_users`, inclusive por login Google, código ou cadastro de teste, o novo cadastro é recusado com uma mensagem amigável. A pessoa pode confirmar esse mesmo e-mail por Google/código para acessar a conta existente. A restrição única do banco também protege contra solicitações concorrentes.

A sessão usa um segredo aleatório de 256 bits em cookie HttpOnly, SameSite=Lax e Secure em HTTPS; somente o HMAC é armazenado no banco. Dura até 8 horas e só autoriza a participação da campanha cadastrada. Atualizar a página ou repetir um envio após falha de rede mantém o cadastro e o resultado. **Trocar/Sair** revoga a sessão de convidado. Entrar com Google/código confirma a conta existente, preserva seu UUID e resultado e invalida os acessos de convidado. Nenhuma sessão de convidado autoriza o painel administrativo.

O e-mail de convidado permanece **não verificado**. Esse fluxo evita dependência do SMTP, mas não comprova que a pessoa controla o endereço nem impede alguém de informar endereços diferentes. Para recuperar a participação após sair ou expirar a sessão, é necessário confirmar o e-mail. Limpar a campanha de teste remove suas sessões de convidado, mas preserva usuários; use um e-mail de teste diferente ou entre por Google/código para reutilizar uma conta já criada.

O cadastro de convidados tem limite independente de 600 solicitações por IP em 5 minutos. Na Vercel, o IP vem de `X-Vercel-Forwarded-For`, com a plataforma detectada pela variável padrão `VERCEL`. No desenvolvimento local, utiliza-se `X-Forwarded-For`; IP ausente/inválido usa um contador compartilhado. O limite por IP protege a aplicação, mas não aumenta as cotas do provedor SMTP. Os envios possuem tempos máximos de conexão/saudação de 10 segundos e de inatividade de 15 segundos.

Validação antes da feira: em `/teste`, cadastre um convidado com e-mail novo, atualize a página, gire e confira o mesmo resultado após nova atualização. Em outro navegador, tente cadastrar o mesmo e-mail e confirme a mensagem de duplicidade. Entre por código/Google com esse e-mail e confirme que o resultado foi preservado. Confira também envio/reenvio de código e os limites do seu provedor. Os testes automatizados usam PGlite e serviços simulados; não comprovam capacidade ou entrega do SMTP em produção.

## Template do e-mail de acesso

O template aprovado está em `lib/email/access-code.ts`: HTML responsivo, versão em texto simples e assunto. Usa o slogan “Pulsik, automação inteligente”. Os logos PNG otimizados ficam em `lib/email/assets.json` e seguem incorporados à mensagem por Content-ID, sem depender de URLs públicas. `lib/server/auth-service.ts` insere o código gerado e envia o conteúdo pelo SMTP existente. Não são necessárias novas variáveis de ambiente. Após publicar, solicite um código no site para conferir o recebimento no cliente de e-mail utilizado.

## Teste completo antes da feira e gestão do estoque

Execute **uma vez** no SQL Editor a migração `supabase/migrations/202609210003_test_campaign.sql`, depois da migração NextAuth. Ela cria a campanha `siara-2026-test` inicialmente pausada, os controles administrativos e códigos de cadastro para os participantes existentes. Não apaga dados anteriores. Depois publique esta versão na Vercel; não há novas variáveis nem alteração no callback OAuth.

1. Acesse `/admin` com o usuário administrativo e selecione **Teste completo · Estoque separado**.
2. Clique em **Ativar testes por 7 dias**. Abra `/teste` em janela anônima ou outro navegador para testar como visitante sem substituir a sessão administrativa. O teste usa login Google/e-mail real, cadastro no banco, sorteio e retirada. Os envios SMTP são reais.
3. Conclua o formulário em **Liberar meu giro**. Atualize o painel: o contato aparece como **Aguardando giro**, com código `CAD-…`, mesmo sem girar. Esse código não autoriza retirada. O painel também separa **Nova chance disponível** e **Resultado final**.
4. Gire, entre novamente com a mesma conta e confira o resultado. Prêmios de teste recebem código `TST-…`; na feira, `PLS-…`. O admin só confirma retiradas da campanha selecionada. O mesmo e-mail pode participar uma vez em cada campanha, respeitando as novas chances.
5. Em **Estoque de teste** ou **Estoque da feira**, edite a quantidade disponível e clique em **Salvar estoque disponível**. A quantidade total passa a ser a soma dos prêmios já concedidos com os disponíveis. Exemplo: 1 copo concedido + 12 disponíveis = 13 no total. Prêmios concedidos não são cancelados. Se houver um giro enquanto você edita, o painel pede atualização antes de sobrescrever um estoque alterado.
6. Para repetir os testes, exporte os contatos se necessário e abra **Limpar os dados desta campanha de teste**. Digite `LIMPAR TESTES` e confirme. Isso apaga apenas os cadastros, giros e retiradas da campanha de teste, restaura seu estoque ao total configurado e a pausa. As contas de login, administradores e campanha da feira são preservados. Ative os testes novamente e recarregue `/teste` para começar outro ciclo.
7. Antes da feira, pause ou limpe os testes, selecione a campanha **Feira**, confira os estoques reais e use o QR Code da página `/`. Não é necessário resetar a campanha da feira para remover os testes. A página `/demo` continua sendo apenas uma simulação sem gravação no banco.

O admin lista todos os cadastros concluídos da campanha selecionada. Apenas autenticar não cria um participante, e tentativas de cadastro na campanha real fora da janela do evento continuam bloqueadas. Novos registros aparecem ao clicar em **Atualizar**. Exportações CSV incluem campanha, código de cadastro, etapa, resultado e código de retirada. Ajustes de estoque, ativação/pausa e limpeza são registrados em `pulsik_admin_events`.

As operações administrativas exigem sessão de administrador e autorização no servidor. Estoque, giro e limpeza bloqueiam a linha da campanha dentro da transação. A limpeza recusa a campanha real tanto na API quanto no banco. Testes automatizados cobrem isolamento de campanhas, preservação dos registros reais, estoque concorrente, permissões e limpeza. O teste visual usa APIs simuladas; valide o OAuth e SMTP reais após publicar.

## Porcentagens editáveis no admin

Antes de publicar esta versão, aplique **uma vez** `supabase/migrations/20261007183931_configurable_prize_chances.sql`, após as migrações anteriores. Ela mantém as chances iniciais de 4/23/23/20/30 e preserva estoques, participantes, códigos e resultados já salvos.

Em `/admin`, selecione a campanha e use **Chances da roleta** para ajustar copo, chaveiro, caneta, “Não foi dessa vez” e “Tente outra vez”. Clique em **Salvar porcentagens**. Os campos aceitam até duas casas decimais, valores de 0 a 100 e exigem soma de 100%. “Tente outra vez” deve ficar abaixo de 100%, para que a participação possa terminar.

Os próximos giros usam as chances salvas na campanha, dentro da mesma transação do estoque. Feira e teste têm configurações independentes; limpar os testes preserva suas porcentagens. Resultados anteriores e repetições da mesma requisição não são sorteados novamente. Produto esgotado continua convertendo sua chance em “Não foi dessa vez”.

As mudanças exigem administrador, são registradas em `pulsik_admin_events` e recusam sobrescrever uma configuração alterada por outra pessoa enquanto o formulário estava aberto. Nesse caso, clique em **Atualizar** e revise os valores. A roleta e `/regras` consultam as chances atuais, atualizando a cada 30 segundos e ao voltar à janela. `/demo` permanece uma simulação local com as porcentagens padrão de `lib/config.ts`.

## Atualização das probabilidades (configuração inicial)

Execute `supabase/migrations/202609210004_prize_chances.sql` depois da migração de campanha de teste e publique esta versão na Vercel. O banco e a interface passam a usar 4% copo, 23% chaveiro, 23% caneta, 20% sem prêmio e 30% nova chance, tanto na feira quanto em /teste e /demo. São probabilidades por giro com estoque disponível; prêmios esgotados continuam convertendo sua chance em sem prêmio. A migração não apaga participações nem altera resultados já obtidos. Para repetir com a mesma conta, limpe e reative apenas a campanha de teste no admin.

## Códigos curtos de retirada

Execute `supabase/migrations/202609210005_short_claim_codes.sql` após a atualização das probabilidades e publique esta versão. Novos prêmios recebem `TST-` (teste) ou `PLS-` (feira), seguidos de cinco caracteres alfanuméricos. O alfabeto exclui I, O, 0 e 1 para facilitar a leitura. O banco verifica colisões e gera outro código, mantendo a restrição de unicidade. Resultados e códigos antigos `PUL-`/`TST-` de 16 caracteres continuam válidos; não são reescritos. Os códigos de cadastro `CAD-` não mudam.
