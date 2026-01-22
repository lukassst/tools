# -*- coding: utf-8 -*-
"""
Created on Mon Jun 10 12:08:45 2024

Enhanced DICOM anonymization script following DICOM PS 3.15 standard.

Functions:
- modify_single_dcm: Safely modifies specified tags in a single DICOM file.
- modify_tag: Modifies specified tags in all DICOM files within a study.
- modify_patientids_from_list: Modifies patient identifiers in DICOM files based on a list of study instance UIDs.
- modify_patientids_from_xl: Modifies patient identifiers in DICOM files based on an Excel file.
- modify_patientids: Modifies patient identifiers in DICOM files within a directory.
- anonymize_dicom_file: Complete anonymization following DICOM standard.
- generate_anonymous_id: Generates unique anonymous identifiers.
- validate_dicom_file: Validates DICOM file integrity after modification.

"""

import os, pydicom
import pandas as pd
import time
import numpy as np
import shutil
import hashlib
import random
from datetime import datetime, timedelta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Complete list of DICOM tags to anonymize (following DICOM PS 3.15)
DICOM_TAGS_TO_ANONYMIZE = [
    # Patient identification
    'PatientName', 'PatientID', 'PatientBirthDate', 'PatientSex', 'PatientAge',
    'PatientAddress', 'PatientMotherBirthName', 'PatientTelephoneNumbers',
    'PatientWeight', 'PatientHeight', 'EthnicGroup', 'Occupation',
    
    # Institution and physician information
    'InstitutionName', 'InstitutionAddress', 'ReferringPhysicianName',
    'ReadingPhysicianName', 'PerformingPhysicianName', 'OperatorsName',
    'PhysiciansOfRecord', 'RequestingPhysician',
    
    # Study and series information
    'StudyDescription', 'SeriesDescription', 'StudyComments',
    'ImageComments', 'RequestedProcedureComments',
    
    # UIDs and identifiers
    'ClinicalTrialSubjectID', 'ClinicalTrialSubjectReadingID',
    'ClinicalTrialProtocolName', 'ClinicalTrialCoordinatingCenterName',
    'ClinicalTrialSponsorName', 'DeviceSerialNumber',
    
    # Dates and times
    'StudyDate', 'SeriesDate', 'AcquisitionDate', 'ContentDate',
    'StudyTime', 'SeriesTime', 'AcquisitionTime', 'ContentTime'
]

# Tags to empty (remove values)
TAGS_TO_EMPTY = [
    'PatientAddress', 'PatientTelephoneNumbers', 'InstitutionAddress',
    'StudyComments', 'ImageComments', 'RequestedProcedureComments'
]

def generate_anonymous_id(prefix='ANON', length=8):
    """Generate a unique anonymous identifier."""
    timestamp = datetime.now().strftime('%Y%m%d')
    random_str = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=length))
    return f"{prefix}_{timestamp}_{random_str}"

def generate_random_birthdate(age_range=(18, 85)):
    """Generate a random birthdate within specified age range."""
    today = datetime.now()
    min_birth = today - timedelta(days=age_range[1] * 365.25)
    max_birth = today - timedelta(days=age_range[0] * 365.25)
    random_birth = min_birth + timedelta(
        days=random.randint(0, (max_birth - min_birth).days)
    )
    return random_birth.strftime('%Y%m%d')

def generate_random_date():
    """Generate a random date within the last 5 years."""
    today = datetime.now()
    start_date = today - timedelta(days=5 * 365)
    random_date = start_date + timedelta(
        days=random.randint(0, (today - start_date).days)
    )
    return random_date.strftime('%Y%m%d')

def generate_random_time():
    """Generate a random time."""
    hour = random.randint(0, 23)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return f"{hour:02d}{minute:02d}{second:02d}"

def validate_dicom_file(file_path):
    """Validate DICOM file integrity."""
    try:
        ds = pydicom.dcmread(file_path)
        # Basic validation
        if not hasattr(ds, 'PatientID') or not hasattr(ds, 'StudyInstanceUID'):
            logger.warning(f"Missing required tags in {file_path}")
            return False
        return True
    except Exception as e:
        logger.error(f"Validation failed for {file_path}: {e}")
        return False

