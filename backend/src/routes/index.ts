import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as sessionController from '../controllers/sessionController.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  authMiddleware,
  registrationTokenMiddleware,
  csrfProtection,
} from '../middleware/auth.js';
import { authLimiter, attendanceLimiter } from '../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  completeRegistrationSchema,
  faceAttendanceSchema,
  qrAttendanceSchema,
  createSessionSchema,
  createDynamicSessionSchema,
  sessionCodeSchema,
  dynamicAttendanceSchema,
  dynamicAttendanceStatusSchema,
} from '../validators/schemas.js';

const router = Router();

// CSRF double-submit protection for all state-changing API requests.
router.use(csrfProtection);

// ----- Authentication -----
router.post('/auth/register', authLimiter, validateBody(registerSchema), authController.registerValidate);

router.post(
  '/auth/register/complete',
  registrationTokenMiddleware,
  validateBody(completeRegistrationSchema),
  authController.registerComplete
);

router.post('/auth/login', authLimiter, validateBody(loginSchema), authController.login);
router.post(
  '/auth/teacher/login',
  authLimiter,
  validateBody(loginSchema),
  authController.teacherLogin
);
router.get('/auth/me', authMiddleware(['student', 'teacher']), authController.me);
router.post('/auth/logout', authController.logout);

// ----- Face enrollment -----
router.post(
  '/face/enroll',
  registrationTokenMiddleware,
  validateBody(completeRegistrationSchema),
  authController.registerComplete
);

router.post(
  '/face/re-enroll',
  authMiddleware(['student']),
  validateBody(completeRegistrationSchema),
  attendanceController.reEnroll
);

router.get('/face/embeddings', authMiddleware(['teacher']), attendanceController.getEmbeddings);

// ----- Dynamic QR attendance sessions (teacher) -----
router.get('/subjects', authMiddleware(['teacher']), sessionController.getSubjects);
router.post(
  '/session/create',
  authMiddleware(['teacher']),
  validateBody(createDynamicSessionSchema),
  sessionController.createSession
);
router.get('/session/current', authMiddleware(['teacher']), sessionController.getCurrentSession);
router.post(
  '/session/refresh-qr',
  authMiddleware(['teacher']),
  validateBody(sessionCodeSchema),
  sessionController.refreshQr
);
router.post(
  '/session/stop',
  authMiddleware(['teacher']),
  validateBody(sessionCodeSchema),
  sessionController.stopSession
);
router.get(
  '/session/:sessionCode',
  authMiddleware(['teacher']),
  sessionController.getSessionDetail
);

// ----- Dynamic QR attendance (student) -----
router.get(
  '/attendance/dynamic/status',
  authMiddleware(['student']),
  validateQuery(dynamicAttendanceStatusSchema),
  attendanceController.getDynamicStatus
);
router.post(
  '/attendance/dynamic',
  attendanceLimiter,
  authMiddleware(['student']),
  validateBody(dynamicAttendanceSchema),
  attendanceController.markDynamic
);

// ----- Legacy FACE / student-QR attendance -----
router.post(
  '/attendance/session',
  authMiddleware(['teacher']),
  validateBody(createSessionSchema),
  attendanceController.createSession
);
router.post(
  '/attendance/face',
  authMiddleware(['teacher']),
  validateBody(faceAttendanceSchema),
  attendanceController.markFace
);
router.post(
  '/attendance/qr',
  authMiddleware(['teacher']),
  validateBody(qrAttendanceSchema),
  attendanceController.markQr
);
router.get(
  '/attendance/history',
  authMiddleware(['teacher', 'student']),
  attendanceController.getHistory
);

router.get(
  '/student/profile',
  authMiddleware(['student']),
  attendanceController.getProfile
);

router.get(
  '/teacher/dashboard',
  authMiddleware(['teacher']),
  attendanceController.getTeacherDashboard
);

router.get('/config', attendanceController.getConfig);

export default router;
