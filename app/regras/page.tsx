import { Header, Footer } from "@/components/shell";
import { PRIZES } from "@/lib/config";
export default function Rules() {
  return (
    <>
      <Header />
      <main className="legal glass">
        <a className="text-link" href="/">
          ← Voltar à experiência
        </a>
        <h1>
          Como
          <br />
          <em>participar.</em>
        </h1>
        <p>
          A ação da Pulsik acontece de 7 a 9 de outubro de 2026, no Siará Tech
          Summit. Entre com Google, código por e-mail ou como convidado,
          complete o cadastro e utilize seu giro inicial. É permitida uma
          participação por conta/e-mail durante todo o evento.
        </p>
        <h2>Resultados e chances</h2>
        <ul>
          {PRIZES.map((p) => (
            <li key={p.id}>
              {p.label}: {p.chance}%
              {p.stock ? ` · ${p.stock} unidades no total` : ""}.
            </li>
          ))}
        </ul>
        <p>
          “Tente outra vez” concede uma nova chance na mesma participação,
          sempre que for sorteado. Um prêmio ou “Não foi dessa vez” encerra a
          participação. As fatias são ilustrativas e têm o mesmo tamanho; as
          chances são as informadas acima.
        </p>
        <h2>Disponibilidade e retirada</h2>
        <p>
          Ao ser sorteado, o brinde fica reservado e um código individual é
          emitido. Apresente-o no estande da Pulsik para retirar agora ou
          depois, durante os dias do evento. Cada código permite uma única
          retirada. Se um prêmio esgotar, sua chance passa para “Não foi dessa
          vez”.
        </p>
        <p>
          Se a conexão cair, entre novamente com a mesma conta para retomar sua
          participação ou consultar o resultado. O sorteio salvo não é
          substituído.
        </p>
        <p>
          Como convidado, informe seu próprio e-mail. Um e-mail já cadastrado
          precisa de acesso com Google ou código por e-mail. A sessão de
          convidado dura até 8 horas neste navegador; depois disso, confirme o
          mesmo e-mail para acessar sua participação e o resultado salvo.
        </p>
        <p className="notice">
          A demonstração é apenas um teste da experiência e não concede brindes.
        </p>
      </main>
      <Footer />
    </>
  );
}
