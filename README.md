# Pulsik · Siará Tech Summit

Aplicação responsiva com glassmorphism, cadastro, roleta animada, confetes, comprovante do prêmio, redes sociais e painel da equipe. Evento configurado de 07 a 09/10/2026, horário de Fortaleza (UTC−3).

## Estado da entrega

A aplicação abre em **demonstração** enquanto não houver as duas variáveis públicas do Supabase. Os dados da demonstração são fictícios e ficam somente na sessão do navegador; não reservam brindes. O painel `/admin/` usa exemplos separados, identificados como demonstração. O usuário confirmou que possui apenas uma organização no Supabase e pediu a estrutura pronta; nenhum projeto remoto foi criado ou alterado.

O fluxo real está implementado, mas precisa de um novo projeto Supabase, da aplicação da migração e da habilitação do Google. Essa conexão externa ainda não foi testada. O código não inclui chave secreta ou acesso de administrador ao banco no navegador.

## Tecnologias

- Next.js, React e TypeScript. Exportação estática para hospedagem na Vercel ou em outro serviço HTTPS.
- CSS responsivo com tokens, transparência e blur; sem dependência de Tailwind, já que o visual foi implementado em CSS próprio.
- Supabase Auth (Google / PKCE) e PostgreSQL. Regras críticas executadas em funções transacionais do banco, não no navegador.
- Lucide, canvas-confetti e qrcode.react.

## Rodar

1. Instale Node.js 22 ou posterior e execute `npm ci`.
2. Execute `npm run dev` e abra o endereço informado.
3. `npm run typecheck`, `npm test` e `npm run build` verificam tipos, regras do banco e a versão de produção.
4. A versão exportada fica em `out/`. Não abra diretamente como arquivo; sirva por HTTP/HTTPS.

## Conectar o Supabase

1. Crie um projeto na organização da Pulsik. Guarde a senha do banco no gerenciador de senhas; ela não é usada pelo aplicativo.
2. Execute **uma vez**, pelo SQL Editor do novo projeto, `supabase/migrations/202609170001_pulsik.sql`. A migração é transacional e usa tabelas com prefixo `pulsik_`.
3. Copie `.env.example` para `.env.local`. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com a URL e a chave pública publishable ou anon. Nunca use `service_role` em variável pública.
4. No Supabase, habilite Google em Authentication → Sign In / Providers. Crie o cliente OAuth Web no Google Cloud; configure ali exatamente a URL de callback que o Supabase fornece. O segredo Google deve ficar apenas no painel Supabase.
5. Configure o endereço final como Site URL e autorize os redirects exatos: `https://SEU-DOMINIO/` e `https://SEU-DOMINIO/admin/`. Para testes, autorize também o endereço local correspondente. Publique a tela de consentimento do Google adequadamente para os visitantes do evento.
6. Recompile e publique com as duas variáveis públicas presentes **durante o build**. A exportação estática não lê variáveis novas depois de publicada.
7. Faça um login da conta da equipe. No SQL Editor, autorize explicitamente seu usuário:

```sql
insert into public.pulsik_admins (user_id)
select id from auth.users where lower(email) = lower('EMAIL_DA_EQUIPE');
```

Cada conta da equipe deve ser cadastrada individualmente. Nenhuma pessoa é promovida por domínio do e-mail.

## Antes da feira

- Configure e teste o login real e as URLs de retorno em um projeto separado de teste, sem consumir o estoque do evento.
- A campanha real só aceita novos cadastros/giros entre 07/10/2026 00:00 e 10/10/2026 00:00 UTC−3. Ajuste os horários no banco se a operação do estande tiver outra janela.
- As porcentagens são 3% copo, 20% chaveiro, 20% caneta, 47% sem prêmio e 10% nova chance. Sempre que houver nova chance, a participação continua; um resultado final encerra.
- Estoques: 30 copos, 200 chaveiros e 200 canetas, compartilhados entre os três dias. Não foram impostas cotas diárias, pois essa sugestão não foi confirmada.
- Um prêmio esgotado transfere sua chance para “Não foi dessa vez”. As fatias têm tamanhos iguais, com explicação explícita de que não representam probabilidades.
- Confirme as condições de retirada, horários e texto de uso de dados da campanha antes de divulgá-la. O texto atual limita a retirada aos dias do evento.
- Redes encontradas nos perfis públicos: Instagram `https://www.instagram.com/pulsik_ia/` e LinkedIn `https://www.linkedin.com/company/pulsik/`. Edite `lib/config.ts` caso prefira outros endereços.
- Acesse `/admin/` para gerar o QR Code do **endereço público definitivo**. O link privado de demonstração não serve para os visitantes da feira. Verifique o QR em outro celular antes de imprimir.

## Regras e segurança implementadas

Identidade Google verificada por `auth.users` e `auth.identities`; e-mail derivado do servidor. Índices únicos por campanha/usuário e campanha/e-mail normalizado. Bloqueio transacional durante cadastro e sorteio. Estoque reservado na mesma transação do resultado. Resultado idempotente, com chave de requisição que permite repetir a chamada após perda de conexão. “Tente outra vez” mantém o cadastro apto a novo giro; resultados finais nunca são substituídos. Código aleatório único e retirada idempotente, restrita a administradores. Tabelas protegidas por RLS; nenhum participante pode alterar estoque ou resultado diretamente.

O navegador só anima o resultado recebido. A seleção de resultado para testes existe apenas na demonstração e nunca é enviada à função de sorteio real. A preferência por novidades é opcional e começa desmarcada.

## Rotas

- `/`: participação real quando configurada, demonstração identificada enquanto desconectada.
- `/demo/`: demonstração isolada, inclusive após conectar o Supabase.
- `/admin/`: consulta, estoque, entrega, exportação e gerador de QR Code.
- `/regras/` e `/privacidade/`: informações para o participante.

## Testes

Os testes usam a migração real em PostgreSQL local com PGlite, com substitutos apenas para o esquema de autenticação do Supabase e para sorteios determinísticos no banco isolado. Cobrem janela do evento, identidade, unicidade, probabilidades, repetição segura, nova chance, estoque esgotado, permissões e retirada repetida. Eles não substituem o teste real de OAuth nem um teste de carga multiusuário na infraestrutura final.

## Hospedagem

O projeto continua compatível com Vercel: preset Next.js, comando `npm run build`, diretório exportado `out`. Para a demonstração, `.openai/hosting.json` registra a publicação privada no Sites. O backend Supabase é externo e independe do serviço de hospedagem da interface.
