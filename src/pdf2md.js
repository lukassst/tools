import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use local worker bundled with Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function convertPdfToMarkdown(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument(arrayBuffer);
  const pdf = await loadingTask.promise;

  let markdown = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items.filter(item => item.str && item.str.trim());
    const columnSplitX = detectColumnSplit(items);

    // 1. Group items by Y coordinate (rows) with better tolerance
    const lines = {};
    items.forEach(item => {
      const y = Math.round(item.transform[5] / 2) * 2; // Round to nearest 2 units for better grouping
      if (!lines[y]) lines[y] = [];
      lines[y].push(item);
    });

    // 2. Sort Rows (Top to Bottom)
    const sortedY = Object.keys(lines).sort((a, b) => b - a);
    const fullWidthLines = [];
    const leftLines = [];
    const rightLines = [];
    const singleLines = [];

    sortedY.forEach(y => {
      const rowItems = lines[y].sort((a, b) => a.transform[4] - b.transform[4]);
      if (!rowItems.length) return;

      if (columnSplitX) {
        const leftItems = rowItems.filter(item => item.transform[4] < columnSplitX - 5);
        const rightItems = rowItems.filter(item => item.transform[4] >= columnSplitX + 5);
        const avgX = rowItems.reduce((sum, item) => sum + item.transform[4], 0) / rowItems.length;

        if (Math.abs(avgX - columnSplitX) < 60 && rowItems.length <= 4) {
          const line = buildLine(rowItems, y);
          if (line) fullWidthLines.push(line);
          return;
        }

        if (leftItems.length) {
          const line = buildLine(leftItems, y);
          if (line) leftLines.push(line);
        }
        if (rightItems.length) {
          const line = buildLine(rightItems, y);
          if (line) rightLines.push(line);
        }
      } else {
        const line = buildLine(rowItems, y);
        if (line) singleLines.push(line);
      }
    });

    const lineOutput = [];
    if (columnSplitX) {
      lineOutput.push(...fullWidthLines.sort((a, b) => b.y - a.y));
      lineOutput.push(...leftLines.sort((a, b) => b.y - a.y));
      lineOutput.push(...rightLines.sort((a, b) => b.y - a.y));
    } else {
      lineOutput.push(...singleLines.sort((a, b) => b.y - a.y));
    }

    lineOutput.forEach(line => {
      markdown += formatLine(line.text, line.height);
    });

    // Post-process each page to handle tables with coordinate data
    markdown = postProcessMarkdown(markdown, items);

    // Page Separator
    if (pageNum < pdf.numPages) {
      markdown += '\n---\n\n';
    }
  }

  // Final cleanup
  markdown = cleanupText(markdown);
  
  // Generate Table of Contents
  const toc = generateTableOfContents(markdown.split('\n'));
  markdown = toc + markdown;

  return markdown;
}

function detectColumnSplit(items) {
  if (!items || items.length < 30) return null;
  const xs = items.map(item => item.transform[4]).sort((a, b) => a - b);
  let maxGap = 0;
  let splitIndex = -1;

  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i] - xs[i - 1];
    if (gap > maxGap) {
      maxGap = gap;
      splitIndex = i;
    }
  }

  if (maxGap > 80 && splitIndex > xs.length * 0.2 && splitIndex < xs.length * 0.8) {
    return (xs[splitIndex - 1] + xs[splitIndex]) / 2;
  }

  return null;
}

function buildLine(items, y) {
  const tokens = [];
  let lastToken = '';
  items.forEach(item => {
    const token = String(item.str).replace(/\s+/g, ' ').trim();
    if (!token) return;
    if (token === lastToken) return;
    tokens.push(token);
    lastToken = token;
  });

  const text = tokens.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const cleanText = cleanupText(text);
  if (!cleanText) return null;

  const height = Math.max(...items.map(item => item.height || 0), 12);
  return { text: cleanText, height, y };
}

