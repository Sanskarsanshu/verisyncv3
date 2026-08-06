import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import {
  cosineSimilarity,
  getSimilarityThreshold,
} from '../utils/face.js';
import { AttendanceMethod, SessionType } from '@prisma/client';

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getOrCreateSession(
  type: SessionType,
  teacherId?: string
) {
  const date = todayDate();

  let session = await prisma.session.findFirst({
    where: {
      type,
      date,
      isActive: true,
      ...(teacherId ? { teacherId } : {}),
    },
  });

  if (!session) {
    session = await prisma.session.create({
      data: {
        type,
        date,
        teacherId: teacherId ?? null,
        isActive: true,
      },
    });
  }

  return session;
}

export async function markFaceAttendance(
  embedding: number[],
  sessionId: string,
  confidenceFromClient?: number
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { attendances: true },
  });

  if (!session || !session.isActive) {
    throw new Error('Invalid or inactive attendance session');
  }

  const students = await prisma.student.findMany({
    where: { faceVerified: true },
    include: { faceEmbeddings: true },
  });

  let bestMatch: {
    student: (typeof students)[0];
    confidence: number;
  } | null = null;

  const threshold = getSimilarityThreshold();

  for (const student of students) {
    for (const fe of student.faceEmbeddings) {
      const sim = cosineSimilarity(embedding, fe.embedding);
      if (sim >= threshold && (!bestMatch || sim > bestMatch.confidence)) {
        bestMatch = { student, confidence: sim };
      }
    }
  }

  if (!bestMatch) {
    return {
      matched: false as const,
      confidence: confidenceFromClient ?? 0,
      message: 'No matching student found in the database',
    };
  }

  const existing = await prisma.attendance.findUnique({
    where: {
      studentId_sessionId: {
        studentId: bestMatch.student.id,
        sessionId,
      },
    },
  });

  if (existing) {
    return {
      matched: true as const,
      duplicate: true as const,
      student: {
        id: bestMatch.student.id,
        fullName: bestMatch.student.fullName,
        rollNumber: bestMatch.student.rollNumber,
      },
      confidence: bestMatch.confidence,
      markedAt: existing.markedAt,
      message: 'Attendance already marked',
    };
  }

  const attendance = await prisma.attendance.create({
    data: {
      studentId: bestMatch.student.id,
      sessionId,
      method: AttendanceMethod.FACE,
      confidence: bestMatch.confidence,
    },
  });

  return {
    matched: true as const,
    duplicate: false as const,
    student: {
      id: bestMatch.student.id,
      fullName: bestMatch.student.fullName,
      rollNumber: bestMatch.student.rollNumber,
    },
    confidence: bestMatch.confidence,
    markedAt: attendance.markedAt,
    message: 'Attendance Marked Successfully',
  };
}

export async function markQrAttendance(qrToken: string, sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.isActive) {
    throw new Error('Invalid or inactive attendance session');
  }

  const tokenRecord = await prisma.qrToken.findUnique({
    where: { token: qrToken },
    include: { student: true },
  });

  if (!tokenRecord) {
    return {
      matched: false as const,
      message: 'Invalid QR code',
    };
  }

  if (!tokenRecord.student.faceVerified) {
    return {
      matched: false as const,
      message: 'Student face verification incomplete',
    };
  }

  const existing = await prisma.attendance.findUnique({
    where: {
      studentId_sessionId: {
        studentId: tokenRecord.studentId,
        sessionId,
      },
    },
  });

  if (existing) {
    return {
      matched: true as const,
      duplicate: true as const,
      student: {
        id: tokenRecord.student.id,
        fullName: tokenRecord.student.fullName,
        rollNumber: tokenRecord.student.rollNumber,
      },
      markedAt: existing.markedAt,
      message: 'Attendance already marked',
    };
  }

  const attendance = await prisma.attendance.create({
    data: {
      studentId: tokenRecord.studentId,
      sessionId,
      method: AttendanceMethod.QR,
    },
  });

  return {
    matched: true as const,
    duplicate: false as const,
    student: {
      id: tokenRecord.student.id,
      fullName: tokenRecord.student.fullName,
      rollNumber: tokenRecord.student.rollNumber,
    },
    markedAt: attendance.markedAt,
    message: 'Attendance Marked Successfully',
  };
}

