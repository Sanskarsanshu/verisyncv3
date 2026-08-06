import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export const QR_REFRESH_SECONDS = 30;

function appBaseUrl(): string {
  const url = process.env.PUBLIC_APP_URL?.trim();
  if (!url) {
    console.error(
      '[Dynamic QR] PUBLIC_APP_URL is not configured. ' +
        'Set PUBLIC_APP_URL in backend/.env (e.g. https://abc123.trycloudflare.com) ' +
        'to generate attendance QR codes.'
    );
    throw new Error(
      'PUBLIC_APP_URL is not configured. Set PUBLIC_APP_URL in backend/.env ' +
        'to your public URL (Cloudflare Tunnel, ngrok, or domain) to generate QR codes.'
    );
  }
  return url.replace(/\/+$/, '');
}

export function attendanceUrl(sessionCode: string, token: string): string {
  return `${appBaseUrl()}/attendance?session=${encodeURIComponent(sessionCode)}&token=${encodeURIComponent(token)}`;
}

function generateSecureToken(): string {
  return randomBytes(24).toString('hex');
}

async function nextSessionCode(): Promise<string> {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const prefix = `ATT${date}`;
    const existing = await prisma.session.count({
      where: { sessionCode: { startsWith: prefix } },
    });
    const sequence = String(existing + 1).padStart(3, '0');
    const candidate = `${prefix}${sequence}`;

    const exists = await prisma.session.findUnique({ where: { sessionCode: candidate } });
    if (!exists) return candidate;
  }
  throw new Error('Could not allocate a session code');
}

async function invalidateSessionTokens(sessionId: string) {
  await prisma.sessionToken.deleteMany({ where: { sessionId } });
}

async function createQrForSession(sessionId: string, sessionCode: string) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + QR_REFRESH_SECONDS * 1000);

  const record = await prisma.sessionToken.create({
    data: { sessionId, token, expiresAt },
  });

  const url = attendanceUrl(sessionCode, record.token);
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 320,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return {
    token: record.token,
    qrUrl: url,
    qrDataUrl,
    expiresAt: record.expiresAt,
  };
}

export async function listSubjects() {
  return prisma.subject.findMany({ orderBy: { name: 'asc' } });
}

export async function createDynamicSession(
  teacherId: string,
  data: { subjectId: string; semester: string; section: string; classroom: string; durationMinutes: number }
) {
  const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
  if (!subject) {
    throw new Error('Subject not found');
  }

  const sessionCode = await nextSessionCode();
  const startTime = new Date();
  const expiryTime = new Date(startTime.getTime() + data.durationMinutes * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      teacherId,
      type: 'QR',
      isActive: true,
      status: 'ACTIVE',
      sessionCode,
      subjectName: subject.name,
      subjectCode: subject.code,
      semester: data.semester,
      section: data.section.toUpperCase(),
      classroom: data.classroom,
      startTime,
      expiryTime,
    },
  });

  const qr = await createQrForSession(session.id, sessionCode);

  return {
    session: serializeSession(session),
    qr,
  };
}

export async function getCurrentSession(teacherId: string) {
  const session = await prisma.session.findFirst({
    where: { teacherId, status: 'ACTIVE', sessionCode: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: {
      sessionTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { attendances: true } },
    },
  });

  if (!session) return null;

  const token = session.sessionTokens[0];
  let qr: { token: string; qrUrl: string; qrDataUrl: string; expiresAt: Date } | null = null;
  if (token) {
    const url = attendanceUrl(session.sessionCode!, token.token);
    qr = {
      token: token.token,
      qrUrl: url,
      qrDataUrl: await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }),
      expiresAt: token.expiresAt,
    };
  }

  return {
    session: serializeSession(session),
    present: session._count.attendances,
    qr,
  };
}

export async function refreshQr(sessionCode: string, teacherId: string) {
  const session = await prisma.session.findUnique({ where: { sessionCode } });
  if (!session) {
    throw new Error('Session not found');
  }
  if (session.teacherId !== teacherId) {
    throw new Error('Not authorized for this session');
  }
  if (session.status !== 'ACTIVE') {
    throw new Error('Session is not active');
  }
  if (session.expiryTime && session.expiryTime < new Date()) {
    throw new Error('Session has expired');
  }

  await invalidateSessionTokens(session.id);
  const qr = await createQrForSession(session.id, session.sessionCode!);

  return { session: serializeSession(session), qr };
}

export async function stopSession(sessionCode: string, teacherId: string) {
  const session = await prisma.session.findUnique({ where: { sessionCode } });
  if (!session) {
    throw new Error('Session not found');
  }
  if (session.teacherId !== teacherId) {
    throw new Error('Not authorized for this session');
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { status: 'ENDED', isActive: false },
  });

  await invalidateSessionTokens(session.id);

  return { session: serializeSession(updated) };
}

export async function getSessionDetail(sessionCode: string, teacherId: string) {
  const session = await prisma.session.findUnique({
    where: { sessionCode },
    include: {
      attendances: {
        orderBy: { markedAt: 'asc' },
        include: { student: { select: { id: true, fullName: true, rollNumber: true, section: true } } },
      },
      sessionTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }
  if (session.teacherId !== teacherId) {
    throw new Error('Not authorized for this session');
  }

  const token = session.sessionTokens[0];
  return {
    session: serializeSession(session),
    present: session.attendances.length,
    attendance: session.attendances.map((a) => ({
      id: a.id,
      studentName: a.student.fullName,
      rollNumber: a.student.rollNumber,
      section: a.student.section,
      method: a.method,
      markedAt: a.markedAt,
    })),
    qr: token
      ? {
          token: token.token,
          qrUrl: attendanceUrl(sessionCode, token.token),
          expiresAt: token.expiresAt,
        }
      : null,
  };
}

function serializeSession(session: {
  id: string;
  sessionCode: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  semester: string | null;
  section: string | null;
  classroom: string | null;
  startTime: Date | null;
  expiryTime: Date | null;
  status: string;
  isActive: boolean;
}) {
  return {
    id: session.id,
    sessionCode: session.sessionCode,
    subjectName: session.subjectName,
    subjectCode: session.subjectCode,
    semester: session.semester,
    section: session.section,
    classroom: session.classroom,
    startTime: session.startTime,
    expiryTime: session.expiryTime,
    status: session.status,
    isActive: session.isActive,
  };
}
