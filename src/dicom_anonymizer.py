#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DICOM Anonymizer - Modern, Simple, CLI-Ready Tool

Anonymizes DICOM files by replacing patient identifiers with fixed values.
Copies files from input directory to output directory with anonymization applied.

Usage:
    # Command line with arguments
    python dicom_anonymizer.py --input ./dcm --output ./anonymized --patient-id ANON_001
    
    # Or modify the configuration section below and run directly
    python dicom_anonymizer.py

Author: Enhanced version
Date: 2026-01-22
"""

import os
import sys
import shutil
import argparse
import logging
from pathlib import Path
from datetime import datetime

try:
    import pydicom
except ImportError:
    print("Error: pydicom not installed. Install with: pip install pydicom")
    sys.exit(1)

# ============================================================================
# CONFIGURATION - Modify these values if running without command-line arguments
# ============================================================================

DEFAULT_INPUT_DIR = r"C:\Users\lukass\Desktop\personal\github\tools\dcm"
DEFAULT_OUTPUT_DIR = r"C:\Users\lukass\Desktop\personal\github\tools\dcm_anonymized"
DEFAULT_PATIENT_ID = "ANON_PATIENT_001"

# Fixed anonymization values (not random)
FIXED_VALUES = {
    'PatientBirthDate': '19000101',  # Fixed date: January 1, 1900
    'PatientSex': 'O',                # Other/Unknown
    'PatientAge': '000Y',             # Unknown age
    'StudyDate': '20000101',          # Fixed study date
    'SeriesDate': '20000101',
    'AcquisitionDate': '20000101',
    'ContentDate': '20000101',
    'StudyTime': '120000',            # Fixed time: 12:00:00
    'SeriesTime': '120000',
    'AcquisitionTime': '120000',
    'ContentTime': '120000',
}

# DICOM tags to anonymize (comprehensive list following DICOM PS 3.15)
TAGS_TO_ANONYMIZE = [
    # Patient identification
    'PatientName', 'PatientID', 'PatientBirthDate', 'PatientSex', 'PatientAge',
    'PatientAddress', 'PatientMotherBirthName', 'PatientTelephoneNumbers',
    
    # Institution and physician information
    'InstitutionName', 'InstitutionAddress', 'ReferringPhysicianName',
    'PerformingPhysicianName', 'OperatorsName', 'PhysiciansOfRecord',
    
    # Study and series descriptions
    'StudyDescription', 'SeriesDescription', 'StudyComments', 'ImageComments',
    
    # Dates and times
    'StudyDate', 'SeriesDate', 'AcquisitionDate', 'ContentDate',
    'StudyTime', 'SeriesTime', 'AcquisitionTime', 'ContentTime',
]

# Tags to completely empty (remove values)
TAGS_TO_EMPTY = [
    'PatientAddress', 'PatientTelephoneNumbers', 'InstitutionAddress',
    'StudyComments', 'ImageComments', 'PatientMotherBirthName',
]

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# CORE FUNCTIONS
# ============================================================================

def anonymize_dicom_file(input_path, output_path, patient_id):
    """
    Anonymize a single DICOM file.
    
    Args:
        input_path: Path to input DICOM file
        output_path: Path to output DICOM file
        patient_id: New patient identifier
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Read DICOM file
        ds = pydicom.dcmread(input_path)
        
        # Anonymize tags
        for tag in TAGS_TO_ANONYMIZE:
            if tag in ds:
                try:
                    if tag in TAGS_TO_EMPTY:
                        # Empty these tags
                        ds[tag].value = ''
                    elif tag in ['PatientName', 'PatientID']:
                        # Use provided patient ID
                        ds[tag].value = patient_id
                    elif tag in FIXED_VALUES:
                        # Use fixed values
                        ds[tag].value = FIXED_VALUES[tag]
                    elif 'Description' in tag or 'Name' in tag:
                        # Generic anonymization for descriptions and names
                        ds[tag].value = 'ANONYMIZED'
                    else:
                        # Default: use patient ID
                        ds[tag].value = patient_id
                        
                except Exception as e:
                    logger.warning(f"Could not modify tag {tag}: {e}")
                    continue
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save anonymized file
        ds.save_as(output_path)
        return True
        
    except Exception as e:
        logger.error(f"Failed to anonymize {input_path}: {e}")
        return False


