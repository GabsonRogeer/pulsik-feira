# Pulsik · Siará Tech Summit

Aplicação Next.js/React/TypeScript para cadastro, roleta, comprovante, estoque e painel administrativo. Evento: 7 a 9/10/2026, Fortaleza. Interface responsiva com glassmorphism; TSX para apresentação, hooks TS para comportamento e CSS em `styles/`.

## Autenticação e banco

NextAuth gerencia Google, código de seis dígitos por e-mail e usuário/senha do administrador. Supabase é usado somente como banco, acessado pelas rotas do servidor. O navegador não recebe a chave de serviço. A implementação usa NextAuth **5.0.0-beta.32**, fixado no package.json, com sessões JWT de oito horas.

Google e e-mail confirmado convergem para o mesmo usuário pelo e-mail normalizado. O painel exige login pelo provedor de credenciais administrativo e autorização atual no banco. Entrar com Google no e-mail do administrador não libera o painel. A sessão do navegador é compartilhada: entrar no painel substitui a sessão de participante.

## Ativar a migração na Vercel

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

## Rodar e verificar

Node.js 22 ou posterior. Execute `npm ci`, `npm run dev`. Verificação: `npm run typecheck`, `npm test`, `npm run build`.

Os testes cobrem migração de identidades, preservação de prêmios/estoques, permissões das rotas e do banco, senha administrativa, código de uso único, limites de tentativas, telefone, probabilidades, idempotência e retirada. Usam PostgreSQL local via PGlite e substitutos dos serviços externos; não substituem o login real no Google e a entrega real de mensagens SMTP.

## Regras da campanha

- Copo: 30 unidades, 3%; chaveiro: 200, 20%; caneta: 200, 20%; sem prêmio: 47%; tente novamente: 10%.
- Sorteio real: função `pulsik_spin_v2` na migração NextAuth. Estoque e resultado são gravados na mesma transação. Prêmio esgotado converte sua chance em sem prêmio.
- Um resultado final por usuário/e-mail na campanha; tente novamente mantém o direito de girar. Repetir a mesma requisição devolve o resultado existente.
- Telefone obrigatório com 11 dígitos. Máscara em `lib/phone.ts`: `(85) 98925-5170`.
- Campanha aberta de 07/10/2026 00:00 a 10/10/2026 00:00, UTC−3.
- Textos, redes sociais e campanha em `lib/config.ts`; logotipos no cabeçalho `components/shell.tsx`.

## Rotas e proteção

`/` participação real; `/demo` demonstração local sem consumir estoque; `/admin` painel de equipe; `/regras` e `/privacidade` informações públicas. Falta de configuração não ativa demonstração silenciosamente.

`auth.ts` configura a autenticação; `lib/server/` concentra acesso ao banco e validação; `app/api/` contém autenticação, envio de código, participação, giro e administração. As rotas derivam a identidade da sessão e verificam a autorização no servidor. As mutações verificam a origem. A migração bloqueia o acesso direto de anon/authenticated às tabelas e funções da aplicação.

Códigos expiram em dez minutos, são armazenados como HMAC e consumidos uma única vez. Cinco erros bloqueiam o código; reenvio limitado por e-mail e IP. Login administrativo tem limite persistente de tentativas por usuário. A biblioteca SMTP foi atualizada, com override no package.json, para evitar a versão antiga sugerida pelo peer opcional do NextAuth. Não usamos o provedor Nodemailer interno do NextAuth.
