import { PDFDocument } from 'pdf-lib';
import { downloadFile, formatFileSize, generateAnonymousId } from './utils';
import { convertPdfToMarkdown } from './pdf2md';
import { 
  processDicomBatch, 
  analyzeDicomFiles, 
  TAGS_TO_ANONYMIZE 
} from './dicomUtils';

const TOOLS = {
  merge: {
    title: 'Merge PDF files',
    description: 'Combine PDFs in the order you want with the easiest PDF merger available.',
    buttonText: 'Merge PDF files',
    icon: '📄',
    uploadText: 'Select PDF files',
    uploadSubtext: 'or drop PDFs here',
    accept: '.pdf',
    multiple: true,
    hint: 'Drag and drop files to reorder them before merging'
  },
  split: {
    title: 'Split PDF files',
    description: 'Separate one page or a whole set for easy conversion into independent PDF files.',
    buttonText: 'Split PDF file',
    icon: '✂️',
    uploadText: 'Select PDF file',
    uploadSubtext: 'or drop PDF here',
    accept: '.pdf',
    multiple: false,
    hint: null
  },
  dicom: {
    title: 'Anonymize DICOM',
    description: 'Remove patient identifiers from DICOM files while preserving medical imaging data.',
    buttonText: 'Anonymize DICOM files',
    icon: '🏥',
    uploadText: 'Select DICOM folder or files',
    uploadSubtext: 'or drop DICOM folder/files here',
    accept: '.dcm,.dicom',
    multiple: true,
    webkitdirectory: true,
    hint: 'All patient identifiers will be replaced with anonymous values'
  },
  pdf2md: {
    title: 'PDF to Markdown',
    description: 'Convert PDF documents to clean, structured Markdown text with preserved formatting.',
    buttonText: 'Convert & Download',
    icon: '📝',
    uploadText: 'Select PDF file',
    uploadSubtext: 'or drop PDF here',
    accept: '.pdf',
    multiple: false,
    hint: null
  }
};

class ToolManager {
  constructor() {
    this.selectedFiles = [];
    this.currentTool = 'merge';
    this.draggedIndex = null;
    
    this.initElements();
    this.attachListeners();
    this.switchTool('merge');
  }

  initElements() {
    this.els = {
      navItems: document.querySelectorAll('.nav-item'),
      toolTitle: document.getElementById('tool-title'),
      toolDescription: document.getElementById('tool-description'),
      uploadArea: document.getElementById('uploadArea'),
      uploadText: document.getElementById('uploadText'),
      uploadSubtext: document.getElementById('uploadSubtext'),
      fileInput: document.getElementById('fileInput'),
      fileList: document.getElementById('fileList'),
      processBtn: document.getElementById('processBtn'),
      processText: document.getElementById('processText'),
      progressContainer: document.getElementById('progressContainer'),
      progressBar: document.getElementById('progressBar'),
      progressText: document.getElementById('progressText'),
      orderHint: document.getElementById('orderHint'),
      hintText: document.getElementById('hintText'),
      uploadIcon: document.querySelector('.upload-icon')
    };
  }