def anonymize_directory(input_dir, output_dir, patient_id):
    """
    Anonymize all DICOM files in input directory and save to output directory.
    Preserves directory structure.
    
    Args:
        input_dir: Input directory containing DICOM files
        output_dir: Output directory for anonymized files
        patient_id: New patient identifier
        
    Returns:
        dict: Statistics about the anonymization process
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        return None
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Statistics
    stats = {
        'total_files': 0,
        'anonymized': 0,
        'failed': 0,
        'skipped': 0
    }
    
    logger.info(f"Starting anonymization...")
    logger.info(f"Input:  {input_dir}")
    logger.info(f"Output: {output_dir}")
    logger.info(f"Patient ID: {patient_id}")
    logger.info("-" * 60)
    
    # Walk through all files in input directory
    for root, dirs, files in os.walk(input_dir):
        for filename in files:
            stats['total_files'] += 1
            input_file = Path(root) / filename
            
            # Calculate relative path to preserve directory structure
            rel_path = input_file.relative_to(input_path)
            output_file = output_path / rel_path
            
            # Check if it's a DICOM file
            if filename.lower().endswith('.dcm') or not '.' in filename:
                # Try to anonymize
                if anonymize_dicom_file(str(input_file), str(output_file), patient_id):
                    stats['anonymized'] += 1
                    logger.debug(f"✓ Anonymized: {rel_path}")
                else:
                    stats['failed'] += 1
                    logger.warning(f"✗ Failed: {rel_path}")
            else:
                # Copy non-DICOM files as-is
                output_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(input_file, output_file)
                stats['skipped'] += 1
                logger.debug(f"→ Copied: {rel_path}")
    
    return stats


def print_summary(stats, start_time):
    """Print anonymization summary."""
    if stats is None:
        return
        
    elapsed = datetime.now() - start_time
    
    logger.info("-" * 60)
    logger.info("ANONYMIZATION COMPLETE")
    logger.info("-" * 60)
    logger.info(f"Total files processed: {stats['total_files']}")
    logger.info(f"  ✓ Anonymized:        {stats['anonymized']}")
    logger.info(f"  ✗ Failed:            {stats['failed']}")
    logger.info(f"  → Copied (non-DCM):  {stats['skipped']}")
    logger.info(f"Time elapsed:          {elapsed.total_seconds():.2f} seconds")
    logger.info("-" * 60)


# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='DICOM Anonymizer - Anonymize DICOM files with fixed values',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage with default patient ID
  python dicom_anonymizer.py --input ./dcm --output ./anonymized
  
  # Specify custom patient ID
  python dicom_anonymizer.py --input ./dcm --output ./anonymized --patient-id STUDY_001
  
  # Use absolute paths
  python dicom_anonymizer.py --input "C:/data/dicom" --output "C:/data/anon" --patient-id ANON_123
  
  # Run with configuration values in script (no arguments)
  python dicom_anonymizer.py
        """
    )
    
    parser.add_argument(
        '--input', '-i',
        type=str,
        default=None,
        help=f'Input directory containing DICOM files (default: {DEFAULT_INPUT_DIR})'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        default=None,
        help=f'Output directory for anonymized files (default: {DEFAULT_OUTPUT_DIR})'
    )
    
    parser.add_argument(
        '--patient-id', '-p',
        type=str,
        default=None,
        help=f'New patient identifier (default: {DEFAULT_PATIENT_ID})'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging (debug mode)'
    )
    
    return parser.parse_args()


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main execution function."""
    start_time = datetime.now()
    
    # Parse command line arguments
    args = parse_arguments()
    
    # Set logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # Use command line arguments or fall back to defaults
    input_dir = args.input or DEFAULT_INPUT_DIR
    output_dir = args.output or DEFAULT_OUTPUT_DIR
    patient_id = args.patient_id or DEFAULT_PATIENT_ID
    
    # Print header
    print("=" * 60)
    print("DICOM ANONYMIZER")
    print("=" * 60)
    
    # Run anonymization
    try:
        stats = anonymize_directory(input_dir, output_dir, patient_id)
        print_summary(stats, start_time)
        
        # Exit with appropriate code
        if stats and stats['failed'] == 0:
            sys.exit(0)
        elif stats:
            sys.exit(1)
        else:
            sys.exit(2)
            
    except KeyboardInterrupt:
        logger.warning("\nAnonymization interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
