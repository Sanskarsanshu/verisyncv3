import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import RecognitionPanel, { type RecognitionPanelData } from '../../components/RecognitionPanel';
import api from '../../lib/api';
import { useCamera, formatTime } from '../../hooks/useCamera';
import {
  initFacePipeline,
  detectFace,
  generateEmbedding,
} from '../../lib/facePipeline';

export default function FaceAttendancePage() {
  const { videoRef, startCamera, stopCamera, state, fps } = useCamera();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelData, setPanelData] = useState<RecognitionPanelData>({
    cameraConnected: false,
    faceDetected: false,
    confidence: 0,
    attendanceStatus: undefined,
  });
  const processingRef = useRef(false);
  const lastMarkRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      try {
        await initFacePipeline();
        const sessionRes = await api.post('/attendance/session', { type: 'FACE' });
        setSessionId(sessionRes.data.sessionId);
        await startCamera();
      } catch {
        toast.error('Failed to start face attendance session');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !sessionId || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const timestamp = performance.now();
    const face = detectFace(video, timestamp);
    const now = formatTime();

    setPanelData((prev) => ({
      ...prev,
      cameraConnected: state.connected,
      faceDetected: !!face,
      fps,
      timestamp: now,
    }));

    if (face && !processingRef.current) {
      processingRef.current = true;
      setPanelData((prev) => ({ ...prev, attendanceStatus: 'pending' }));

      const embedding = await generateEmbedding(video, face);
      if (embedding) {
        try {
          const res = await api.post('/attendance/face', {
            embedding,
            sessionId,
            confidence: 0,
          });

          const result = res.data;
          const studentKey = result.student?.id ?? 'unknown';

          if (!result.matched) {
            setPanelData({
              cameraConnected: state.connected,
              faceDetected: true,
              confidence: result.confidence ?? 0.32,
              attendanceStatus: 'unknown',
              fps,
              timestamp: now,
              lastRecognitionTime: now,
              message: 'No matching student found in the database.',
            });
          } else if (result.duplicate) {
            if (lastMarkRef.current !== studentKey) {
              toast('⚠ Attendance already marked', { icon: '⚠️' });
            }
            setPanelData({
              cameraConnected: state.connected,
              faceDetected: true,
              confidence: result.confidence,
              studentName: result.student.fullName,
              rollNumber: result.student.rollNumber,
              attendanceStatus: 'duplicate',
              fps,
              timestamp: now,
              lastRecognitionTime: now,
              message: 'Attendance already marked for this session.',
            });
          } else {
            toast.success(
              `✅ Attendance Marked: ${result.student.fullName} (${result.student.rollNumber})`
            );
            setPanelData({
              cameraConnected: state.connected,
              faceDetected: true,
              confidence: result.confidence,
              studentName: result.student.fullName,
              rollNumber: result.student.rollNumber,
              attendanceStatus: 'marked',
              fps,
              timestamp: now,
              lastRecognitionTime: now,
              message: `Method: Face Recognition | Status: Present`,
            });
          }
          lastMarkRef.current = studentKey;
        } catch {
          setPanelData((prev) => ({
            ...prev,
            attendanceStatus: 'unknown',
            message: 'Recognition error',
          }));
        }
      }

      setTimeout(() => {
        processingRef.current = false;
      }, 1500);
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, sessionId, state.connected, fps]);

  useEffect(() => {
    if (!loading && state.connected && sessionId) {
      rafRef.current = requestAnimationFrame(processFrame);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [loading, state.connected, sessionId, processFrame]);

  return (
    <Layout title="Face Recognition Attendance" backTo="/teacher/dashboard">
      {loading ? (
        <div className="text-center text-slate-400">Starting camera and AI models...</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 glass-card">
            <video
              ref={videoRef}
              className="w-full rounded-lg aspect-video object-cover bg-black"
              playsInline
              muted
            />
          </div>
          <RecognitionPanel data={panelData} />
        </div>
      )}
    </Layout>
  );
}
