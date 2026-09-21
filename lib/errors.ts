export function errorText(error: unknown) {
  const m = (error as { message?: string })?.message || "";
  if (m.includes("campaign_closed"))
    return "A participação estará disponível de 7 a 9 de outubro de 2026.";
  if (m.includes("duplicate_email"))
    return "Este e-mail já participou. Entre com a conta usada no cadastro.";
  if (m.includes("google_required") || m.includes("verified_email_required"))
    return "Entre com Google ou confirme seu e-mail para participar.";
  if (m.includes("not_registered"))
    return "Conclua seu cadastro antes de girar.";
  if (m.includes("invalid_phone"))
    return "Informe o telefone com DDD e 11 dígitos, como (85) 98925-5170.";
  if (m.includes("invalid_fields"))
    return "Confira os campos do cadastro e tente novamente.";
  return "Não foi possível concluir agora. Confira sua conexão e tente novamente. Seu giro não será perdido.";
}
