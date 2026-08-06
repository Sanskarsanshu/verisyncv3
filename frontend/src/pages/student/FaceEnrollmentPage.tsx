import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import api, { setRegistrationToken, fetchCurrentUser } from '../../lib/api';
import { useCamera } from '../../hooks/useCamera';
import {
  initFacePipeline,
  detectFace,
  detectLiveness,
  generateEmbedding,
  isLivenessComplete,
  type LivenessState,
} from '../../lib/facePipeline';

const TARGET_SAMPLES = 30;

export default function FaceEnrollmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReEnroll = searchParams.get('mode') === 're-enroll';
  const { videoRef, startCamera, stopCamera, state, fps } = useCamera();
  const [loading, setLoading] = useState(true);
  const [samples, setSamples] = useState<number[][]>([]);
  const [liveness, setLiveness] = useState<LivenessState>({
    lookLeft: false,
    lookRight: false,
    lookUp: false,
    lookDown: false,
    blink: false,
  });
  const [faceDetected, setFaceDetected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const rafRef = useRef<number>(0);
  const lastCaptureRef = useRef(0);
  const livenessRef = useRef(liveness);
  const samplesRef = useRef(samples);

  useEffect(() => {
    livenessRef.current = liveness;
  }, [liveness]);

  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  useEffect(() => {
    if (isReEnroll) {
      fetchCurrentUser().then((user) => {
        if (!user || user.role !== 'student') {
          toast.error('Please log in first');
          navigate('/student/login');
          return;
        }
        initCamera();
      });
    } else {
      const token = localStorage.getItem('registrationToken');
      if (!token) {
        toast.error('Please complete Step 1 first');
        navigate('/student/register');
        return;
      }
      initCamera();
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, [isReEnroll, navigate, startCamera, stopCamera]);

  const initCamera = async () => {
    try {
      await initFacePipeline();
      await startCamera();
    } catch (err) {
      console.error('[facePipeline] init failed:', err);
      toast.error('Failed to initialize face recognition');
    } finally {
      setLoading(false);
    }
  };

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const timestamp = performance.now();
    const face = detectFace(video, timestamp);
    setFaceDetected(!!face);

    const updatedLiveness = detectLiveness(video, timestamp, livenessRef.current);
    livenessRef.current = updatedLiveness;
    setLiveness(updatedLiveness);

    if (
      face &&
      isLivenessComplete(updatedLiveness) &&
      samplesRef.current.length < TARGET_SAMPLES &&
      timestamp - lastCaptureRef.current > 200
    ) {
      lastCaptureRef.current = timestamp;
      const embedding = await generateEmbedding(video, face);
      if (embedding) {
        setSamples((prev) => {
          if (prev.length >= TARGET_SAMPLES) return prev;
          const next = [...prev, embedding];
          samplesRef.current = next;
          return next;
        });
      }
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef]);

  useEffect(() => {
    if (!loading && state.connected) {
      rafRef.current = requestAnimationFrame(processFrame);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [loading, state.connected, processFrame]);

  const submitEnrollment = async () => {
    setSubmitting(true);
    try {
      if (isReEnroll) {
        await api.post('/face/re-enroll', { embeddings: samples });
      } else {
        const token = localStorage.getItem('registrationToken');
        await api.post(
          '/auth/register/complete',
          { embeddings: samples },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRegistrationToken(null);
      }
      setComplete(true);
      toast.success(isReEnroll ? 'Face re-enrollment successful!' : 'Registration Successful!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Face enrollment failed';
      toast.error(msg);
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (
      samples.length >= TARGET_SAMPLES &&
      isLivenessComplete(liveness) &&
      !submitting &&
      !complete
    ) {
      submitEnrollment();
    }
  }, [samples.length, liveness, submitting, complete]);

  if (complete) {
    return (
      <Layout title={isReEnroll ? 'Face Re-enrollment Complete' : 'Registration Complete'} backTo="/student">
        <div className="glass-card max-w-md mx-auto text-center space-y-4 animate-fade-in">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-green-400">
            {isReEnroll ? 'Face Re-enrollment Successful' : 'Registration Successful'}
          </h2>
          <p className="text-slate-300">
            {isReEnroll
              ? 'Your face has been re-verified and securely linked with your account.'
              : 'Your face has been verified and securely linked with your account.'}
          </p>
          <p className="text-slate-400 text-sm">
            {isReEnroll
              ? 'You can now use face recognition attendance.'
              : 'You can now log in and use the attendance system.'}
          </p>
          <button className="btn-primary w-full" onClick={() => navigate('/student/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  const livenessSteps = [
    { key: 'lookLeft', label: 'Look Left', done: liveness.lookLeft },
    { key: 'lookRight', label: 'Look Right', done: liveness.lookRight },
    { key: 'lookUp', label: 'Look Up', done: liveness.lookUp },
    { key: 'lookDown', label: 'Look Down', done: liveness.lookDown },
    { key: 'blink', label: 'Blink Once', done: liveness.blink },
  ];

  return (
    <Layout
      title={isReEnroll ? 'Re-enroll Your Face' : 'Register — Step 2: Face Enrollment'}
      backTo={isReEnroll ? '/student/dashboard' : '/student/register'}
    >
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card">
          {loading ? (
            <div className="aspect-video flex items-center justify-center text-slate-400">
              Initializing camera & AI models...
            </div>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-lg aspect-video object-cover bg-black"
                playsInline
                muted
              />
              <div className="absolute top-2 right-2 text-xs bg-black/60 px-2 py-1 rounded">
                {faceDetected ? '✅ Face' : '❌ No Face'} | {fps} FPS
              </div>
            </div>
          )}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Samples captured</span>
              <span>{samples.length} / {TARGET_SAMPLES}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(samples.length / TARGET_SAMPLES) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="glass-card space-y-4">
          <h3 className="font-semibold text-indigo-300">Liveness Verification</h3>
          <p className="text-sm text-slate-400">
            Look straight at the camera, then slowly move your head left, right, and slightly up.
          </p>
          <ul className="space-y-2">
            {livenessSteps.map((step) => (
              <li key={step.key} className="flex items-center gap-2 text-sm">
                <span>{step.done ? '✅' : '⏳'}</span>
                <span className={step.done ? 'text-green-400' : 'text-slate-400'}>{step.label}</span>
              </li>
            ))}
          </ul>
          {!isLivenessComplete(liveness) && (
            <p className="text-amber-400 text-sm">⚠ Complete all liveness steps before samples are saved.</p>
          )}
          {submitting && (
            <p className="text-indigo-300 text-sm animate-pulse">Submitting face embeddings...</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
