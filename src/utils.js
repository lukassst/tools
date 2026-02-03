import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use local worker bundled with Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function downloadFile(data, filename, mimeType = 'application/pdf') {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateAnonymousId(prefix = 'ANON') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
}

export const DICOM_TAGS_TO_ANONYMIZE = [
  'PatientName',
  'PatientID',
  'PatientBirthDate',
  'PatientSex',
  'PatientAge',
  'InstitutionName',
  'InstitutionAddress',
  'ReferringPhysicianName',
  'PerformingPhysicianName',
  'OperatorsName',
  'StudyDescription',
  'SeriesDescription'
];