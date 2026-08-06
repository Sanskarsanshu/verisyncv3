import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  rollNumber: z.string().min(1, 'Roll number is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  semester: z.string().max(20).optional(),
  section: z.string().max(10).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const completeRegistrationSchema = z.object({
  embeddings: z.array(z.array(z.number())).min(20, 'At least 20 embeddings required'),
});

export const faceAttendanceSchema = z.object({
  embedding: z.array(z.number()).min(128),
  sessionId: z.string().uuid(),
  confidence: z.number().optional(),
});

export const qrAttendanceSchema = z.object({
  qrToken: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const createSessionSchema = z.object({
  type: z.enum(['FACE', 'QR']),
});

export const createDynamicSessionSchema = z.object({
  subjectId: z.string().uuid('Valid subject is required'),
  semester: z.string().min(1, 'Semester is required').max(20),
  section: z.string().min(1, 'Section is required').max(10),
  classroom: z.string().min(1, 'Classroom is required').max(50),
  durationMinutes: z.number().int().min(5).max(180).default(30),
});

export const sessionCodeSchema = z.object({
  sessionCode: z
    .string()
    .regex(/^ATT\d{11}$/, 'Invalid session code'),
});

export const dynamicAttendanceSchema = z.object({
  sessionCode: z
    .string()
    .regex(/^ATT\d{11}$/, 'Invalid session code'),
  token: z.string().min(16, 'Invalid QR token'),
});

export const dynamicAttendanceStatusSchema = z.object({
  sessionCode: z.string().regex(/^ATT\d{11}$/, 'Invalid session code'),
  token: z.string().min(16, 'Invalid QR token'),
});
