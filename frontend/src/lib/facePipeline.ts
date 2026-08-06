import {
  FaceDetector,
  FilesetResolver,
  FaceLandmarker,
} from '@mediapipe/tasks-vision';
import * as ort from 'onnxruntime-web';

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const FACE_DETECTOR_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const FACE_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const RECOGNITION_MODEL_URL = '/models/w600k_r50.onnx';

let faceDetector: FaceDetector | null = null;
let faceLandmarker: FaceLandmarker | null = null;
let recognitionSession: ort.InferenceSession | null = null;

export async function initFacePipeline(): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  if (!faceDetector) {
    faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_DETECTOR_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
  }

  if (!faceLandmarker) {
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
  }

  if (!recognitionSession) {
    ort.env.wasm.wasmPaths =
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
    recognitionSession = await ort.InferenceSession.create(RECOGNITION_MODEL_URL, {
      executionProviders: ['wasm'],
    });
  }
}

export interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
  landmarks?: Array<{ x: number; y: number; z?: number }>;
}

export function detectFace(
  video: HTMLVideoElement,
  timestamp: number
): DetectedFace | null {
  if (!faceDetector) return null;

  const result = faceDetector.detectForVideo(video, timestamp);
  if (!result.detections.length) return null;

  const det = result.detections[0];
  const box = det.boundingBox;
  if (!box) return null;

  return {
    boundingBox: {
      x: box.originX,
      y: box.originY,
      width: box.width,
      height: box.height,
    },
  };
}

export interface LivenessState {
  lookLeft: boolean;
  lookRight: boolean;
  lookUp: boolean;
  lookDown: boolean;
  blink: boolean;
}

export function detectLiveness(
  video: HTMLVideoElement,
  timestamp: number,
  state: LivenessState
): LivenessState {
  if (!faceLandmarker) return state;

  const result = faceLandmarker.detectForVideo(video, timestamp);
  if (!result.faceLandmarks.length) return state;

  const landmarks = result.faceLandmarks[0];
  const blendshapes = result.faceBlendshapes?.[0]?.categories ?? [];

  const noseTip = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const forehead = landmarks[10];
  const chin = landmarks[152];

  const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
  const yaw = noseTip.x - faceCenterX;

  const faceCenterY = (forehead.y + chin.y) / 2;
  const pitch = noseTip.y - faceCenterY;

  const newState = { ...state };

  if (yaw < -0.02) newState.lookLeft = true;
  if (yaw > 0.02) newState.lookRight = true;
  if (pitch < -0.015) newState.lookUp = true;
  if (pitch > 0.015) newState.lookDown = true;

  const eyeBlink = blendshapes.find(
    (b) => b.categoryName === 'eyeBlinkLeft' || b.categoryName === 'eyeBlinkRight'
  );
  if (eyeBlink && eyeBlink.score > 0.5) {
    newState.blink = true;
  }

  return newState;
}

export function isLivenessComplete(state: LivenessState): boolean {
  return (
    state.lookLeft &&
    state.lookRight &&
    state.lookUp &&
    state.lookDown &&
    state.blink
  );
}

export async function generateEmbedding(
  video: HTMLVideoElement,
  face: DetectedFace
): Promise<number[] | null> {
  if (!recognitionSession) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const { x, y, width, height } = face.boundingBox;
  const pad = 0.2;
  const px = Math.max(0, x - width * pad);
  const py = Math.max(0, y - height * pad);
  const pw = Math.min(video.videoWidth - px, width * (1 + 2 * pad));
  const ph = Math.min(video.videoHeight - py, height * (1 + 2 * pad));

  canvas.width = 112;
  canvas.height = 112;
  ctx.drawImage(video, px, py, pw, ph, 0, 0, 112, 112);

  const imageData = ctx.getImageData(0, 0, 112, 112);
  const float32Data = new Float32Array(3 * 112 * 112);

  for (let i = 0; i < 112 * 112; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    float32Data[i] = (r - 127.5) / 127.5;
    float32Data[112 * 112 + i] = (g - 127.5) / 127.5;
    float32Data[2 * 112 * 112 + i] = (b - 127.5) / 127.5;
  }

  try {
    const inputName = recognitionSession.inputNames[0];
    const tensor = new ort.Tensor('float32', float32Data, [1, 3, 112, 112]);
    const feeds: Record<string, ort.Tensor> = { [inputName]: tensor };
    const results = await recognitionSession.run(feeds);
    const outputName = recognitionSession.outputNames[0];
    const output = results[outputName].data as Float32Array;

    const embedding = Array.from(output);
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    return embedding.map((v) => v / norm);
  } catch {
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export type { LivenessState as LivenessCheckState };
