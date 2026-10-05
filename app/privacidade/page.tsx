import { Header, Footer } from "@/components/shell";
export default function Privacy() {
  return (
    <>
      <Header />
      <main className="legal glass">
        <a className="text-link" href="/">
          ← Voltar à experiência
        </a>
        <h1>
          Seus dados,
          <br />
          <em>com clareza.</em>
        </h1>
        <h2>Participação na ação Pulsik</h2>
        <p>
          Nome, empresa, cargo, e-mail e telefone são usados pela Pulsik para
          identificar sua participação no Siará Tech Summit, impedir cadastros
          repetidos e organizar a entrega dos brindes. O login com Google ou
          código por e-mail identifica sua conta; não pedimos acesso ao Gmail ou
          aos seus arquivos. Na entrada como convidado, o e-mail é informado por
          você e não é verificado nesse momento. Usamos um cookie de sessão por
          até 8 horas para permitir que você retome sua participação neste
          navegador.
        </p>
        <h2>Novidades da Pulsik</h2>
        <p>
          Receber conteúdos e comunicações comerciais é opcional. A opção do
          formulário começa desmarcada, e sua escolha não altera as chances na
          roleta.
        </p>
        <h2>Contato e solicitações</h2>
        <p>
          Para dúvidas sobre seus dados ou para solicitar o encerramento de
          comunicações, entre em contato pelo e-mail{" "}
          <a href="mailto:contato@pulsik.com.br">contato@pulsik.com.br</a>.
        </p>
        <h2>Sobre a demonstração</h2>
        <p>
          Na demonstração, os dados ficam apenas nesta sessão do navegador. Não
          existe cadastro real nem reserva de brindes. Use dados fictícios para
          testar.
        </p>
      </main>
      <Footer />
    </>
  );
}
