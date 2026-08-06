import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import * as sessionService from '../services/sessionService.js';

export async function getSubjects(_req: AuthRequest, res: Response) {
  try {
    const subjects = await sessionService.listSubjects();
    res.json({ subjects });
  } catch {
    res.status(500).json({ error: 'Failed to load subjects' });
  }
}

export async function createSession(req: AuthRequest, res: Response) {
  try {
    const result = await sessionService.createDynamicSession(req.user!.sub, req.body);
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create session';
    res.status(400).json({ error: message });
  }
}

export async function getCurrentSession(req: AuthRequest, res: Response) {
  try {
    const result = await sessionService.getCurrentSession(req.user!.sub);
    if (!result) {
      res.json({ session: null });
      return;
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to load session' });
  }
}

export async function refreshQr(req: AuthRequest, res: Response) {
  try {
    const { sessionCode } = req.body;
    const result = await sessionService.refreshQr(sessionCode, req.user!.sub);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to refresh QR';
    res.status(400).json({ error: message });
  }
}

export async function stopSession(req: AuthRequest, res: Response) {
  try {
    const { sessionCode } = req.body;
    const result = await sessionService.stopSession(sessionCode, req.user!.sub);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to stop session';
    res.status(400).json({ error: message });
  }
}

export async function getSessionDetail(req: AuthRequest, res: Response) {
  try {
    const { sessionCode } = req.params;
    const result = await sessionService.getSessionDetail(String(sessionCode), req.user!.sub);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load session';
    res.status(404).json({ error: message });
  }
}
