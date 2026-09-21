import { QRCodeSVG } from "qrcode.react";

import type { AdminModel } from "./use-admin";
export function QrPanel({ model }: { model: AdminModel }) {
  const { qrUrl, setQrUrl, validQr } = model;
  return (
    <section className="glass qr-panel">
      <div>
        <h2>O primeiro passo é um scan.</h2>
        <p>
          Informe o endereço público definitivo da aplicação para gerar o QR
          Code do estande.
        </p>
        <label>
          Endereço da aplicação
          <input
            type="url"
            placeholder="https://seu-endereco-publico"
            value={qrUrl}
            onChange={(e) => setQrUrl(e.target.value)}
          />
        </label>
        <p className="input-note">
          Não use o link privado da demonstração no material da feira. Confira o
          acesso sem login do proprietário antes de imprimir.
        </p>
      </div>
      {validQr ? (
        <div className="qr-code">
          <QRCodeSVG value={qrUrl} size={180} marginSize={4} level="M" />
          <button className="text-button" onClick={() => window.print()}>
            Imprimir QR Code
          </button>
        </div>
      ) : (
        <p>O QR Code aparecerá após inserir uma URL HTTPS válida.</p>
      )}
    </section>
  );
}
