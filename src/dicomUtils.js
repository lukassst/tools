import dicomParser from 'dicom-parser';
import JSZip from 'jszip';
import { generateAnonymousId } from './utils';

// DICOM tags to anonymize - using proper hex format
export const TAGS_TO_ANONYMIZE = {
  // Patient Information
  'x00100010': { name: 'PatientName', group: 'Patient' },
  'x00100020': { name: 'PatientID', group: 'Patient' },
  'x00100030': { name: 'PatientBirthDate', group: 'Patient' },
  'x00100040': { name: 'PatientSex', group: 'Patient' },
  'x00101010': { name: 'PatientAge', group: 'Patient' },
  'x00101040': { name: 'PatientAddress', group: 'Patient' },
  'x00101090': { name: 'PatientMotherBirthName', group: 'Patient' },
  'x00101075': { name: 'PatientTelephoneNumbers', group: 'Patient' },
  
  // Institution Information
  'x00080080': { name: 'InstitutionName', group: 'Institution' },
  'x00080081': { name: 'InstitutionAddress', group: 'Institution' },
  
  // Physician Information
  'x00080090': { name: 'ReferringPhysicianName', group: 'Physician' },
  'x00081050': { name: 'PerformingPhysicianName', group: 'Physician' },
  'x00081070': { name: 'OperatorsName', group: 'Physician' },
  'x00081080': { name: 'PhysiciansOfRecord', group: 'Physician' },
  
  // Study and Series Information
  'x00081030': { name: 'StudyDescription', group: 'Study' },
  'x0008103e': { name: 'SeriesDescription', group: 'Study' },
  'x00081030': { name: 'StudyComments', group: 'Study' },
  'x00081038': { name: 'ImageComments', group: 'Study' },
  
  // Dates and Times
  'x00080020': { name: 'StudyDate', group: 'Study' },
  'x00080021': { name: 'SeriesDate', group: 'Study' },
  'x00080022': { name: 'AcquisitionDate', group: 'Study' },
  'x00080023': { name: 'ContentDate', group: 'Study' },
  'x00080030': { name: 'StudyTime', group: 'Study' },
  'x00080031': { name: 'SeriesTime', group: 'Study' },
  'x00080032': { name: 'AcquisitionTime', group: 'Study' },
  'x00080033': { name: 'ContentTime', group: 'Study' },
};

/**
 * Parse DICOM file and extract metadata
 */
export function parseDicomFile(arrayBuffer) {
  try {
    const byteArray = new Uint8Array(arrayBuffer);
    const dataSet = dicomParser.parseDicom(byteArray);
    
    return {
      dataSet,
      byteArray,
      metadata: extractMetadata(dataSet)
    };
  } catch (error) {
    throw new Error(`Failed to parse DICOM: ${error.message}`);
  }
}

/**
 * Extract metadata from DICOM dataset
 */
function extractMetadata(dataSet) {
  const metadata = {};
  
  // Extract UIDs for organization
  try {
    metadata.studyUID = dataSet.string('x0020000d') || 'Unknown';
    metadata.seriesUID = dataSet.string('x0020000e') || 'Unknown';
    metadata.sopUID = dataSet.string('x00080018') || 'Unknown';
  } catch (e) {
    console.warn('Could not extract UIDs:', e);
  }
  
  // Extract patient info
  Object.keys(TAGS_TO_ANONYMIZE).forEach(tag => {
    try {
      const element = dataSet.elements[tag];
      if (element) {
        metadata[tag] = {
          ...TAGS_TO_ANONYMIZE[tag],
          originalValue: dataSet.string(tag),
          tag: tag
        };
      }
    } catch (e) {
      // Tag doesn't exist
    }
  });
  
  return metadata;
}

/**
 * Anonymize DICOM file by modifying byte array directly
 */
export function anonymizeDicomFile(byteArray, anonymizationMap) {
  try {
    const dataSet = dicomParser.parseDicom(byteArray);
    const modifiedByteArray = new Uint8Array(byteArray);
    
    // Modify each tag in the anonymization map
    Object.keys(anonymizationMap).forEach(tag => {
      const newValue = anonymizationMap[tag];
      const element = dataSet.elements[tag];
      
      if (element && newValue !== undefined) {
        try {
          writeStringToElement(modifiedByteArray, element, newValue);
        } catch (e) {
          console.warn(`Failed to modify tag ${tag}:`, e);
        }
      }
    });
    
    return modifiedByteArray;
  } catch (error) {
    console.error('Anonymization error:', error);
    throw error;
  }
}

/**
 * Write string value to DICOM element in byte array
 */
