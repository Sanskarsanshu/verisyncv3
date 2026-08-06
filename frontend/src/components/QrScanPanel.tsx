export interface QrScanPanelData {
  cameraConnected: boolean;
  qrDetected: boolean;
  studentName?: string;
  rollNumber?: string;
  attendanceStatus?: 'marked' | 'duplicate' | 'unknown' | 'pending' | 'invalid';
  timestamp?: string;
  lastScanTime?: string;
  message?: string;
}

interface Props {
  data: QrScanPanelData;
}

function StatusIcon({ ok }: { ok: boolean }) {
  return <span>{ok ? '✅' : '❌'}</span>;
}

export default function QrScanPanel({ data }: Props) {
  return (
    <div className="glass-card space-y-3 text-sm">
      <h3 className="text-lg font-semibold text-indigo-300 border-b border-slate-700 pb-2">
        Real-Time QR Scan Status
      </h3>

      <div className="flex justify-between">
        <span className="text-slate-400">Camera</span>
        <span>
          <StatusIcon ok={data.cameraConnected} />{' '}
          {data.cameraConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-slate-400">QR Code</span>
        <span>
          <StatusIcon ok={data.qrDetected} />{' '}
          {data.qrDetected ? 'Detected' : 'Waiting for scan...'}
        </span>
      </div>

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
          {data.attendanceStatus === 'unknown' && '❌ Unknown QR'}
          {data.attendanceStatus === 'invalid' && '❌ Invalid QR Code'}
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

      {data.lastScanTime && (
        <div className="flex justify-between">
          <span className="text-slate-400">Last Scan</span>
          <span>{data.lastScanTime}</span>
        </div>
      )}

      {data.message && (
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-700">{data.message}</p>
      )}
    </div>
  );
}
