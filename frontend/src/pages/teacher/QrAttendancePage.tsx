import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import QrScanPanel, { type QrScanPanelData } from '../../components/QrScanPanel';
import api from '../../lib/api';
import { formatTime } from '../../hooks/useCamera';

export default function QrAttendancePage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [panelData, setPanelData] = useState<QrScanPanelData>({
    cameraConnected: false,
    qrDetected: false,
  });
  const processedTokens = useRef<Set<string>>(new Set());

  useEffect(() => {
    api
      .post('/attendance/session', { type: 'QR' })
      .then((res) => setSessionId(res.data.sessionId))
      .catch((err) => {
        console.error('Failed to create QR session:', err);
        setSessionError('Failed to create attendance session. Please refresh the page.');
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const markAttendance = useCallback(
    async (qrTokenValue: string) => {
      if (processedTokens.current.has(qrTokenValue)) return;
      processedTokens.current.add(qrTokenValue);

      const now = formatTime();
      setPanelData((prev) => ({
        ...prev,
        cameraConnected: true,
        qrDetected: true,
        attendanceStatus: 'pending',
        timestamp: now,
      }));

      try {
        const res = await api.post('/attendance/qr', {
          qrToken: qrTokenValue,
          sessionId,
        });

        const result = res.data;

        if (!result.matched) {
          toast.error('❌ Invalid QR code');
          setPanelData({
            cameraConnected: true,
            qrDetected: true,
            attendanceStatus: 'invalid',
            timestamp: now,
            lastScanTime: now,
            message: 'No matching student found for this QR code.',
          });
        } else if (result.duplicate) {
          toast('⚠ Attendance already marked', { icon: '⚠️' });
          setPanelData({
            cameraConnected: true,
            qrDetected: true,
            studentName: result.student.fullName,
            rollNumber: result.student.rollNumber,
            attendanceStatus: 'duplicate',
            timestamp: now,
            lastScanTime: now,
            message: 'Attendance already marked for this session.',
          });
        } else {
          toast.success(
            `✅ Attendance Marked: ${result.student.fullName} (${result.student.rollNumber})`
          );
          setPanelData({
            cameraConnected: true,
            qrDetected: true,
            studentName: result.student.fullName,
            rollNumber: result.student.rollNumber,
            attendanceStatus: 'marked',
            timestamp: now,
            lastScanTime: now,
            message: 'Method: QR Code | Status: Present',
          });
        }
      } catch {
        toast.error('QR scan failed');
        setPanelData((prev) => ({
          ...prev,
          attendanceStatus: 'unknown',
          message: 'Scan processing error',
        }));
      }
    },
    [sessionId]
  );

  const startScanner = async () => {
    if (!sessionId) return;
    setScanError(null);
    setStarting(true);

    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let cameras = devices.filter((d) => d.kind === 'videoinput');

      if (cameras.length === 0 || !cameras[0].deviceId) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
        cameras = devices.filter((d) => d.kind === 'videoinput');
      }

      if (cameras.length === 0 || !cameras[0].deviceId) {
        throw new Error('No camera found on this device');
      }

      const rear = cameras.find(
        (c) =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment')
      );
      const cameraId = (rear ?? cameras[0]).deviceId;

      const scanner = new Html5Qrcode('qr-reader', {
        verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: false },
      });
      scannerRef.current = scanner;

      const started = scanner
        .start(
          cameraId,
          {
            fps: 5,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.6);
              return { width: size, height: size };
            },
            aspectRatio: 1.3333,
            disableFlip: true,
            videoConstraints: { width: { ideal: 1280 }, height: { ideal: 720 } },
          },
          async (decodedText) => {
            await markAttendance(decodedText);
          },
          () => {}
        )
        .then(() => null, (err) => ({ error: err }));

      const timeout = new Promise<{ timeout: true }>((resolve) =>
        setTimeout(() => resolve({ timeout: true }), 15000)
      );

      const outcome = await Promise.race([started, timeout]);

      if (outcome && 'timeout' in outcome) {
        throw new Error('Camera start timed out — check that no other tab is using the camera');
      }
      if (outcome && 'error' in outcome) {
        throw outcome.error;
      }

      setScanning(true);
      setPanelData((prev) => ({ ...prev, cameraConnected: true }));
    } catch (err) {
      console.error('QR scanner failed to start:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setScanError(msg);
      toast.error('Failed to start QR scanner: ' + msg);
      setPanelData((prev) => ({ ...prev, cameraConnected: false }));
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    } finally {
      setStarting(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      setScanning(false);
      setPanelData((prev) => ({ ...prev, cameraConnected: false, qrDetected: false }));
    }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = manualToken.trim();
    if (!value) return;
    await markAttendance(value);
    setManualToken('');
  };

  return (
    <Layout title="QR Code Attendance" backTo="/teacher/dashboard">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card">
          <div className="relative">
            <div
              id="qr-reader"
              className="w-full aspect-video bg-black rounded-lg overflow-hidden"
            />
            {scanning && !scanError && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-52 h-52 border-2 border-green-400 rounded-xl bg-green-400/5" />
                <p className="mt-3 text-xs text-white bg-black/70 px-3 py-1 rounded-full">
                  Hold the QR code inside the box, about 15–20 cm from the camera
                </p>
              </div>
            )}
            {!scanning && !scanError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-xs text-slate-500">
                  {starting ? 'Starting camera...' : 'Camera preview appears here'}
                </p>
              </div>
            )}
          </div>
          {scanError && (
            <p className="mt-2 text-xs text-red-400">
              Camera error: {scanError}. Use manual entry below instead.
            </p>
          )}
          {sessionError && (
            <p className="mt-2 text-xs text-red-400">
              {sessionError} Use manual entry below instead.
            </p>
          )}
          <div className="flex gap-4 mt-4">
            {!scanning ? (
              <button className="btn-primary flex-1" onClick={startScanner} disabled={!sessionId || starting}>
                {starting ? 'Starting camera...' : 'Start QR Scanner'}
              </button>
            ) : (
              <button className="btn-secondary flex-1" onClick={stopScanner}>
                Stop Scanner
              </button>
            )}
          </div>

          <form onSubmit={submitManual} className="mt-4 flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Or enter QR token manually"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
            <button type="submit" className="btn-secondary text-sm" disabled={!sessionId}>
              Mark
            </button>
          </form>
        </div>

        <QrScanPanel data={panelData} />
      </div>
    </Layout>
  );
}
