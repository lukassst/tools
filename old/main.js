const { PDFDocument } = PDFLib;

const tools = {
    merge: {
        title: "Merge PDF files",
        description: "Combine PDFs in the order you want with the easiest PDF merger available.",
        buttonText: "Merge PDF files",
        icon: "",
        multiple: true
    },
    split: {
        title: "Split PDF files",
        description: "Separate one page or a whole set for easy conversion into independent PDF files.",
        buttonText: "Split PDF file",
        icon: "",
        multiple: false
    },
    compress: {
        title: "Compress PDF",
        description: "Reduce file size while optimizing for maximal PDF quality.",
        buttonText: "Compress PDF",
        icon: "",
        multiple: false
    },
    convert: {
        title: "PDF to Word",
        description: "Convert PDF to editable Word documents with accurate formatting.",
        buttonText: "Convert to Word",
        icon: "",
        multiple: false
    },
    protect: {
        title: "Protect PDF",
        description: "Encrypt PDF with password protection and set permissions.",
        buttonText: "Protect PDF",
        icon: "",
        multiple: false
    },
    unlock: {
        title: "Unlock PDF",
        description: "Remove password protection from PDF files instantly.",
        buttonText: "Unlock PDF",
        icon: "",
        multiple: false
    },
    rotate: {
        title: "Rotate PDF",
        description: "Rotate your PDFs the way you need them. You can even rotate multiple PDFs at once!",
        buttonText: "Rotate PDF",
        icon: "",
        multiple: true
    }
};

let selectedFiles = [];
let currentTool = 'merge';

// DOM elements
const navItems = document.querySelectorAll('.nav-item');
const toolTitle = document.getElementById('tool-title');
const toolDescription = document.getElementById('tool-description');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const processBtn = document.getElementById('processBtn');
const processText = document.getElementById('processText');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const mergeOrderHint = document.getElementById('mergeOrderHint');

// Navigation handling
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const tool = item.dataset.tool;
        switchTool(tool);
        
        // Update active state
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
    });
});

function switchTool(tool) {
    currentTool = tool;
    const toolData = tools[tool];
    
    toolTitle.textContent = toolData.title;
    toolDescription.textContent = toolData.description;
    processText.textContent = toolData.buttonText;
    
    // Update upload icon
    document.querySelector('.upload-icon').textContent = toolData.icon;
    
    // Reset file selection
    selectedFiles = [];
    updateFileList();
    
    // Update file input attributes
    fileInput.accept = '.pdf';
    fileInput.multiple = toolData.multiple;
}

// File upload handling
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (tools[currentTool].multiple) {
        selectedFiles = [...selectedFiles, ...pdfFiles];
    } else {
        selectedFiles = pdfFiles.slice(0, 1);
    }
    
    updateFileList();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateFileList() {
    if (selectedFiles.length === 0) {
        fileList.classList.add('hidden');
        processBtn.classList.add('hidden');
        mergeOrderHint.classList.add('hidden');
    } else {
        fileList.classList.remove('hidden');
        processBtn.classList.remove('hidden');
        if (currentTool === 'merge' && selectedFiles.length > 1) {
            mergeOrderHint.classList.remove('hidden');
        } else {
            mergeOrderHint.classList.add('hidden');
        }
    }
    
    const fileListHTML = selectedFiles.map((file, index) => `
        <div class="file-item" draggable="true" data-index="${index}">
            <div class="file-item-content">
                ${currentTool === 'merge' && selectedFiles.length > 1 ? '<span class="drag-handle"></span>' : ''}
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button class="remove-btn" onclick="removeFile(${index})"></button>
        </div>
    `).join('');
    
    fileList.innerHTML = mergeOrderHint.outerHTML + fileListHTML;
    
    // Add drag and drop functionality for merge tool
    if (currentTool === 'merge' && selectedFiles.length > 1) {
        setupDragAndDrop();
    }
}

function setupDragAndDrop() {
    const fileItems = fileList.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    const targetIndex = parseInt(e.currentTarget.dataset.index);
    if (targetIndex !== draggedIndex) {
        e.currentTarget.classList.add('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const targetIndex = parseInt(e.currentTarget.dataset.index);
    
    if (draggedIndex !== null && targetIndex !== draggedIndex) {
        // Reorder the files array
        const draggedFile = selectedFiles[draggedIndex];
        selectedFiles.splice(draggedIndex, 1);
        selectedFiles.splice(targetIndex, 0, draggedFile);
        
        updateFileList();
    }
    
    // Clean up drag states
    fileList.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedIndex = null;
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
}

// PDF Processing Functions
async function mergePDFs(files) {
    const mergedPdf = await PDFDocument.create();
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        
        // Update progress
        const progress = ((i + 1) / files.length) * 100;
        progressBar.style.width = progress + '%';
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for visual feedback
    }
    
    const pdfBytes = await mergedPdf.save();
    return pdfBytes;
}

async function splitPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pageCount = pdf.getPageCount();
    const splitPdfs = [];
    
    for (let i = 0; i < pageCount; i++) {
        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(page);
        const pdfBytes = await newPdf.save();
        splitPdfs.push({
            name: `${file.name.replace('.pdf', '')}_page_${i + 1}.pdf`,
            data: pdfBytes
        });
        
        // Update progress
        const progress = ((i + 1) / pageCount) * 100;
        progressBar.style.width = progress + '%';
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return splitPdfs;
}

async function rotatePDF(file, rotation = 90) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const pages = pdf.getPages();
    
    pages.forEach((page, index) => {
        page.setRotation({ angle: rotation });
        
        // Update progress
        const progress = ((index + 1) / pages.length) * 100;
        progressBar.style.width = progress + '%';
    });
    
    const pdfBytes = await pdf.save();
    return pdfBytes;
}

function downloadFile(data, filename, mimeType = 'application/pdf') {
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

// Process button handling
processBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    
    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    
    try {
        switch (currentTool) {
            case 'merge':
                if (selectedFiles.length < 2) {
                    alert('Please select at least 2 PDF files to merge.');
                    return;
                }
                const mergedData = await mergePDFs(selectedFiles);
                downloadFile(mergedData, 'merged_document.pdf');
                break;
                
            case 'split':
                const splitFiles = await splitPDF(selectedFiles[0]);
                splitFiles.forEach(file => {
                    downloadFile(file.data, file.name);
                });
                break;
                
            case 'rotate':
                for (let file of selectedFiles) {
                    const rotatedData = await rotatePDF(file);
                    downloadFile(rotatedData, `rotated_${file.name}`);
                }
                break;
                
            default:
                alert(`${tools[currentTool].title} functionality coming soon!`);
                break;
        }
        
        // Reset after successful processing
        selectedFiles = [];
        updateFileList();
        
    } catch (error) {
        console.error('Processing error:', error);
        alert('An error occurred while processing the PDF. Please try again.');
    } finally {
        processBtn.disabled = false;
        processBtn.textContent = processText.textContent;
        progressContainer.classList.add('hidden');
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    switchTool('merge');
});
