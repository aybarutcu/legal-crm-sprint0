import { getMailer } from "@/lib/mail/transporter";

type ResetEmailOptions = {
  to: string;
  resetUrl: string;
  clientName?: string | null;
};

export async function sendClientPasswordResetEmail(options: ResetEmailOptions) {
  const mailer = getMailer();
  const from =
    process.env.SMTP_FROM ??
    process.env.MAIL_FROM ??
    "Legal CRM <noreply@legalcrm.local>";
  const subject = "Legal CRM Portal şifre sıfırlama";
  const greeting = options.clientName ? `Merhaba ${options.clientName},` : "Merhaba,";

  const text = [
    greeting,
    "",
    "Legal CRM istemci portalındaki şifrenizi sıfırlamak için aşağıdaki bağlantıyı 24 saat içinde kullanın:",
    options.resetUrl,
    "",
    "Eğer bu işlemi siz başlatmadıysanız, bu e-postayı yok sayabilirsiniz.",
    "",
    "Teşekkürler,",
    "Legal CRM Ekibi",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <p>${greeting}</p>
      <p>Legal CRM istemci portalındaki şifrenizi sıfırlamak için aşağıdaki butonu 24 saat içerisinde kullanabilirsiniz.</p>
      <p style="margin: 24px 0;">
        <a href="${options.resetUrl}" style="background-color:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
          Şifreyi Sıfırla
        </a>
      </p>
      <p>Eğer buton çalışmazsa şu adresi tarayıcınıza yapıştırın:</p>
      <p style="word-break: break-all;"><a href="${options.resetUrl}">${options.resetUrl}</a></p>
      <p>Bu talebi siz başlatmadıysanız herhangi bir işlem yapmanıza gerek yoktur.</p>
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