function extractLinks(text) {
  const links = [];
  let cleaned = text;

  // Fix malformed DOI URLs first
  cleaned = cleaned.replace(/https:\/\/doi\.org\/\.\//gi, 'https://doi.org/');
  cleaned = cleaned.replace(/https:\/\/doi\.org\/(10\.)/gi, 'https://doi.org/$1');

  // Extract DOI patterns
  const doiPatterns = [
    /\b(10\.\d{4,9}\/[-._;()\/A-Za-z0-9]+)\b/g,
    /doi:\s*(10\.\d{4,9}\/[-._;()\/A-Za-z0-9]+)/gi
  ];

  doiPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(cleaned)) !== null) {
      const doi = match[1] || match[2];
      if (doi && !links.some(l => l.includes(doi))) {
        links.push(`https://doi.org/${doi}`);
      }
    }
    cleaned = cleaned.replace(pattern, '');
  });

  // Extract regular URLs
  const urlMatches = cleaned.match(/https?:\/\/[^\s,)]+/gi) || [];
  urlMatches.forEach(url => {
    const cleanUrl = url.replace(/[),.;]$/, '');
    if (!links.includes(cleanUrl)) {
      links.push(cleanUrl);
    }
    cleaned = cleaned.replace(url, '');
  });

  return { cleanedText: cleaned.trim(), links: [...new Set(links)] };
}

function formatLine(text, height) {
  const { cleanedText, links } = extractLinks(text);
  let result = '';
  let trimmed = cleanedText.trim();

  // Remove citation numbers from the beginning of lines
  trimmed = trimmed.replace(/^(\d{1,2},)*\d{1,2}\s+/, '');
  trimmed = trimmed.replace(/^\d{1,2}\s+/, '');

  // Skip if only citation numbers remain
  if (!trimmed || /^\d{1,2}(,\d{1,2})*$/.test(trimmed)) {
    // Still add links even if text is empty
    if (links.length) {
      links.forEach(link => {
        result += `[${link}](${link})\n\n`;
      });
    }
    return result;
  }

  if (trimmed) {
    if (height > 26) {
      result += `\n# ${trimmed}\n\n`;
    } else if (height > 19) {
      result += `\n## ${trimmed}\n\n`;
    } else if (height > 14) {
      result += `\n### ${trimmed}\n\n`;
    } else if (trimmed.match(/^(Received|Accepted|Published|Open access|Check for updates)/i)) {
      result += `*${trimmed}*\n\n`;
    } else {
      result += `${trimmed}\n`;
    }
  }

  if (links.length) {
    links.forEach(link => {
      result += `[${link}](${link})\n\n`;
    });
  }

  return result;
}

function containsMonth(text) {
  return /(Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|Jun(e)?|Jul(y)?|Aug(ust)?|Sep(tember)?|Oct(ober)?|Nov(ember)?|Dec(ember)?)/i.test(text);
}

