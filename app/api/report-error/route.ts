import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

type ReportPayload = {
  email?: string;
  description?: string;
  screenshot?: string | null;
  page?: string;
  userAgent?: string;
};

function buildFallbackMailto(to: string, payload: ReportPayload) {
  const subject = encodeURIComponent('Reporte de error - Tutor Medicina');
  const body = encodeURIComponent(
    [
      `Correo de contacto: ${payload.email || 'No proporcionado'}`,
      `Pagina: ${payload.page || 'No disponible'}`,
      '',
      'Descripcion del error:',
      payload.description || 'Sin descripcion',
    ].join('\n'),
  );

  return `mailto:${to}?subject=${subject}&body=${body}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Error desconocido';
}

function buildReportEmailText(options: {
  reporterEmail?: string;
  description: string;
  includeTechnicalMetadata: boolean;
  sourcePage: string;
  forwardedFor: string;
  userAgent: string;
}) {
  const baseLines = [
    `Correo de contacto: ${options.reporterEmail || 'No proporcionado'}`,
    '',
    'Descripcion del error:',
    options.description,
  ];

  if (!options.includeTechnicalMetadata) {
    return baseLines.join('\n');
  }

  return [
    ...baseLines,
    '',
    '---',
    'Datos tecnicos (debug):',
    `Pagina: ${options.sourcePage}`,
    `IP (x-forwarded-for): ${options.forwardedFor}`,
    `User-Agent: ${options.userAgent}`,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  let payload: ReportPayload = {};
  const toEmail = process.env.SUPPORT_EMAIL_TO;

  try {
    payload = (await request.json()) as ReportPayload;
    const description = payload.description?.trim();
    const reporterEmail = payload.email?.trim();

    if (!description) {
      return NextResponse.json(
        { success: false, error: 'La descripcion del error es obligatoria.' },
        { status: 400 },
      );
    }

    if (description.length > 3000) {
      return NextResponse.json(
        { success: false, error: 'La descripcion es demasiado larga.' },
        { status: 400 },
      );
    }

    if (reporterEmail && reporterEmail.length > 320) {
      return NextResponse.json(
        { success: false, error: 'El correo es demasiado largo.' },
        { status: 400 },
      );
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT ?? '587');
    const smtpUser = process.env.SMTP_USER;
    const rawSmtpPass = process.env.SMTP_PASS;
    const smtpPass = rawSmtpPass?.replace(/\s+/g, '');
    const fromEmail = process.env.SMTP_FROM ?? smtpUser;
    const smtpTlsRejectUnauthorized = (process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? 'true') !== 'false';
    const includeTechnicalMetadata = (process.env.REPORT_EMAIL_INCLUDE_METADATA ?? 'false') === 'true';

    if (!toEmail) {
      return NextResponse.json(
        { success: false, error: 'Falta configurar SUPPORT_EMAIL_TO.' },
        { status: 500 },
      );
    }

    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'No hay configuracion de correo SMTP. Configura las variables de entorno.',
          fallbackMailto: buildFallbackMailto(toEmail, payload),
        },
        { status: 500 },
      );
    }

    if (smtpHost.includes('gmail.com') && smtpPass.length !== 16) {
      return NextResponse.json(
        {
          success: false,
          error: 'SMTP_PASS parece invalido para Gmail. Usa una App Password de 16 caracteres.',
          fallbackMailto: buildFallbackMailto(toEmail, payload),
        },
        { status: 500 },
      );
    }

    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: smtpTlsRejectUnauthorized,
      },
    });

    const attachments = [] as Array<{ filename: string; content: string; encoding: 'base64' }>;
    if (payload.screenshot?.startsWith('data:image/png;base64,')) {
      const base64 = payload.screenshot.replace('data:image/png;base64,', '');
      attachments.push({
        filename: `error-captura-${Date.now()}.png`,
        content: base64,
        encoding: 'base64',
      });
    }

    const userAgent = payload.userAgent || 'No disponible';
    const sourcePage = payload.page || 'No disponible';
    const forwardedFor = request.headers.get('x-forwarded-for') || 'No disponible';

    await transport.sendMail({
      from: fromEmail,
      to: toEmail,
      replyTo: reporterEmail || undefined,
      subject: 'Nuevo reporte de error - Tutor Medicina',
      text: buildReportEmailText({
        reporterEmail,
        description,
        includeTechnicalMetadata,
        sourcePage,
        forwardedFor,
        userAgent,
      }),
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const fallback = toEmail ? buildFallbackMailto(toEmail, payload) : undefined;

    return NextResponse.json(
      {
        success: false,
        error: `Error al enviar correo SMTP: ${getErrorMessage(error)}`,
        fallbackMailto: fallback,
      },
      { status: 500 },
    );
  }
}
