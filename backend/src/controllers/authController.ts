import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest, setAuthCookies, clearAuthCookies } from '../middleware/auth.js';
import * as authService from '../services/authService.js';

export async function registerValidate(req: AuthRequest, res: Response) {
  try {
    const result = await authService.validateRegistration(req.body);
    res.status(200).json({
      message: 'Registration validated. Proceed to face enrollment.',
      registrationToken: result.registrationToken,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    res.status(400).json({ error: message });
  }
}

export async function registerComplete(req: AuthRequest, res: Response) {
  try {
    const pendingId = req.user!.sub;
    const { embeddings } = req.body;
    const result = await authService.completeRegistration(pendingId, embeddings);
    // Auto-login the newly registered student via HttpOnly session cookie.
    setAuthCookies(res, {
      sub: result.student.id,
      role: 'student',
      email: result.student.email,
    });
    res.status(201).json({
      message: 'Registration Successful. Your face has been verified and securely linked with your account.',
      student: result.student,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    res.status(400).json({ error: message });
  }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginStudent(email, password);
    setAuthCookies(res, {
      sub: result.user.id,
      role: result.user.role,
      email: result.user.email,
    });
    res.json({ user: result.user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    const status = message.includes('Face verification') ? 403 : 401;
    res.status(status).json({ error: message });
  }
}

export async function teacherLogin(req: AuthRequest, res: Response) {
  try {
    const { email, password } = req.body;
    const result = await authService.loginTeacher(email, password);
    setAuthCookies(res, {
      sub: result.user.id,
      role: result.user.role,
      email: result.user.email,
    });
    res.json({ user: result.user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid email or password' });
  }
}

export async function me(req: AuthRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    if (req.user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({ where: { id: req.user.sub } });
      if (!teacher) {
        clearAuthCookies(res);
        res.status(401).json({ error: 'Account not found' });
        return;
      }
      res.json({
        role: 'teacher',
        id: teacher.id,
        fullName: teacher.name,
        email: teacher.email,
      });
      return;
    }

    const student = await prisma.student.findUnique({ where: { id: req.user.sub } });
    if (!student) {
      clearAuthCookies(res);
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    res.json({
      role: 'student',
      id: student.id,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      email: student.email,
      semester: student.semester,
      section: student.section,
      faceVerified: student.faceVerified,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load session' });
  }
}

export async function logout(_req: AuthRequest, res: Response) {
  clearAuthCookies(res);
  res.json({ message: 'Logged out' });
}