  attachListeners() {
    // Navigation
    this.els.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tool = item.dataset.tool;
        this.switchTool(tool);
        this.els.navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Upload area
    this.els.uploadArea.addEventListener('click', () => this.els.fileInput.click());
    this.els.uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.els.uploadArea.classList.add('dragover');
    });
    this.els.uploadArea.addEventListener('dragleave', () => {
      this.els.uploadArea.classList.remove('dragover');
    });
    this.els.uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.els.uploadArea.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });

    // File input
    this.els.fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Process button
    this.els.processBtn.addEventListener('click', () => this.processFiles());
  }

  switchTool(tool) {
    this.currentTool = tool;
    const toolData = TOOLS[tool];
    
    this.els.toolTitle.textContent = toolData.title;
    this.els.toolDescription.textContent = toolData.description;
    this.els.processText.textContent = toolData.buttonText;
    this.els.uploadIcon.textContent = toolData.icon;
    this.els.uploadText.textContent = toolData.uploadText;
    this.els.uploadSubtext.textContent = toolData.uploadSubtext;
    
    this.els.fileInput.accept = toolData.accept;
    this.els.fileInput.multiple = toolData.multiple;
    
    // Enable directory selection for DICOM
    if (tool === 'dicom') {
      this.els.fileInput.setAttribute('webkitdirectory', '');
      this.els.fileInput.setAttribute('directory', '');
    } else {
      this.els.fileInput.removeAttribute('webkitdirectory');
      this.els.fileInput.removeAttribute('directory');
    }
    
    this.selectedFiles = [];
    this.updateFileList();
    
    // Reset button text to ensure it's correct
    this.els.processText.textContent = toolData.buttonText;
  }

  handleFiles(files) {
    const toolData = TOOLS[this.currentTool];
    let validFiles = Array.from(files);

    // Filter based on file type
    if (this.currentTool === 'dicom') {
      // Accept any file for DICOM - let the parser validate
      // DICOM files may not have extensions or have various extensions
      validFiles = validFiles; // Accept all files
    } else {
      // For PDF tools, strictly check PDF type
      validFiles = validFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    }

    if (toolData.multiple) {
      this.selectedFiles = [...this.selectedFiles, ...validFiles];
    } else {
      this.selectedFiles = validFiles.slice(0, 1);
    }
    
    this.updateFileList();
  }

  updateFileList() {
    const toolData = TOOLS[this.currentTool];
    const hasFiles = this.selectedFiles.length > 0;
    const showHint = toolData.hint && this.selectedFiles.length > 1;

    this.els.fileList.classList.toggle('hidden', !hasFiles);
    this.els.processBtn.classList.toggle('hidden', !hasFiles);
    this.els.orderHint.classList.toggle('hidden', !showHint);
    
    if (showHint) {
      this.els.hintText.textContent = toolData.hint;
    }
    
    let fileListHTML = '';
    
    // For DICOM with many files, show summary instead of listing all
    if (this.currentTool === 'dicom' && this.selectedFiles.length > 10) {
      const totalSize = this.selectedFiles.reduce((sum, f) => sum + f.size, 0);
      fileListHTML = `
        <div class="file-item">
          <div class="file-item-content">
            <div>
              <div class="file-name">📁 ${this.selectedFiles.length} DICOM files selected</div>
              <div class="file-size">Total size: ${formatFileSize(totalSize)}</div>
            </div>
          </div>
          <button class="remove-btn" data-index="all">✕</button>
        </div>
      `;
    } else {
      // Show individual files for PDF or small DICOM batches
      fileListHTML = this.selectedFiles.map((file, index) => `
        <div class="file-item" draggable="${showHint}" data-index="${index}">
          <div class="file-item-content">
            ${showHint ? '<span class="drag-handle">⋮⋮</span>' : ''}
            <div>
              <div class="file-name">${file.name}</div>
              <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
          </div>
          <button class="remove-btn" data-index="${index}">✕</button>
        </div>
      `).join('');
    }
    
    this.els.fileList.innerHTML = this.els.orderHint.outerHTML + fileListHTML;
    
    // Attach remove handlers
    this.els.fileList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.currentTarget.dataset.index;
        if (idx === 'all') {
          this.selectedFiles = [];
        } else {
          this.selectedFiles.splice(parseInt(idx), 1);
        }
        this.updateFileList();
      });
    });

    // Drag and drop for reordering
    if (showHint && this.selectedFiles.length <= 10) {
      this.setupDragAndDrop();
    }
  }

  setupDragAndDrop() {
    const fileItems = this.els.fileList.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        this.draggedIndex = parseInt(e.currentTarget.dataset.index);
        e.currentTarget.classList.add('dragging');
      });
      
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetIndex = parseInt(e.currentTarget.dataset.index);
        if (targetIndex !== this.draggedIndex) {
          e.currentTarget.classList.add('drag-over');
        }
      });
      
      item.addEventListener('dragleave', (e) => {
        e.currentTarget.classList.remove('drag-over');
      });
      
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIndex = parseInt(e.currentTarget.dataset.index);
        
        if (this.draggedIndex !== null && targetIndex !== this.draggedIndex) {
          const draggedFile = this.selectedFiles[this.draggedIndex];
          this.selectedFiles.splice(this.draggedIndex, 1);
          this.selectedFiles.splice(targetIndex, 0, draggedFile);
          this.updateFileList();
        }
        
        this.els.fileList.querySelectorAll('.file-item').forEach(i => {
          i.classList.remove('drag-over');
        });
      });
      
      item.addEventListener('dragend', (e) => {
        e.currentTarget.classList.remove('dragging');
        this.draggedIndex = null;
      });
    });
  }

  updateProgress(percent) {
    this.els.progressBar.style.width = `${percent}%`;
    this.els.progressText.textContent = `${Math.round(percent)}%`;
  }

  async processFiles() {
    if (this.selectedFiles.length === 0) return;
    
    this.els.processBtn.disabled = true;
    this.els.processBtn.textContent = 'Processing...';
    this.els.progressContainer.classList.remove('hidden');
    this.updateProgress(0);
    
    try {
      switch (this.currentTool) {
        case 'merge':
          await this.mergePDFs();
          break;
        case 'split':
          await this.splitPDF();
          break;
        case 'dicom':
          await this.anonymizeDICOMs();
          break;
        case 'pdf2md':
          await this.convertPdfToMd();
          break;
      }
      
      this.selectedFiles = [];
      this.updateFileList();
    } catch (error) {
      console.error('Processing error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      this.els.processBtn.disabled = false;
      this.els.processBtn.textContent = this.els.processText.textContent;
      this.els.progressContainer.classList.add('hidden');
    }
  }

  async mergePDFs() {
    if (this.selectedFiles.length < 2) {
      throw new Error('Please select at least 2 PDF files to merge.');
    }

    const mergedPdf = await PDFDocument.create();
    
    for (let i = 0; i < this.selectedFiles.length; i++) {
      const arrayBuffer = await this.selectedFiles[i].arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
      
      this.updateProgress(((i + 1) / this.selectedFiles.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const pdfBytes = await mergedPdf.save();
    downloadFile(pdfBytes, 'merged_document.pdf', 'application/pdf');
  }

  async splitPDF() {
    const file = this.selectedFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pageCount = pdf.getPageCount();
    
    for (let i = 0; i < pageCount; i++) {
      const newPdf = await PDFDocument.create();
      const [page] = await newPdf.copyPages(pdf, [i]);
      newPdf.addPage(page);
      
      const pdfBytes = await newPdf.save();
      const filename = `${file.name.replace('.pdf', '')}_page_${i + 1}.pdf`;
      downloadFile(pdfBytes, filename, 'application/pdf');
      
      this.updateProgress(((i + 1) / pageCount) * 100);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  async anonymizeDICOMs() {
    try {
      // Generate anonymous patient ID
      const anonymousId = generateAnonymousId('ANON');
      
      // Ask user for custom ID or use generated one
      const customId = prompt(
        `Enter patient ID for anonymization:\n(Leave empty to use: ${anonymousId})`,
        anonymousId
      );
      
      if (!customId) {
        alert('Anonymization cancelled - no patient ID provided');
        return;
      }
      
      this.updateProgress(5);
      
      // Analyze files first
      const analysis = await analyzeDicomFiles(this.selectedFiles);
      
      this.updateProgress(15);
      
      if (analysis.validDicoms === 0) {
        throw new Error('No valid DICOM files found');
      }
      
      // Show analysis
      const proceed = confirm(
        `DICOM Analysis:\n\n` +
        `Total files: ${analysis.totalFiles}\n` +
        `Valid DICOM files: ${analysis.validDicoms}\n` +
        `Studies: ${analysis.studies}\n` +
        `Series: ${analysis.series}\n` +
        `Invalid files: ${analysis.invalidFiles.length}\n\n` +
        `New Patient ID: ${customId}\n\n` +
        `All patient identifiable information will be anonymized.\n` +
        `Continue?`
      );
      
      if (!proceed) {
        return;
      }
      
      // Process DICOM files
      const zip = await processDicomBatch(
        this.selectedFiles, 
        customId,
        (progress) => this.updateProgress(15 + (progress * 0.8))
      );
      
      this.updateProgress(95);
      
      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      this.updateProgress(100);
      
      // Download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${customId}_anonymized.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert(
        `Anonymization complete!\n\n` +
        `${analysis.validDicoms} DICOM files anonymized\n` +
        `Organized by Study/Series/SOP structure\n` +
        `Downloaded as: ${customId}_anonymized.zip`
      );
      
    } catch (error) {
      console.error('DICOM anonymization error:', error);
      throw error;
    }
  }

  async convertPdfToMd() {
    const file = this.selectedFiles[0];
    
    this.updateProgress(10);
    
    try {
      // Convert PDF to Markdown
      const markdown = await convertPdfToMarkdown(file);
      
      this.updateProgress(90);
      
      // Generate filename
      const originalName = file.name.replace('.pdf', '');
      const filename = `${originalName}.md`;
      
      // Download markdown file
      downloadFile(markdown, filename, 'text/markdown');
      
      this.updateProgress(100);
      
    } catch (error) {
      console.error('PDF to Markdown conversion error:', error);
      throw new Error('Failed to convert PDF. The file may be corrupted or contain unsupported content.');
    }
  }
}

// Initialize app
new ToolManager();