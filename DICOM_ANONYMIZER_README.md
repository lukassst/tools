# DICOM Anonymizer - Modern CLI Tool

A simple, modern Python tool for anonymizing DICOM files with fixed values. Copies files from input directory to output directory with anonymization applied.

## Features

✅ **Simple & Clean** - One focused task: anonymize DICOM files  
✅ **CLI Ready** - Run from command line with arguments  
✅ **Fixed Values** - Uses consistent anonymization (not random)  
✅ **Preserves Structure** - Maintains directory hierarchy  
✅ **Safe** - Never modifies original files (copies to output dir)  
✅ **Comprehensive** - Anonymizes 20+ DICOM tags following PS 3.15 standard

## Installation

```bash
# Install required dependency
pip install pydicom
```

## Quick Start

### Option 1: Command Line (Recommended)

```bash
# Basic usage
python dicom_anonymizer.py --input ./dcm --output ./anonymized --patient-id ANON_001

# Using absolute paths
python dicom_anonymizer.py -i "C:/data/dicom" -o "C:/data/anon" -p STUDY_123

# Verbose mode (shows each file processed)
python dicom_anonymizer.py -i ./dcm -o ./anon -p ANON_001 --verbose
```

### Option 2: Direct Execution

Modify the configuration section in the script:

```python
DEFAULT_INPUT_DIR = r"C:\path\to\your\dcm"
DEFAULT_OUTPUT_DIR = r"C:\path\to\output"
DEFAULT_PATIENT_ID = "ANON_PATIENT_001"
```

Then run:
```bash
python dicom_anonymizer.py
```

## What Gets Anonymized

### Patient Information
- **PatientName** → `ANON_PATIENT_001` (your specified ID)
- **PatientID** → `ANON_PATIENT_001`
- **PatientBirthDate** → `19000101` (fixed: Jan 1, 1900)
- **PatientSex** → `O` (Other/Unknown)
- **PatientAge** → `000Y` (Unknown)
- **PatientAddress** → `` (empty)
- **PatientTelephoneNumbers** → `` (empty)

### Institution & Physicians
- **InstitutionName** → `ANONYMIZED`
- **InstitutionAddress** → `` (empty)
- **ReferringPhysicianName** → `ANONYMIZED`
- **PerformingPhysicianName** → `ANONYMIZED`
- **OperatorsName** → `ANONYMIZED`

### Dates & Times (Fixed Values)
- **StudyDate** → `20000101` (fixed: Jan 1, 2000)
- **SeriesDate** → `20000101`
- **AcquisitionDate** → `20000101`
- **StudyTime** → `120000` (fixed: 12:00:00)
- **SeriesTime** → `120000`
- **AcquisitionTime** → `120000`

### Descriptions
- **StudyDescription** → `ANONYMIZED`
- **SeriesDescription** → `ANONYMIZED`
- **StudyComments** → `` (empty)
- **ImageComments** → `` (empty)

### What's Preserved
✅ **Image data** - All pixel data unchanged  
✅ **Technical parameters** - Scan settings, modality, etc.  
✅ **UIDs** - Study/Series/SOP Instance UIDs maintained  
✅ **Directory structure** - Folder hierarchy preserved  

## Command Line Options

```
--input, -i       Input directory containing DICOM files
--output, -o      Output directory for anonymized files
--patient-id, -p  New patient identifier (e.g., ANON_001)
--verbose, -v     Enable verbose logging (shows each file)
--help, -h        Show help message
```

## Examples

### Example 1: Basic Anonymization
```bash
python dicom_anonymizer.py --input ./dcm --output ./anonymized --patient-id STUDY_001
```

**Input:**
```
dcm/
├── file1.dcm
├── file2.dcm
└── subfolder/
    └── file3.dcm
```

**Output:**
```
anonymized/
├── file1.dcm (anonymized)
├── file2.dcm (anonymized)
└── subfolder/
    └── file3.dcm (anonymized)
```

### Example 2: Your Current Setup
```bash
# Using your existing dcm folder
python dicom_anonymizer.py \
  --input "C:\Users\lukass\Desktop\personal\github\tools\dcm" \
  --output "C:\Users\lukass\Desktop\personal\github\tools\dcm_anonymized" \
  --patient-id ANON_TEST_001
```

### Example 3: Batch Processing Multiple Studies
```bash
# Study 1
python dicom_anonymizer.py -i ./study1 -o ./anon/study1 -p ANON_001

# Study 2
python dicom_anonymizer.py -i ./study2 -o ./anon/study2 -p ANON_002

# Study 3
python dicom_anonymizer.py -i ./study3 -o ./anon/study3 -p ANON_003
```

## Output Summary

After completion, you'll see:
```
============================================================
ANONYMIZATION COMPLETE
============================================================
Total files processed: 512
  ✓ Anonymized:        512
  ✗ Failed:            0
  → Copied (non-DCM):  0
Time elapsed:          45.23 seconds
============================================================
```

## Error Handling

- **Invalid DICOM files** - Skipped with warning
- **Missing input directory** - Error message, exits
- **Permission errors** - Logged, continues with other files
- **Keyboard interrupt** - Graceful exit

## Differences from Old Script

| Feature | Old Script | New Script |
|---------|-----------|------------|
| **Complexity** | 540 lines, 10+ functions | 300 lines, 3 core functions |
| **Random values** | Yes (birthdate, dates, times) | No (fixed values) |
| **Excel support** | Yes | Removed (not needed) |
| **In-place modification** | Yes (with backups) | No (always copies) |
| **CLI support** | No | Yes (argparse) |
| **Legacy functions** | Many (modify_tag, copy_dicoms, etc.) | Removed |
| **Focus** | Multi-purpose | Single purpose: anonymize |

## Safety Features

✅ **Never modifies originals** - Always copies to output directory  
✅ **Validates DICOM files** - Skips invalid files gracefully  
✅ **Preserves structure** - Maintains folder hierarchy  
✅ **Detailed logging** - Track what's happening  
✅ **Error handling** - Continues on errors, reports at end  

## Testing

Test with your 512 DICOM files:

```bash
python dicom_anonymizer.py \
  --input "C:\Users\lukass\Desktop\personal\github\tools\dcm" \
  --output "C:\Users\lukass\Desktop\personal\github\tools\dcm_anonymized" \
  --patient-id TEST_ANON_001 \
  --verbose
```

Expected: All 512 files anonymized in ~30-60 seconds.

## Troubleshooting

**Problem:** `ModuleNotFoundError: No module named 'pydicom'`  
**Solution:** `pip install pydicom`

**Problem:** Input directory not found  
**Solution:** Check path, use absolute paths with `-i` flag

**Problem:** Permission denied on output  
**Solution:** Ensure write permissions on output directory

**Problem:** Some files failed  
**Solution:** Check logs, those files may not be valid DICOM

## License

Free to use and modify.

## Support

For issues or questions, check the logs in verbose mode:
```bash
python dicom_anonymizer.py -i ./input -o ./output -p ANON_001 --verbose
```
