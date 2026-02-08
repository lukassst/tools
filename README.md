# Medical Tools

A modern, privacy-focused web application for document processing and medical imaging utilities. Built with Vite and ES modules — everything runs 100% in the browser.

## Features

- **Merge PDF** — Combine multiple PDFs with drag-and-drop reordering
- **Split PDF** — Split a PDF into individual pages, each downloaded separately
- **Anonymize DICOM** — Remove patient identifiers from DICOM files while preserving imaging data
- **PDF to Markdown** — Convert PDF documents to clean, structured Markdown text
- **Merge Markdown** — Combine multiple Markdown or text files into a single document

All tools share a consistent UI: drag-and-drop or file-picker upload, file list with reordering, progress bar, and automatic download of results.

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production (outputs to docs/)
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
├── index.html              # Entry point with navigation and shared layout
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite config (base path, output to docs/)
└── src/
    ├── main.js             # App logic, tool definitions, ToolManager class
    ├── pdf2md.js           # PDF-to-Markdown conversion engine
    ├── dicomUtils.js       # DICOM parsing, anonymization, ZIP export
    ├── utils.js            # Shared helpers (download, file size, ID generation)
    └── styles.css          # Styling and responsive layout
```

## Tool Details

### Merge PDF

Select two or more PDF files, reorder them via drag-and-drop, and merge into a single PDF.

### Split PDF

Upload a single PDF and receive each page as a separate PDF file.

### Anonymize DICOM

1. Select DICOM files or a folder from a PACS export
2. Review the analysis (file count, studies, series)
3. Set an anonymous patient ID
4. Download a ZIP with anonymized files organized by Study / Series / SOP

**Anonymized tags include:** PatientName, PatientID, PatientBirthDate, PatientSex, PatientAge, InstitutionName, InstitutionAddress, ReferringPhysicianName, PerformingPhysicianName, OperatorsName, and more. UIDs and imaging data are preserved for postprocessing.

### PDF to Markdown

Converts PDF documents to Markdown with:

- Multi-column layout detection
- Heading detection by font size and ALL-CAPS patterns
- Table detection and formatting
- Citation cleanup and DOI extraction
- Math symbol wrapping
- Auto-generated table of contents

### Merge Markdown

Select two or more `.md`, `.markdown`, `.txt`, `.text`, or `.mdx` files, reorder via drag-and-drop, and merge into a single Markdown file. Files are concatenated with horizontal rule (`---`) separators.

## Privacy & Security

- **100% local processing** — no data leaves your browser
- **Works offline** after initial page load
- **No backend required** — pure client-side JavaScript
- **Deployable on GitHub Pages** — static files only

## Technologies

- **Vite** — Build tool and dev server
- **pdf-lib** — PDF creation, merging, and splitting
- **pdfjs-dist** — PDF text extraction for Markdown conversion
- **dicom-parser** — DICOM file parsing and tag modification
- **JSZip** — ZIP file creation for DICOM exports

## Deployment

The app builds to the `docs/` folder for GitHub Pages deployment:

```bash
npm run build
```

Push the `docs/` folder to your repository and enable GitHub Pages from the `docs/` directory in your repo settings. The base path is configured as `/tools/` in `vite.config.js`.

## License

MIT