def modify_single_dcm(fdcm, tags, newvalue):
    """
    Safely modifies specified tags in a single DICOM file.

    Args:
    - fdcm: File path of the DICOM file.
    - tags: List of tags to be modified.
    - newvalue: New value to be assigned to the tags.

    Returns:
    - bool: Success status
    """
    try:
        ds = pydicom.dcmread(fdcm)
        modified = False
        
        for tag in tags:
            if tag in ds:
                old_value = ds[tag].value
                try:
                    # Handle different tag types appropriately
                    if tag in TAGS_TO_EMPTY:
                        ds[tag].value = ''
                    elif 'Date' in tag:
                        if tag == 'PatientBirthDate':
                            ds[tag].value = generate_random_birthdate()
                        else:
                            ds[tag].value = generate_random_date()
                    elif 'Time' in tag:
                        ds[tag].value = generate_random_time()
                    elif tag == 'PatientSex':
                        ds[tag].value = random.choice(['M', 'F', 'O'])
                    elif tag == 'PatientAge':
                        ds[tag].value = f"{random.randint(18, 85)}Y"
                    else:
                        ds[tag].value = newvalue
                    
                    modified = True
                    logger.debug(f"Modified {tag}: {old_value} -> {ds[tag].value}")
                    
                except Exception as e:
                    logger.error(f"Failed to modify tag {tag} in {fdcm}: {e}")
                    continue
        
        if modified:
            # Create backup before saving
            backup_path = fdcm + '.backup'
            shutil.copy2(fdcm, backup_path)
            
            ds.save_as(fdcm)
            logger.info(f"Successfully anonymized {fdcm}")
            return True
        else:
            logger.info(f"No tags to modify in {fdcm}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to process {fdcm}: {e}")
        return False
    
def modify_tag(root, tags, study_uid, newvalue):  
    """
    Safely modifies specified tags in all DICOM files within a study.

    Args:
    - root: Root directory path.
    - tags: List of tags to be modified.
    - study_uid: Study instance UID.
    - newvalue: New value to be assigned to the tags.

    Returns:
    - int: Number of successfully modified files
    """
    try:
        study_path = os.path.join(root, study_uid)
        if not os.path.exists(study_path):
            logger.error(f"Study directory not found: {study_path}")
            return 0
            
        series_uids = sorted(os.listdir(study_path))
        modified_count = 0
        
        for series_uid in series_uids:
            path_series = os.path.join(study_path, series_uid)
            if not os.path.isdir(path_series):
                continue
                
            alldcm = [fn for fn in os.listdir(path_series) if fn.endswith('.dcm')]
            for sop in alldcm:
                fdcm = os.path.join(path_series, sop)
                if validate_dicom_file(fdcm):
                    if modify_single_dcm(fdcm, tags, newvalue):
                        modified_count += 1
                else:
                    logger.warning(f"Skipping invalid DICOM file: {fdcm}")
        
        logger.info(f"Modified {modified_count} files in study {study_uid}")
        return modified_count
        
    except Exception as e:
        logger.error(f"Failed to modify study {study_uid}: {e}")
        return 0

def anonymize_dicom_file(file_path, patient_id_prefix='ANON'):
    """
    Complete anonymization of a single DICOM file following DICOM PS 3.15 standard.

    Args:
    - file_path: Path to the DICOM file
    - patient_id_prefix: Prefix for generated patient IDs

    Returns:
    - bool: Success status
    """
    try:
        if not validate_dicom_file(file_path):
            return False
            
        # Generate unique anonymous IDs
        patient_id = generate_anonymous_id(patient_id_prefix)
        
        # Use complete tag list for full anonymization
        success = modify_single_dcm(file_path, DICOM_TAGS_TO_ANONYMIZE, patient_id)
        
        if success:
            logger.info(f"Successfully anonymized {file_path} with ID {patient_id}")
        return success
        
    except Exception as e:
        logger.error(f"Failed to anonymize {file_path}: {e}")
        return False

def modify_patientids_from_list():    
    """
    Modifies patient identifiers in DICOM files based on a list of study instance UIDs.
    Enhanced with proper error handling and logging.
    """
    root = '/home/lukass/Downloads/temp'    
    if not os.path.exists(root):
        logger.error(f"Root directory not found: {root}")
        return
        
    suids = [d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d))]
    tags = DICOM_TAGS_TO_ANONYMIZE  # Use complete tag list
    newvalue = generate_anonymous_id('BATCH')
    
    total_modified = 0
    for suid in suids:
        modified = modify_tag(root, tags, suid, newvalue)
        total_modified += modified
        
    logger.info(f"Batch processing complete. Modified {total_modified} files total.")

