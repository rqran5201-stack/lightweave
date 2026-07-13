/**
 * Import file parser — converts uploaded files into record objects.
 * Supports: .txt, .md, .json, .docx, .pdf
 */
// Dynamic imports — mammoth and pdfjs are only loaded when
// user actually imports .docx or .pdf files, keeping initial bundle small.

/**
 * Parse a single file into one or more records.
 */
export async function parseFile(file) {
  const name = file.name.replace(/\.[^.]+$/, ''); // filename without extension
  const ext = file.name.split('.').pop().toLowerCase();

  switch (ext) {
    case 'txt':
      return parseTxt(await file.text(), name);
    case 'md':
      return parseMarkdown(await file.text(), name);
    case 'json':
      return parseJson(await file.text(), name);
    case 'docx':
      return await parseDocx(file, name);
    case 'pdf':
      return await parsePdf(file, name);
    default:
      // Treat unknown as plain text
      return parseTxt(await file.text(), name);
  }
}

/**
 * Plain text: entire file = one record.
 */
function parseTxt(text, name) {
  const content = text.trim();
  if (!content) return [];
  return [{
    content,
    tags: [name],
    importedFrom: name,
  }];
}

/**
 * Markdown: if the file has ## headings, split into sections.
 * Otherwise treat as one record.
 */
function parseMarkdown(text, name) {
  // Try to split by H2 sections
  const sections = text.split(/\n(?=## )/);
  if (sections.length <= 1) {
    const content = text.trim();
    if (!content) return [];
    return [{ content, tags: [name], importedFrom: name }];
  }

  const records = [];
  for (const section of sections) {
    const content = section.trim();
    if (!content) continue;
    const headingMatch = content.match(/^## (.+)/);
    const heading = headingMatch ? headingMatch[1].trim() : null;
    records.push({
      content,
      tags: heading ? [name, heading] : [name],
      importedFrom: name,
    });
  }
  return records;
}

/**
 * JSON: expect { records: [{ content, tags?, createdAt? }] }
 * or a plain array of { content, tags?, createdAt? }
 */
function parseJson(text, name) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return parseTxt(text, name);
  }

  let items = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data.records && Array.isArray(data.records)) {
    items = data.records;
  } else {
    items = [data];
  }

  return items
    .filter(item => item.content && item.content.trim())
    .map(item => ({
      content: item.content.trim(),
      tags: item.tags || [name],
      createdAt: item.createdAt ? new Date(item.createdAt).getTime() : undefined,
      importedFrom: name,
    }));
}

/**
 * Word (.docx): extract raw text via mammoth, then parse as markdown.
 * If the doc has headings they become sections; otherwise one record.
 */
async function parseDocx(file, name) {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.default.extractRawText({ arrayBuffer });
    const text = result.value;
    if (!text.trim()) return [];
    // Try splitting by headings if present
    return parseMarkdown(text, name);
  } catch (e) {
    console.error('Failed to parse .docx:', e);
    return [];
  }
}

/**
 * PDF: extract text page by page via pdf.js, merge into one record.
 * For multi-page PDFs, each page becomes a separate record (tagged with page number).
 */
async function parsePdf(file, name) {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://unpkg.com/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;

    if (pageCount <= 1) {
      const page = await pdf.getPage(1);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      if (!text.trim()) return [];
      return [{ content: text.trim(), tags: [name], importedFrom: name }];
    }

    // Multi-page: one record per page
    const records = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      if (pageText.trim()) {
        records.push({
          content: pageText.trim(),
          tags: [name, `第${i}页`],
          importedFrom: name,
        });
      }
    }
    return records;
  } catch (e) {
    console.error('Failed to parse .pdf:', e);
    return [];
  }
}