function cleanupText(text) {
  let clean = text
    .replace(/✉/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return '';

  if (/^\|?\s*Nature\s*\|\s*Vol/i.test(clean)) return '';
  if (/^\|?\s*Nature\s*\|/i.test(clean)) return '';
  if (/^\s*Fig\.?\s*\d+/i.test(clean)) return '';
  if (/^\s*Extended Data Fig\.?/i.test(clean)) return '';
  if (/^\s*Supplementary (Fig|Table)\.?/i.test(clean)) return '';
  if (/^\s*\|\s*Nature\s*\|/i.test(clean)) return '';
  if (/^\s*\d+\s*\|\s*Nature\s*\|/i.test(clean)) return '';
  if (/^\s*Nature\s*\|\s*Vol\s*\d+/i.test(clean)) return '';
  if (/^\s*Google DeepMind,/i.test(clean)) return clean;

  let tokens = clean.split(' ');
  const citationTokens = tokens.filter(token => /^\d{1,2}(,\d{1,2})*$/.test(token));
  const hasMonth = containsMonth(clean);
  const removeCitations = citationTokens.length >= 3 && !hasMonth;

  if (removeCitations) {
    tokens = tokens.filter(token => !/^\d{1,2}(,\d{1,2})*$/.test(token));
  }

  clean = tokens.join(' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ', ')
    .replace(/\s+\./g, '.')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(')
    .replace(/https:\/\/doi\.org\/\.\//gi, 'https://doi.org/')
    .replace(/\b(\d{1,2},)+\d{1,2}\b/g, '') // Remove citation number clusters
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length < 2) return '';

  return clean;
}

function generateTableOfContents(lines) {
  const toc = ["## Table of Contents\n"];
  let hasHeaders = false;

  lines.forEach(line => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      // Create a GitHub-style slug: lowercase, remove non-alphanumeric, replace spaces with hyphens
      const slug = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      
      const indent = '  '.repeat(level - 1);
      toc.push(`${indent}* [${title}](#${slug})`);
      hasHeaders = true;
    }
  });

  return hasHeaders ? toc.join('\n') + '\n\n---\n\n' : '';
}

function postProcessMarkdown(markdown, items) {
  let lines = markdown.split('\n');
  const mergedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const next = lines[i + 1];
    if (line.trim().endsWith('-') && next && /^[a-z]/.test(next.trim())) {
      line = line.trim().slice(0, -1) + next.trim();
      i += 1;
    }
    mergedLines.push(line);
  }

  lines = mergedLines;
  let processedLines = []; // ✅ FIXED: Changed from const to let
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const next = lines[i + 1] || '';

    // Check for underlined headers (next line is === or ---)
    if (/^[=_-]{3,}$/.test(next.trim()) && line.trim().length > 3 && line.trim().length < 100) {
      processedLines.push(`## ${line.trim()}`);
      i += 1;
      continue;
    }

    // Check for ALL CAPS headers (common in PDFs) - must be 2+ words, not acronyms
    const trimmed = line.trim();
    const words = trimmed.split(/\s+/);

    const isAllCapsHeader =
      words.length >= 2 &&
      words.length <= 10 &&
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 10 &&  // Minimum length
      trimmed.length < 100 &&
      !/^\d/.test(trimmed) &&
      !/^[-•●]/.test(trimmed) &&
      !/^\*.*\*$/.test(trimmed) &&
      !/^[A-Z]{2,6}$/.test(words[0]); // Avoid acronyms like "NASA"

    if (isAllCapsHeader) {
      processedLines.push(`### ${trimmed}`);
    } else {
      processedLines.push(line);
    }
  }

  // Table detection - look for consistent columnar patterns
  const tableBlocks = detectTables(processedLines, items);
  if (tableBlocks.length) {
    tableBlocks.forEach(block => {
      const tableMarkdown = formatTable(block.lines);
      // Replace the block with table
      const startIdx = processedLines.indexOf(block.lines[0]);
      if (startIdx >= 0) {
        processedLines.splice(startIdx, block.lines.length, tableMarkdown);
      }
    });
  }

  // Better list detection with multi-level support
  processedLines = processLists(processedLines);

  // Detect and format reference sections
  processedLines = detectReferences(processedLines);

  const firstNonEmpty = processedLines.findIndex(line => line.trim() !== '');
  const secondNonEmpty = processedLines.findIndex((line, idx) => idx > firstNonEmpty && line.trim() !== '');
  const thirdNonEmpty = processedLines.findIndex((line, idx) => idx > secondNonEmpty && line.trim() !== '');
  if (firstNonEmpty >= 0 && secondNonEmpty > firstNonEmpty && thirdNonEmpty > secondNonEmpty) {
    const first = processedLines[firstNonEmpty].trim();
    const second = processedLines[secondNonEmpty].trim();
    const third = processedLines[thirdNonEmpty].trim();
    if (first.toLowerCase() === 'article' && second && third) {
      const secondText = second.replace(/^#+\s*/, '');
      const thirdText = third.replace(/^#+\s*/, '');
      processedLines[firstNonEmpty] = `# ${secondText} ${thirdText}`.trim();
      processedLines[secondNonEmpty] = '';
      processedLines[thirdNonEmpty] = '';
    }
  }

  const paragraphLines = [];
  for (let i = 0; i < processedLines.length; i++) {
    const line = (processedLines[i] || '').trim();
    if (!line) continue;

    const prev = paragraphLines.length ? paragraphLines[paragraphLines.length - 1] : '';
    const isHeading = /^#{1,6}\s+/.test(line);
    const isRule = line === '---';
    const isList = /^(-\s+|\d+\.\s+)/.test(line);
    const isLinkOnly = /^\[[^\]]+\]\([^\)]+\)$/.test(line);
    const isEmphasis = /^\*.*\*$/.test(line);
    const isDateLine = /^(Received|Accepted|Published):/i.test(line);
    const prevIsDate = /^(Received|Accepted|Published):/i.test(prev);

    if (!prev || isHeading || isRule || isList || isLinkOnly || isEmphasis || isDateLine) {
      paragraphLines.push(line);
      continue;
    }

    const prevEndsSentence = /[.!?;:]$/.test(prev);
    const prevIsHeading = /^#{1,6}\s+/.test(prev);
    const lineStartsLower = /^[a-z]/.test(line);
    const isAuthorLine = /^[A-Z][a-z]+\s+[A-Z][a-z]+,/.test(line);
    const prevIsAuthor = /^[A-Z][a-z]+\s+[A-Z][a-z]+,/.test(prev);

    // Don't merge author lines with content
    if (isAuthorLine && !prevIsAuthor) {
      paragraphLines.push(line);
      continue;
    }

    // Don't merge content into date lines
    if (prevIsDate) {
      paragraphLines.push(line);
      continue;
    }

    // Merge if previous doesn't end with sentence terminator and line starts lowercase
    if (!prevIsHeading && !prevEndsSentence && lineStartsLower && !isAuthorLine) {
      paragraphLines[paragraphLines.length - 1] = `${prev} ${line}`;
    } else {
      paragraphLines.push(line);
    }
  }

  let result = paragraphLines.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/---\n\n---/g, '---');

  return result.trim() + '\n';
}

