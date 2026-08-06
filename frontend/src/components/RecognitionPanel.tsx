export interface RecognitionPanelData {
  cameraConnected: boolean;
  faceDetected: boolean;
  confidence: number;
  studentName?: string;
  rollNumber?: string;
  attendanceStatus?: 'marked' | 'duplicate' | 'unknown' | 'pending';
  timestamp?: string;
  fps?: number;
  lastRecognitionTime?: string;
  message?: string;
}

interface Props {
  data: RecognitionPanelData;
}

function StatusIcon({ ok }: { ok: boolean }) {
  return <span>{ok ? '✅' : '❌'}</span>;
}

export default function RecognitionPanel({ data }: Props) {
  return (
    <div className="glass-card space-y-3 text-sm">
      <h3 className="text-lg font-semibold text-indigo-300 border-b border-slate-700 pb-2">
        Real-Time Recognition Status
      </h3>

      <div className="flex justify-between">
        <span className="text-slate-400">Camera</span>
        <span><StatusIcon ok={data.cameraConnected} /> {data.cameraConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-400">Face</span>
        <span><StatusIcon ok={data.faceDetected} /> {data.faceDetected ? 'Detected' : 'No Face Detected'}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-400">Recognition Confidence</span>
        <span className="font-bold text-indigo-300">{(data.confidence * 100).toFixed(1)}%</span>
      </div>

      {data.fps !== undefined && (
        <div className="flex justify-between">
          <span className="text-slate-400">FPS</span>
          <span>{data.fps}</span>
        </div>
      )}

      {data.studentName && (
        <>
          <div className="flex justify-between">
            <span className="text-slate-400">Matched Student</span>
            <span className="font-medium">{data.studentName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Roll Number</span>
            <span>{data.rollNumber}</span>
          </div>
        </>
      )}

      <div className="flex justify-between">
        <span className="text-slate-400">Attendance</span>
        <span>
          {data.attendanceStatus === 'marked' && '✅ Marked Successfully'}
          {data.attendanceStatus === 'duplicate' && '⚠ Already Marked'}
          {data.attendanceStatus === 'unknown' && '❌ Unknown Face'}
          {data.attendanceStatus === 'pending' && '⏳ Processing...'}
          {!data.attendanceStatus && '—'}
        </span>
      </div>

      {data.timestamp && (
        <div className="flex justify-between">
          <span className="text-slate-400">Time</span>
          <span>{data.timestamp}</span>
        </div>
      )}

      {data.lastRecognitionTime && (
        <div className="flex justify-between">
          <span className="text-slate-400">Last Recognition</span>
          <span>{data.lastRecognitionTime}</span>
        </div>
      )}

      {data.message && (
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-700">{data.message}</p>
      )}
    </div>
  );
}
