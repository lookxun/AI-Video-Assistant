import nodemailer from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = (process.env.SMTP_SECURE || "true") !== "false";

  if (!host || !user || !pass || !from) return null;

  return { host, port, secure, user, pass, from };
}

export function isSmtpConfigured() {
  return Boolean(getSmtpConfig());
}

export async function sendLoginCodeEmail(email: string, code: string) {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error("SMTP 未配置");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: `闪念 FlashMuse <${config.from}>`,
    to: email,
    subject: "闪念登录验证码",
    text: `你的闪念登录验证码是：${code}。验证码 10 分钟内有效。`,
    html: `
      <div style="font-family: Arial, 'Microsoft YaHei', sans-serif; color: #111; line-height: 1.7;">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">闪念登录验证码</div>
        <div>你的验证码是：</div>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 12px 0;">${code}</div>
        <div style="font-size: 13px; color: #666;">验证码 10 分钟内有效。如果不是你本人操作，可以忽略这封邮件。</div>
      </div>
    `,
  });
}
