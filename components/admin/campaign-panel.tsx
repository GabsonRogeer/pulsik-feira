import { CAMPAIGN } from "@/lib/config";
import { TEST_CAMPAIGN, type CampaignId } from "@/lib/campaign";
import type { AdminModel } from "./use-admin";
export function CampaignPanel({ model }: { model: AdminModel }) {
  const {
    campaignId,
    campaign,
    testing,
    changeCampaign,
    loading,
    saving,
    redeeming,
    toggleTests,
    resetConfirmation,
    setResetConfirmation,
    resetTests,
  } = model;
  const open =
    campaign?.active &&
    Date.now() >= Date.parse(campaign.starts_at) &&
    Date.now() < Date.parse(campaign.ends_at);
  return (
    <section className="glass campaign-panel">
      <div className="campaign-heading">
        <div>
          <h2>{testing ? "Preparação para a feira" : "Campanha da feira"}</h2>
          <p>
            {testing
              ? "Teste login, cadastro, giro e retirada com dados e estoque separados."
              : "Dados e estoque reais do Siará Tech Summit. A participação abre de 7 a 9 de outubro de 2026."}
          </p>
        </div>
        <label>
          Campanha exibida
          <select
            value={campaignId}
            disabled={loading || saving || redeeming}
            onChange={(e) => void changeCampaign(e.target.value as CampaignId)}
          >
            <option value={CAMPAIGN}>Feira · 7 a 9 de outubro</option>
            <option value={TEST_CAMPAIGN}>
              Teste completo · Estoque separado
            </option>
          </select>
        </label>
      </div>
      {testing && (
        <>
          <div className="campaign-actions">
            <span className="status-pill">
              {open ? "Testes abertos" : "Testes pausados ou expirados"}
            </span>
            <button
              className="button secondary"
              disabled={saving || redeeming}
              onClick={toggleTests}
            >
              {saving
                ? "Salvando…"
                : open
                  ? "Pausar testes"
                  : "Ativar testes por 7 dias"}
            </button>
            <a
              className="button primary"
              href="/teste"
              target="_blank"
              rel="noreferrer"
            >
              Abrir experiência de teste ↗
            </a>
          </div>
          {campaign?.active && (
            <p>
              Disponível até{" "}
              {new Date(campaign.ends_at).toLocaleString("pt-BR", {
                timeZone: "America/Fortaleza",
              })}{" "}
              (Fortaleza). Para testar como visitante, use uma janela anônima; a
              sessão desta janela é a do administrador.
            </p>
          )}
          <details className="reset-tests">
            <summary>Limpar os dados desta campanha de teste</summary>
            <p>
              Apaga {model.rows.length} cadastro(s) e todos os giros e retiradas
              de teste, restaura o estoque total configurado abaixo e pausa os
              testes. Os usuários de login e os dados da feira são preservados.
              Exporte os contatos antes, se quiser guardá-los.
            </p>
            <form onSubmit={resetTests}>
              <label>
                Digite LIMPAR TESTES para confirmar
                <input
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  autoComplete="off"
                  placeholder="LIMPAR TESTES"
                />
              </label>
              <button
                className="button secondary danger-button"
                disabled={
                  saving || redeeming || resetConfirmation !== "LIMPAR TESTES"
                }
              >
                Limpar campanha de teste
              </button>
            </form>
          </details>
        </>
      )}
    </section>
  );
}