function writeStringToElement(byteArray, element, value) {
  let paddedValue = String(value);
  
  // DICOM strings must be even length
  if (paddedValue.length % 2 !== 0) {
    paddedValue += ' ';
  }
  
  // Truncate or pad to fit element length
  const maxLength = element.length;
  if (paddedValue.length > maxLength) {
    paddedValue = paddedValue.substring(0, maxLength);
  } else {
    paddedValue = paddedValue.padEnd(maxLength, ' ');
  }
  
  // Write to byte array
  for (let i = 0; i < paddedValue.length; i++) {
    byteArray[element.dataOffset + i] = paddedValue.charCodeAt(i);
  }
}

/**
 * Generate anonymization mapping
 */
export function generateAnonymizationMap(metadata, newPatientId) {
  const map = {};
  
  Object.keys(TAGS_TO_ANONYMIZE).forEach(tag => {
    const tagInfo = TAGS_TO_ANONYMIZE[tag];
    
    switch (tagInfo.group) {
      case 'Patient':
        if (tagInfo.name === 'PatientName' || tagInfo.name === 'PatientID') {
          map[tag] = newPatientId;
        } else if (tagInfo.name === 'PatientBirthDate') {
          map[tag] = '19000101';
        } else if (tagInfo.name === 'PatientSex') {
          map[tag] = 'O';
        } else if (tagInfo.name === 'PatientAge') {
          map[tag] = '000Y';
        } else if (tagInfo.name === 'PatientAddress' || tagInfo.name === 'PatientTelephoneNumbers' || tagInfo.name === 'PatientMotherBirthName') {
          map[tag] = '';
        }
        break;
        
      case 'Institution':
        if (tagInfo.name === 'InstitutionAddress') {
          map[tag] = '';
        } else {
          map[tag] = 'ANONYMOUS';
        }
        break;
        
      case 'Physician':
        map[tag] = 'ANONYMOUS';
        break;
        
      case 'Study':
        if (tagInfo.name.includes('Comments') || tagInfo.name.includes('Description')) {
          if (tagInfo.name.includes('Comments')) {
            map[tag] = '';
          } else {
            map[tag] = 'ANONYMIZED';
          }
        } else if (tagInfo.name.includes('Date')) {
          map[tag] = '20000101';
        } else if (tagInfo.name.includes('Time')) {
          map[tag] = '120000';
        }
        break;
    }
  });
  
  return map;
}

/**
 * Process multiple DICOM files and create ZIP
 */
export async function processDicomBatch(files, newPatientId, onProgress) {
  const zip = new JSZip();
  const studyFolder = newPatientId;
  let processedCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { metadata, byteArray } = parseDicomFile(arrayBuffer);
      
      // Generate anonymization map
      const anonymizationMap = generateAnonymizationMap(metadata, newPatientId);
      
      // Anonymize the file
      const anonymizedData = anonymizeDicomFile(byteArray, anonymizationMap);
      
      // Organize by Study/Series/SOP structure
      const studyUID = metadata.studyUID || 'unknown_study';
      const seriesUID = metadata.seriesUID || 'unknown_series';
      const sopUID = metadata.sopUID || `file_${i}`;
      
      const filePath = `${studyFolder}/${studyUID}/${seriesUID}/${sopUID}.dcm`;
      zip.file(filePath, anonymizedData);
      
      processedCount++;
      
      if (onProgress) {
        onProgress(((i + 1) / files.length) * 100);
      }
      
      // Small delay for UI responsiveness
      await new Promise(resolve => setTimeout(resolve, 10));
      
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      // Continue with other files
    }
  }
  
  if (processedCount === 0) {
    throw new Error('No valid DICOM files could be processed');
  }
  
  return zip;
}

/**
 * Analyze DICOM files and return summary
 */
export async function analyzeDicomFiles(files) {
  const analysis = {
    totalFiles: files.length,
    validDicoms: 0,
    invalidFiles: [],
    studies: new Set(),
    series: new Set(),
    tagsFound: {}
  };
  
  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { metadata } = parseDicomFile(arrayBuffer);
      
      analysis.validDicoms++;
      
      if (metadata.studyUID) analysis.studies.add(metadata.studyUID);
      if (metadata.seriesUID) analysis.series.add(metadata.seriesUID);
      
      // Count which tags were found
      Object.keys(metadata).forEach(tag => {
        if (tag !== 'studyUID' && tag !== 'seriesUID' && tag !== 'sopUID') {
          analysis.tagsFound[tag] = (analysis.tagsFound[tag] || 0) + 1;
        }
      });
      
    } catch (error) {
      console.warn(`Failed to parse ${file.name}:`, error.message);
      analysis.invalidFiles.push(file.name);
    }
  }
  
  console.log(`DICOM Analysis: ${analysis.validDicoms}/${analysis.totalFiles} valid files, ${analysis.studies.size} studies, ${analysis.series.size} series`);
  
  return {
    ...analysis,
    studies: analysis.studies.size,
    series: analysis.series.size
  };
}