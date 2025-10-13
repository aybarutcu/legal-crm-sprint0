import { getMailer } from "@/lib/mail/transporter";

type InviteEmailOptions = {
  to: string;
  inviteUrl: string;
  inviterName?: string | null;
  clientName?: string | null;
};

export async function sendClientInvitationEmail(options: InviteEmailOptions) {
  const mailer = getMailer();
  const from =
    process.env.SMTP_FROM ??
    process.env.MAIL_FROM ??
    "Legal CRM <noreply@legalcrm.local>";
  const subject = "Legal CRM Portal davetiniz";
  const greeting = options.clientName ? `Merhaba ${options.clientName},` : "Merhaba,";
  const inviter = options.inviterName ?? "hukuk ekibi";

  const text = [
    greeting,
    "",
    `${inviter} sizi Legal CRM istemci portalına davet etti.`,
    "Aşağıdaki bağlantıyı 24 saat içinde açarak şifrenizi belirleyebilirsiniz:",
    options.inviteUrl,
    "",
    "Bağlantının süresi dolarsa lütfen sizi davet eden kişiyle yeniden iletişime geçin.",
    "",
    "Teşekkürler,",
    "Legal CRM Ekibi",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <p>${greeting}</p>
      <p><strong>${inviter}</strong> sizi Legal CRM istemci portalına davet etti.</p>
      <p>Altındaki butona tıklayarak 24 saat içinde şifrenizi belirleyip hesabınızı aktifleştirebilirsiniz.</p>
      <p style="margin: 24px 0;">
        <a href="${options.inviteUrl}" style="background-color:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
          Portal Davetini Aç
        </a>
      </p>
      <p>Eğer buton çalışmazsa şu adresi tarayıcınıza yapıştırın:</p>
      <p style="word-break: break-all;"><a href="${options.inviteUrl}">${options.inviteUrl}</a></p>
      <p>Bağlantının süresi dolarsa sizi davet eden kişi yeni bir bağlantı gönderebilir.</p>
      <p style="margin-top: 32px;">Teşekkürler,<br/>Legal CRM Ekibi</p>
    </div>
  `;

  await mailer.sendMail({
    from,
    to: options.to,
    subject,
    text,
    html,
  });
}