function detectTables(lines, items) {
  const blocks = [];
  let currentBlock = null;

  // Helper to get items belonging to a specific line index
  const getLineItems = (lineStr) => items.filter(it => lineStr.includes(it.str.trim()));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineItems = getLineItems(line);
    
    // A table row usually has multiple distinct X-starts
    const xStarts = lineItems.map(it => Math.round(it.transform[4] / 5) * 5);
    const uniqueStarts = [...new Set(xStarts)].sort((a, b) => a - b);

    if (uniqueStarts.length >= 3) {
      if (!currentBlock) {
        currentBlock = { start: i, lines: [line], colPositions: uniqueStarts };
      } else {
        // Check for alignment with the previous row's columns
        const alignmentMatches = uniqueStarts.filter(x => 
          currentBlock.colPositions.some(prevX => Math.abs(x - prevX) <= 10)
        );

        if (alignmentMatches.length >= 2) {
          currentBlock.lines.push(line);
        } else {
          if (currentBlock.lines.length >= 3) blocks.push(currentBlock);
          currentBlock = { start: i, lines: [line], colPositions: uniqueStarts };
        }
      }
    } else if (currentBlock) {
      if (currentBlock.lines.length >= 3) blocks.push(currentBlock);
      currentBlock = null;
    }
  }

  if (currentBlock && currentBlock.lines.length >= 3) {
    blocks.push(currentBlock);
  }

  return blocks;
}

function formatTable(blockLines) {
  // Extract all unique column positions
  const allParts = blockLines.map(line => line.trim().split(/\s{3,}/));
  const maxCols = Math.max(...allParts.map(parts => parts.length));

  if (maxCols < 3) return blockLines.join('\n');

  // Build markdown table
  let table = '|';
  for (let i = 0; i < maxCols; i++) table += ' |';
  table += '\n|';
  for (let i = 0; i < maxCols; i++) table += ' --- |';
  table += '\n';

  allParts.forEach(parts => {
    table += '|';
    for (let i = 0; i < maxCols; i++) {
      table += ` ${parts[i] || ''} |`;
    }
    table += '\n';
  });

  return table;
}

function processLists(lines) {
  const result = [];
  let inList = false;

  const listPatterns = [
    { regex: /^[•●○◦▪▫-]\s+/, type: 'bullet' },
    { regex: /^\d+[.)]\s+/, type: 'numbered' },
    { regex: /^[a-z][.)]\s+/i, type: 'lettered' }
  ];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      result.push(line);
      inList = false;
      continue;
    }

    const match = listPatterns.find(p => p.regex.test(trimmed));

    if (match) {
      inList = true;

      // Detect indentation level
      const leadingSpaces = line.search(/\S/);
      const indent = Math.floor(leadingSpaces / 2);
      const prefix = '  '.repeat(indent);

      const cleaned = trimmed.replace(match.regex, '- ');
      result.push(prefix + cleaned);

    } else if (inList && /^\s{2,}/.test(line)) {
      // Continuation line
      const leadingSpaces = line.search(/\S/);
      const indent = Math.floor(leadingSpaces / 2);
      const prefix = '  '.repeat(indent);
      result.push(prefix + trimmed);

    } else {
      inList = false;
      result.push(line);
    }
  }

  return result;
}

function detectReferences(lines) {
  const refStart = lines.findIndex(line =>
    /^#{1,3}\s*(References?|Bibliography|Works?\s+Cited)/i.test(line.trim())
  );

  if (refStart === -1) return lines;

  const result = lines.slice(0, refStart + 1);
  const refLines = lines.slice(refStart + 1);

  // Format reference lines as numbered list
  let refNum = 1;
  for (const line of refLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push('');
      continue;
    }

    // Check if starts with number
    if (/^\d+\.?\s+/.test(trimmed)) {
      result.push(trimmed.replace(/^\d+\.?\s+/, `${refNum}. `));
      refNum++;
    } else {
      result.push(trimmed);
    }
  }

  return result;
}