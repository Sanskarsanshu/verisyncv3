import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as attendanceService from '../services/attendanceService.js';
import { getClientIp, parseUserAgent } from '../utils/request.js';
import { SessionType } from '@prisma/client';

export async function createSession(req: AuthRequest, res: Response) {
  try {
    const { type } = req.body as { type: SessionType };
    const session = await attendanceService.getOrCreateSession(
      type,
      req.user?.role === 'teacher' ? req.user.sub : undefined
    );
    res.json({ sessionId: session.id, type: session.type, date: session.date });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create session';
    res.status(500).json({ error: message });
  }
}

export async function markFace(req: AuthRequest, res: Response) {
  try {
    const { embedding, sessionId, confidence } = req.body;
    const result = await attendanceService.markFaceAttendance(
      embedding,
      sessionId,
      confidence
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Face attendance failed';
    res.status(400).json({ error: message });
  }
}

export async function markQr(req: AuthRequest, res: Response) {
  try {
    const { qrToken, sessionId } = req.body;
    const result = await attendanceService.markQrAttendance(qrToken, sessionId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'QR attendance failed';
    res.status(400).json({ error: message });
  }
}

export async function getProfile(req: AuthRequest, res: Response) {
  try {
    const profile = await attendanceService.getStudentProfile(req.user!.sub);
    res.json(profile);
  } catch (err) {
    res.status(404).json({ error: 'Profile not found' });
  }
}

export async function getTeacherDashboard(req: AuthRequest, res: Response) {
  try {
    const dashboard = await attendanceService.getTeacherDashboard(
      req.user?.role === 'teacher' ? req.user.sub : undefined
    );
    res.json(dashboard);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
}

export async function getHistory(req: AuthRequest, res: Response) {
  try {
    const studentId =
      req.user?.role === 'student' ? req.user.sub : undefined;
    const history = await attendanceService.getAttendanceHistory(50, studentId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load history' });
  }
}

export async function getEmbeddings(_req: AuthRequest, res: Response) {
  try {
    const data = await attendanceService.getAllEmbeddingsForClient();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load embeddings' });
  }
}

export async function getConfig(_req: AuthRequest, res: Response) {
  res.json({
    similarityThreshold: parseFloat(process.env.FACE_SIMILARITY_THRESHOLD ?? '0.6'),
  });
}

export async function reEnroll(req: AuthRequest, res: Response) {
  try {
    const { embeddings } = req.body;
    const result = await attendanceService.reEnrollFace(req.user!.sub, embeddings);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Face re-enrollment failed';
    res.status(400).json({ error: message });
  }
}

export async function getDynamicStatus(req: AuthRequest, res: Response) {
  try {
    const { sessionCode, token } = req.query as { sessionCode: string; token: string };
    const result = await attendanceService.getDynamicAttendanceStatus(
      req.user!.sub,
      sessionCode,
      token
    );
    res.json(result);
  } catch {
    res.status(400).json({ error: 'Failed to check attendance status' });
  }
}

export async function markDynamic(req: AuthRequest, res: Response) {
  try {
    const { sessionCode, token } = req.body;
    const ua = req.headers['user-agent'];
    const { browser, device } = parseUserAgent(ua);

    const result = await attendanceService.markDynamicAttendance(req.user!.sub, sessionCode, token, {
      ipAddress: getClientIp(req),
      userAgent: ua ?? 'unknown',
      browser,
      device,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Attendance failed';
    res.status(400).json({ error: message });
  }
}
