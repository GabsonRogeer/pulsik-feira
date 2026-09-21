import "server-only";
import assets from "./assets.json";

/** Logos are PNG MIME attachments: no external image requests or deployment paths. */
export function accessCodeEmail(code: string) {
  if (!/^\d{6}$/.test(code)) throw new Error("invalid_email_code");
  return {
    subject: "Seu código chegou — obrigado por visitar a Pulsik!",
    text: [
      "Pulsik, automação inteligente",
      "Obrigado por nos visitar! Foi um prazer receber você no estande da Pulsik no Siará Tech Summit.",
      "Seu código de acesso é " +
        code +
        ". Válido por 10 minutos e para um único uso.",
      "Volte à página da Pulsik e digite este código para continuar seu acesso.",
      "Não solicitou este código? Pode ignorar esta mensagem. Para sua segurança, não compartilhe o código.",
      "Siga a Pulsik e acompanhe as novidades:",
      "Instagram: https://www.instagram.com/pulsik_ia/",
      "LinkedIn: https://www.linkedin.com/company/pulsik/",
      "Nosso site: https://pulsik.com.br/",
    ].join("\n\n"),
    attachments: [
      {
        filename: "pulsik.png",
        content: assets.pulsik,
        encoding: "base64",
        contentType: "image/png",
        contentDisposition: "inline" as const,
        cid: "pulsik-logo@pulsik.com.br",
      },
      {
        filename: "siara.png",
        content: assets.siara,
        encoding: "base64",
        contentType: "image/png",
        contentDisposition: "inline" as const,
        cid: "siara-logo@pulsik.com.br",
      },
    ],
    html: `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Seu código de acesso à Pulsik</title>
<style>body{margin:0}table{border-collapse:collapse}a{color:#bfa8ff} @media(max-width:600px){.outer{padding:24px 12px!important}.inner{padding:30px 24px!important}.title{font-size:30px!important}.code{font-size:36px!important;letter-spacing:9px!important}.event{width:132px!important}}</style>
</head>
<body style="margin:0;background:#080b18;color:#f5f4fc;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Seu código de acesso chegou. Vamos continuar sua experiência com a Pulsik?</div>
<table role="presentation" width="100%" style="background:#080b18"><tr><td class="outer" align="center" style="padding:36px 20px">
<table role="presentation" width="100%" style="max-width:560px">
<tr><td style="padding:0 8px 24px">
<table role="presentation" width="100%"><tr><td><a href="https://pulsik.com.br/" style="text-decoration:none;color:#f5f4fc"><table role="presentation"><tr><td style="padding-right:8px"><img src="cid:pulsik-logo@pulsik.com.br" alt="" width="34" height="34" style="display:block"></td><td style="font-size:29px;font-weight:700;letter-spacing:-1px">Pulsik<span style="color:#ad92ff">.</span></td></tr></table></a></td><td align="right" style="font-size:10px;letter-spacing:2px;color:#a4abc1">Pulsik, automação<br><span style="line-height:20px;color:#d5ceed">inteligente</span></td></tr></table>
</td></tr>
<tr><td style="height:3px;background:#ad92ff;background-image:linear-gradient(90deg,#ad92ff,#91d9eb);border-radius:20px 20px 0 0"></td></tr>
<tr><td class="inner" style="padding:38px 40px 34px;background:#121629;background-image:linear-gradient(140deg,#242039 0%,#171b30 48%,#111e2c 100%);border:1px solid #34334f;border-top:0;border-radius:0 0 22px 22px">
<table role="presentation" width="100%">
<tr><td style="padding-bottom:24px"><table role="presentation" style="border-collapse:separate;border:1px solid #48435f;border-radius:30px;background:#25263d"><tr><td style="padding:10px 14px"><img class="event" src="cid:siara-logo@pulsik.com.br" width="156" alt="Siará Tech Summit" style="display:block;height:auto"></td><td style="padding:0 14px 0 0;color:#d9d4ed;font-size:12px;font-weight:bold">2026</td></tr></table></td></tr>
<tr><td style="font-size:11px;line-height:18px;letter-spacing:2px;font-weight:bold;color:#91d9eb;padding-bottom:12px">QUE BOM TER VOCÊ AQUI</td></tr>
<tr><td><h1 class="title" style="margin:0;font-size:38px;line-height:1.14;letter-spacing:-1.4px;font-weight:700;color:#f5f4fc">Obrigado por<br>nos visitar<span style="color:#ad92ff">.</span></h1></td></tr>
<tr><td style="padding-top:17px;font-size:15px;line-height:24px;color:#c0c5d8">Foi um prazer receber você no estande da Pulsik no Siará Tech Summit. Sua experiência continua por aqui!</td></tr>
<tr><td style="padding:26px 0 0"><table role="presentation" width="100%" style="border-collapse:separate;background:#0e1122;border:1px solid #645283;border-radius:16px"><tr><td align="center" style="padding:22px 12px 8px;font-size:11px;font-weight:bold;letter-spacing:2px;color:#b8a3e9">SEU CÓDIGO DE ACESSO</td></tr><tr><td class="code" align="center" style="padding:0 0 10px 12px;font-family:Consolas,'Courier New',monospace;font-size:44px;font-weight:bold;line-height:58px;letter-spacing:12px;color:#f5f4fc">${code}</td></tr><tr><td align="center" style="padding:0 12px 22px;font-size:12px;color:#a4abc1">Válido por <strong style="color:#91d9eb;font-weight:normal">10 minutos</strong> · uso único</td></tr></table></td></tr>
<tr><td style="padding:17px 4px 25px;text-align:center;font-size:13px;line-height:21px;color:#c0c5d8">Volte à página da Pulsik e digite este código<br>para continuar seu acesso.</td></tr>
<tr><td style="border-top:1px solid #35374e;padding-top:22px;font-size:12px;line-height:20px;color:#a4abc1">Não solicitou este código? Pode ignorar esta mensagem.<br>Para sua segurança, não compartilhe o código.</td></tr>
</table></td></tr>
<tr><td align="center" style="padding:26px 12px 0;font-size:13px;line-height:21px;color:#b6bdd0">A visita foi só o começo.<br><strong style="font-weight:normal;color:#eceaf7">Siga a Pulsik e acompanhe as novidades.</strong></td></tr>
<tr><td align="center" style="padding:14px 0 22px;font-size:12px"><a href="https://www.instagram.com/pulsik_ia/" style="color:#bfa8ff;text-decoration:none">Instagram ↗</a><span style="color:#464660;padding:0 12px">/</span><a href="https://www.linkedin.com/company/pulsik/" style="color:#bfa8ff;text-decoration:none">LinkedIn ↗</a><span style="color:#464660;padding:0 12px">/</span><a href="https://pulsik.com.br/" style="color:#bfa8ff;text-decoration:none">Nosso site ↗</a></td></tr>
<tr><td align="center" style="font-size:10px;line-height:18px;color:#818aa4">© 2026 Pulsik, automação inteligente<br>Siará Tech Summit · 07 a 09 de outubro</td></tr>
</table></td></tr></table>
</body></html>
`,
  };
}