export async function getStudentProfile(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      qrToken: true,
      attendances: {
        orderBy: { markedAt: 'desc' },
        take: 20,
        include: { session: true },
      },
    },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const attendedCount = await prisma.attendance.count({
    where: { studentId },
  });

  const distinctSessionDays = await prisma.attendance.findMany({
    where: { studentId },
    select: {
      sessionId: true,
      session: { select: { date: true } },
    },
    distinct: ['sessionId'],
  });

  const totalClassDays = await prisma.session.groupBy({
    by: ['date'],
    where: { isActive: true },
  });

  const attendancePercentage =
    totalClassDays.length > 0
      ? Math.round((distinctSessionDays.length / totalClassDays.length) * 1000) / 10
      : 0;

  let qrToken = student.qrToken;
  if (!qrToken) {
    qrToken = await prisma.qrToken.upsert({
      where: { studentId },
      update: {},
      create: { studentId, token: uuidv4() },
    });
  }

  let qrCodeDataUrl: string | null = null;
  if (qrToken) {
    qrCodeDataUrl = await QRCode.toDataURL(qrToken.token, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
  }

  return {
    fullName: student.fullName,
    rollNumber: student.rollNumber,
    email: student.email,
    faceVerified: student.faceVerified,
    totalClassesAttended: attendedCount,
    attendancePercentage,
    qrCodeDataUrl,
    qrToken: qrToken?.token ?? null,
    recentAttendance: student.attendances.map((a) => ({
      id: a.id,
      date: a.markedAt,
      time: a.markedAt,
      method: a.method,
      confidence: a.confidence,
    })),
  };
}

export async function getTeacherDashboard(teacherId?: string) {
  const date = todayDate();

  const todaySessions = await prisma.session.findMany({
    where: { date, isActive: true },
    include: {
      attendances: {
        include: {
          student: {
            select: { fullName: true, rollNumber: true },
          },
        },
        orderBy: { markedAt: 'desc' },
      },
    },
  });

  const todayAttendance = todaySessions.flatMap((s) =>
    s.attendances.map((a) => ({
      id: a.id,
      studentName: a.student.fullName,
      rollNumber: a.student.rollNumber,
      method: a.method,
      markedAt: a.markedAt,
      confidence: a.confidence,
      sessionType: s.type,
    }))
  );

  const totalStudents = await prisma.student.count({
    where: { faceVerified: true },
  });

  return {
    totalStudents,
    todayAttendanceCount: todayAttendance.length,
    todayAttendance,
    activeSessions: todaySessions.map((s) => ({
      id: s.id,
      type: s.type,
      attendanceCount: s.attendances.length,
    })),
  };
}

export async function getAttendanceHistory(
  limit = 50,
  studentId?: string
) {
  const records = await prisma.attendance.findMany({
    where: studentId ? { studentId } : undefined,
    take: limit,
    orderBy: { markedAt: 'desc' },
    include: {
      student: {
        select: { fullName: true, rollNumber: true },
      },
      session: true,
    },
  });

  return records.map((r) => ({
    id: r.id,
    studentName: r.student.fullName,
    rollNumber: r.student.rollNumber,
    method: r.method,
    markedAt: r.markedAt,
    confidence: r.confidence,
    sessionType: r.session.type,
  }));
}

export async function reEnrollFace(studentId: string, embeddings: number[][]) {
  if (!embeddings || embeddings.length < 20) {
    throw new Error('At least 20 face samples are required');
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
  });

  if (!student) {
    throw new Error('Student not found');
  }

  await prisma.faceEmbedding.deleteMany({ where: { studentId } });

  await prisma.student.update({
    where: { id: studentId },
    data: {
      faceVerified: true,
      faceEmbeddings: {
        create: embeddings.map((embedding) => ({ embedding })),
      },
    },
  });

  return { message: 'Face re-enrollment successful' };
}

export async function getAllEmbeddingsForClient() {
  const students = await prisma.student.findMany({
    where: { faceVerified: true },
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      faceEmbeddings: { select: { embedding: true } },
    },
  });

  return students.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    rollNumber: s.rollNumber,
    embeddings: s.faceEmbeddings.map((e) => e.embedding),
  }));
}

async function loadActiveDynamicSession(sessionCode: string) {
  const session = await prisma.session.findUnique({
    where: { sessionCode },
    include: { teacher: { select: { id: true, name: true } } },
  });

  if (!session || session.sessionCode === null || !session.status) {
    return null;
  }

  // Lazily auto-expire sessions whose time is up.
  if (session.status === 'ACTIVE' && session.expiryTime && session.expiryTime < new Date()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'EXPIRED', isActive: false },
    });
    session.status = 'EXPIRED';
    session.isActive = false;
  }

  return session;
}

