import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { signRegistrationToken } from '../middleware/auth.js';

const SALT_ROUNDS = 12;

export async function validateRegistration(data: {
  fullName: string;
  rollNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
  semester?: string;
  section?: string;
}) {
  if (data.password !== data.confirmPassword) {
    throw new Error('Password and Confirm Password must match');
  }

  if (data.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const existingStudent = await prisma.student.findFirst({
    where: {
      OR: [{ email: data.email.toLowerCase() }, { rollNumber: data.rollNumber }],
    },
  });

  if (existingStudent) {
    if (existingStudent.email === data.email.toLowerCase()) {
      throw new Error('Email is already registered');
    }
    throw new Error('Roll Number is already registered');
  }

  await prisma.pendingRegistration.deleteMany({
    where: {
      OR: [{ email: data.email.toLowerCase() }, { rollNumber: data.rollNumber }],
    },
  });

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const pending = await prisma.pendingRegistration.create({
    data: {
      fullName: data.fullName.trim(),
      rollNumber: data.rollNumber.trim(),
      email: data.email.toLowerCase().trim(),
      passwordHash,
      semester: data.semester?.trim() || null,
      section: data.section?.trim().toUpperCase() || null,
      expiresAt,
    },
  });

  const registrationToken = signRegistrationToken(pending.id);

  return { registrationToken, pendingId: pending.id };
}

export async function completeRegistration(
  pendingId: string,
  embeddings: number[][]
) {
  if (!embeddings || embeddings.length < 20) {
    throw new Error('At least 20 face samples are required');
  }

  const pending = await prisma.pendingRegistration.findUnique({
    where: { id: pendingId },
  });

  if (!pending) {
    throw new Error('Registration session not found or expired');
  }

  if (pending.expiresAt < new Date()) {
    await prisma.pendingRegistration.delete({ where: { id: pendingId } });
    throw new Error('Registration session expired. Please start again.');
  }

  const duplicate = await prisma.student.findFirst({
    where: {
      OR: [{ email: pending.email }, { rollNumber: pending.rollNumber }],
    },
  });

  if (duplicate) {
    await prisma.pendingRegistration.delete({ where: { id: pendingId } });
    throw new Error('Student already registered with this email or roll number');
  }

  const student = await prisma.student.create({
    data: {
      fullName: pending.fullName,
      rollNumber: pending.rollNumber,
      email: pending.email,
      passwordHash: pending.passwordHash,
      semester: pending.semester,
      section: pending.section,
      faceVerified: true,
      faceEmbeddings: {
        create: embeddings.map((embedding) => ({ embedding })),
      },
      qrToken: {
        create: {
          token: uuidv4(),
        },
      },
    },
    include: { qrToken: true },
  });

  await prisma.pendingRegistration.delete({ where: { id: pendingId } });

  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      email: student.email,
      semester: student.semester,
      section: student.section,
      faceVerified: student.faceVerified,
    },
  };
}

export async function loginStudent(email: string, password: string) {
  const student = await prisma.student.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!student) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, student.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  if (!student.faceVerified) {
    throw new Error('Face verification is incomplete');
  }

  return {
    user: {
      id: student.id,
      role: 'student' as const,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      email: student.email,
      semester: student.semester,
      section: student.section,
      faceVerified: student.faceVerified,
    },
  };
}

export async function loginTeacher(email: string, password: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!teacher) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, teacher.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return {
    user: {
      id: teacher.id,
      role: 'teacher' as const,
      fullName: teacher.name,
      email: teacher.email,
    },
  };
}
