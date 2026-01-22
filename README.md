# Medical Tools - PDF & DICOM Anonymizer

A modern web application for PDF manipulation and DICOM anonymization, built with Vite and ES modules.

## Features

### ✅ Currently Implemented
- **Merge PDF** - Combine multiple PDFs with drag-and-drop reordering
- **Split PDF** - Split a PDF into individual pages
- **DICOM Anonymization** - Remove patient identifiers while preserving medical imaging data
  - Fully local processing (no data leaves your computer)
  - Maintains PACS structure (Study/Series/SOP)
  - ZIP export for easy storage

### 🚧 Coming Soon
- **Rotate PDF** - Rotate PDFs by 90 degrees
- **Compress PDF** - Reduce PDF file sizes

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
.
├── index.html           # Entry point
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
└── src/
    ├── main.js          # Main application logic
    ├── utils.js         # Helper functions
    └── styles.css       # Styling
```

## DICOM Anonymization

The DICOM anonymization feature replicates and modernizes the Python implementation for web use.

### How It Works

1. **Select DICOM files** from your PACS export
2. **Analyze** - Shows file count, studies, series
3. **Set Patient ID** - Enter new anonymous ID (e.g., "STUDY-001")
4. **Process** - All identifiable information is removed locally
5. **Download** - Get organized ZIP with anonymized files

### What Gets Anonymized

Based on the Python script, these tags are modified:

**Patient Information:**
- PatientName → Anonymous ID
- PatientID → Anonymous ID  
- PatientBirthDate → 19000101
- PatientSex → O (Other)
- PatientAge → 000Y
- ClinicalTrialSubjectID → Anonymous ID

**Institution/Physician:**
- InstitutionName → ANONYMOUS
- InstitutionAddress → ANONYMOUS
- ReferringPhysicianName → ANONYMOUS
- PerformingPhysicianName → ANONYMOUS
- OperatorsName → ANONYMOUS

**UIDs and imaging data are preserved** for postprocessing.

### File Organization

Files are organized just like the Python script:
```
ANON-ID/
  ├── StudyInstanceUID/
  │   ├── SeriesInstanceUID/
  │   │   ├── SOPInstanceUID.dcm
  │   │   └── ...
```

### Privacy & Security

- ✅ **100% local processing** - nothing sent to servers
- ✅ **Works offline** after initial load
- ✅ **Deploy on GitHub Pages** - static hosting only
- ✅ **No backend required** - pure client-side JavaScript

## Why Vite?

- ⚡ Lightning-fast HMR (Hot Module Replacement)
- 📦 ES modules - native browser support
- 🔧 Simple configuration
- 🚀 Optimized production builds
- 💾 Dynamic imports for pdf-lib (loaded only when needed)

## Technologies

- **Vite** - Build tool and dev server
- **pdf-lib** - PDF manipulation
- **dicom-parser** - DICOM file parsing and modification
- **JSZip** - ZIP file creation for DICOM exports
- **ES Modules** - Modern JavaScript
- **CSS3** - Modern styling with gradients and animations

## Deployment to GitHub Pages

This app can be deployed to GitHub Pages for free public hosting:

```bash
# Build for production
npm run build

# The dist/ folder can be deployed to GitHub Pages
# All processing happens in the browser - no backend needed!
```

### Why This Works for GitHub Pages:
- Static files only (HTML, CSS, JS)
- No server-side processing required
- All DICOM anonymization happens in the browser
- Perfect for secure, private medical data processing

## License

MIT