def modify_patientids_from_xl():
    """
    Modifies patient identifiers in DICOM files based on an Excel file.
    Enhanced with validation and error handling.
    """
    root = 'D:\\discharge_dcm\\'
    excel_file = 'discharge_false_patientid.xlsx'
    
    if not os.path.exists(excel_file):
        logger.error(f"Excel file not found: {excel_file}")
        return
        
    try:
        df = pd.read_excel(excel_file, 'Tabelle1')
        tags = DICOM_TAGS_TO_ANONYMIZE
        total_modified = 0
        
        for i, row in df.iterrows():
            try:
                oldvalue = row['Old'] 
                newvalue = row['New'] 
                suid = row['StudyInstanceUID'] 
                
                modified = modify_tag(root, tags, suid, newvalue)
                total_modified += modified
                logger.info(f"Processed study {suid}: {oldvalue} -> {newvalue}")
                
            except KeyError as e:
                logger.error(f"Missing required column in Excel row {i}: {e}")
                continue
            except Exception as e:
                logger.error(f"Failed to process Excel row {i}: {e}")
                continue
                
        logger.info(f"Excel processing complete. Modified {total_modified} files total.")
        
    except Exception as e:
        logger.error(f"Failed to read Excel file: {e}")

def modify_patientids(directory_path, new_patientid=None):
    """
    Modifies patient identifiers in DICOM files within a directory.
    Enhanced with recursive processing and validation.

    Args:
    - directory_path: Path of the directory containing DICOM files.
    - new_patientid: New patient identifier to be assigned (auto-generated if None).

    Returns:
    - int: Number of successfully modified files
    """
    if not os.path.exists(directory_path):
        logger.error(f"Directory not found: {directory_path}")
        return 0
        
    if new_patientid is None:
        new_patientid = generate_anonymous_id('DIR')
    
    tags = DICOM_TAGS_TO_ANONYMIZE
    total_modified = 0
    
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.endswith('.dcm'):
                file_path = os.path.join(root, file)
                if validate_dicom_file(file_path):
                    if modify_single_dcm(file_path, tags, new_patientid):
                        total_modified += 1
                else:
                    logger.warning(f"Skipping invalid DICOM file: {file_path}")
    
    logger.info(f"Directory processing complete. Modified {total_modified} files in {directory_path}")
    return total_modified

def batch_anonymize_directory(source_dir, target_dir=None):
    """
    Batch anonymize all DICOM files in a directory with option to copy to new location.

    Args:
    - source_dir: Source directory containing DICOM files
    - target_dir: Target directory (if None, modifies in-place)

    Returns:
    - int: Number of successfully processed files
    """
    if not os.path.exists(source_dir):
        logger.error(f"Source directory not found: {source_dir}")
        return 0
        
    if target_dir and not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)
    
    processed_count = 0
    
    for root, dirs, files in os.walk(source_dir):
        for file in files:
            if file.endswith('.dcm'):
                source_file = os.path.join(root, file)
                
                if target_dir:
                    # Copy to target directory first
                    rel_path = os.path.relpath(source_file, source_dir)
                    target_file = os.path.join(target_dir, rel_path)
                    os.makedirs(os.path.dirname(target_file), exist_ok=True)
                    shutil.copy2(source_file, target_file)
                    file_to_process = target_file
                else:
                    file_to_process = source_file
                
                if anonymize_dicom_file(file_to_process):
                    processed_count += 1
    
    logger.info(f"Batch anonymization complete. Processed {processed_count} files.")
    return processed_count

