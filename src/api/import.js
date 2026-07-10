/**
 * Import file parser — converts uploaded files into record objects.
 * Supports: .txt, .md, .json
 */

/**
 * Parse a single file into one or more records.
 */
export async function parseFile(file) {
  const text = await file.text();
  const name = file.name.replace(/\.[^.]+$/, ''); // filename without extension
  const ext = file.name.split('.').pop().toLowerCase();

  switch (ext) {
    case 'txt':
      return parseTxt(text, name);
    case 'md':
      return parseMarkdown(text, name);
    case 'json':
      return parseJson(text, name);
    default:
      // Treat unknown as plain text
      return parseTxt(text, name);
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
    // No H2 headings, treat as one record
    const content = text.trim();
    if (!content) return [];
    return [{
      content,
      tags: [name],
      importedFrom: name,
    }];
  }

  // Split by H2, use H2 as tag
  const records = [];
  for (const section of sections) {
    const content = section.trim();
    if (!content) continue;
    // Extract heading text for tag
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
    // Invalid JSON, treat as plain text
    return parseTxt(text, name);
  }

  let items = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data.records && Array.isArray(data.records)) {
    items = data.records;
  } else {
    // Single record object
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