interface DynamicSessionInfo {
  sessionCode: string;
  subjectName: string | null;
  subjectCode: string | null;
  semester: string | null;
  section: string | null;
  classroom: string | null;
  teacherName: string | null;
  status: string;
  expiryTime: Date | null;
}

function serializeDynamicSession(session: NonNullable<Awaited<ReturnType<typeof loadActiveDynamicSession>>>): DynamicSessionInfo {
  return {
    sessionCode: session.sessionCode!,
    subjectName: session.subjectName,
    subjectCode: session.subjectCode,
    semester: session.semester,
    section: session.section,
    classroom: session.classroom,
    teacherName: session.teacher?.name ?? null,
    status: session.status,
    expiryTime: session.expiryTime,
  };
}

export async function getDynamicAttendanceStatus(
  studentId: string,
  sessionCode: string,
  token: string
) {
  const session = await loadActiveDynamicSession(sessionCode);
  if (!session || session.sessionCode === null) {
    return { valid: false, reason: 'SESSION_NOT_FOUND' as const };
  }

  const tokenRecord = await prisma.sessionToken.findUnique({
    where: { token },
    include: { session: { select: { sessionCode: true } } },
  });

  const tokenValid =
    tokenRecord !== null &&
    tokenRecord.session.sessionCode === sessionCode &&
    tokenRecord.expiresAt > new Date() &&
    tokenRecord.consumedAt === null;

  if (!tokenValid) {
    return { valid: false, reason: 'TOKEN_INVALID' as const };
  }

  if (session.status !== 'ACTIVE') {
    return { valid: false, reason: 'SESSION_INACTIVE' as const };
  }

  const existing = await prisma.attendance.findUnique({
    where: { studentId_sessionId: { studentId, sessionId: session.id } },
  });

  return {
    valid: true,
    alreadyMarked: existing !== null,
    session: serializeDynamicSession(session),
    studentId,
  };
}

export async function markDynamicAttendance(
  studentId: string,
  sessionCode: string,
  token: string,
  meta: { ipAddress: string; userAgent: string; browser: string; device: string }
) {
  const session = await loadActiveDynamicSession(sessionCode);
  if (!session || session.sessionCode === null) {
    return { matched: false, reason: 'SESSION_NOT_FOUND', message: 'Attendance session not found' };
  }

  if (session.status !== 'ACTIVE') {
    return { matched: false, reason: 'SESSION_INACTIVE', message: 'Attendance session is no longer active' };
  }

  const tokenRecord = await prisma.sessionToken.findUnique({
    where: { token },
    include: { session: { select: { sessionCode: true } } },
  });

  const tokenValid =
    tokenRecord !== null &&
    tokenRecord.session.sessionCode === sessionCode &&
    tokenRecord.expiresAt > new Date() &&
    tokenRecord.consumedAt === null;

  if (!tokenValid) {
    return { matched: false, reason: 'TOKEN_EXPIRED', message: 'QR Code Expired. Please Scan Again' };
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return { matched: false, reason: 'STUDENT_NOT_FOUND', message: 'Student account not found' };
  }

  // Section membership check: only enforced when both sides declare a section.
  if (session.section && student.section && session.section !== student.section) {
    return {
      matched: false,
      reason: 'SECTION_MISMATCH',
      message: 'You are not enrolled in this section',
    };
  }

  const existing = await prisma.attendance.findUnique({
    where: { studentId_sessionId: { studentId, sessionId: session.id } },
  });

  if (existing) {
    return {
      matched: true,
      alreadyMarked: true,
      student: { id: student.id, fullName: student.fullName, rollNumber: student.rollNumber },
      markedAt: existing.markedAt,
      message: 'Attendance Already Marked',
    };
  }

  const attendance = await prisma.$transaction([
    prisma.attendance.create({
      data: {
        studentId,
        sessionId: session.id,
        method: 'QR',
        sessionCode,
        subject: session.subjectName,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
    // Single-use token: consume to prevent replay attacks.
    prisma.sessionToken.update({
      where: { id: tokenRecord.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return {
    matched: true,
    alreadyMarked: false,
    student: { id: student.id, fullName: student.fullName, rollNumber: student.rollNumber },
    markedAt: attendance[0].markedAt,
    message: 'Attendance Marked Successfully',
  };
}