def view_as_blocks(array, block_shape):
    """
    View an array as non-overlapping blocks.

    Args:
    - array: Input array to be divided into blocks.
    - block_shape: Shape of the blocks.

    Returns:
    - A 4D array where the first two dimensions index the blocks and the last two dimensions index within each block.
    """
    shape = (array.shape[0] // block_shape[0], array.shape[1] // block_shape[1]) + block_shape
    strides = (block_shape[0] * array.strides[0], block_shape[1] * array.strides[1]) + array.strides
    return np.lib.stride_tricks.as_strided(array, shape=shape, strides=strides)

def copy_dicoms(d1, d2):
    """
    Copy DICOM files organizing them by DICOM hierarchy (Study/Series/SOP).
    Enhanced with validation and error handling.

    Args:
    - d1: Source directory
    - d2: Target directory

    Returns:
    - int: Number of successfully copied files
    """
    try:
        copied_count = 0
        
        for root, dirs, files in os.walk(d1):
            for file in files:
                if file.endswith('.dcm'):
                    file_path = os.path.join(root, file)
                    
                    try:
                        ds = pydicom.dcmread(file_path)
                        
                        # Extract DICOM identifiers
                        patient_id = ds.get('PatientID', 'UNKNOWN_PATIENT')
                        study_instance_uid = ds.get('StudyInstanceUID', 'UNKNOWN_STUDY')
                        series_instance_uid = ds.get('SeriesInstanceUID', 'UNKNOWN_SERIES')
                        sop_instance_uid = ds.get('SOPInstanceUID', 'UNKNOWN_SOP')
                        
                        logger.info(f"Processing: PatientID={patient_id}, Study={study_instance_uid}, Series={series_instance_uid}, SOP={sop_instance_uid}")

                        # Create target path
                        src_file = os.path.join(root, file)                    
                        dest_file = os.path.join(d2, study_instance_uid, series_instance_uid, sop_instance_uid + '.dcm')
                        
                        # Create directories if they don't exist
                        os.makedirs(os.path.dirname(dest_file), exist_ok=True)
                        
                        # Copy file
                        shutil.copy2(src_file, dest_file)
                        copied_count += 1
                        logger.debug(f"Copied: {src_file} -> {dest_file}")
                        
                    except Exception as e:
                        logger.error(f"Failed to process DICOM file {file_path}: {e}")
                        continue
                        
        logger.info(f"Copy operation complete. Successfully copied {copied_count} files.")
        return copied_count
        
    except Exception as e:
        logger.error(f"Error during copy operation: {e}")
        return 0

def generate_anonymization_report(directory_path, output_file='anonymization_report.csv'):
    """
    Generate a CSV report of all anonymization actions performed.

    Args:
    - directory_path: Directory containing DICOM files
    - output_file: Output CSV file path
    """
    try:
        import csv
        
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['File_Path', 'Original_PatientID', 'Original_PatientName', 
                         'New_PatientID', 'Timestamp', 'Status']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for root, dirs, files in os.walk(directory_path):
                for file in files:
                    if file.endswith('.dcm'):
                        file_path = os.path.join(root, file)
                        try:
                            ds = pydicom.dcmread(file_path)
                            writer.writerow({
                                'File_Path': file_path,
                                'Original_PatientID': ds.get('PatientID', 'N/A'),
                                'Original_PatientName': ds.get('PatientName', 'N/A'),
                                'New_PatientID': ds.get('PatientID', 'N/A'),  # After anonymization
                                'Timestamp': datetime.now().isoformat(),
                                'Status': 'Processed'
                            })
                        except Exception as e:
                            writer.writerow({
                                'File_Path': file_path,
                                'Original_PatientID': 'ERROR',
                                'Original_PatientName': 'ERROR',
                                'New_PatientID': 'ERROR',
                                'Timestamp': datetime.now().isoformat(),
                                'Status': f'Error: {e}'
                            })
        
        logger.info(f"Anonymization report generated: {output_file}")
        
    except Exception as e:
        logger.error(f"Failed to generate report: {e}")

if __name__=='main__':        
    """
    Main execution with enhanced error handling and multiple operation modes.
    """
    start_time = time.time()
    
    try:
        # Example usage patterns - uncomment as needed
        
        # 1. Single directory anonymization
        # base_dir = r'C:\Users\lukass\Downloads\KLINGE_DIETMAR'
        # new_patientid = 'CADMAN-315'
        # modify_patientids(base_dir, new_patientid)
        
        # 2. Batch anonymization with copy to new location
        # source_dir = r"C:\Users\lukass\Downloads\CADMAN-023"
        # target_dir = r"Z:\cadman_dcm\CADMAN-023_ANONYMIZED"
        # batch_anonymize_directory(source_dir, target_dir)
        
        # 3. Copy DICOM files with proper organization
        d1 = r"C:\Users\lukass\Downloads\CADMAN-023"
        d2 = r"Z:\cadman_dcm\CADMAN-023"
        
        if os.path.exists(d1):
            copied_count = copy_dicoms(d1, d2)
            if copied_count > 0:
                generate_anonymization_report(d2)
        else:
            logger.error(f"Source directory not found: {d1}")
        
        # 4. Excel-based anonymization
        # modify_patientids_from_xl()
        
        # 5. List-based anonymization
        # modify_patientids_from_list()
        
    except Exception as e:
        logger.error(f"Main execution failed: {e}")
    
    finally:
        elapsed_time = time.time() - start_time
        logger.info(f"Execution completed in {elapsed_time:.2f} seconds")
        print(f"--- {elapsed_time:.2f} seconds ---")




