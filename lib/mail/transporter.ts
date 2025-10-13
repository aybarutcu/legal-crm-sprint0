import nodemailer from "nodemailer";

type Transporter = ReturnType<typeof nodemailer.createTransport>;

const globalMailer = globalThis as unknown as { __legalCrmMailer?: Transporter };

function createTransporter(): Transporter {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      user && pass
        ? {
            user,
            pass,
          }
        : undefined,
  });
}

export function getMailer() {
  if (!globalMailer.__legalCrmMailer) {
    globalMailer.__legalCrmMailer = createTransporter();
  }
  return globalMailer.__legalCrmMailer;
}
