/**
 * Canvas-based export card renderer for 织光 LightWeave.
 * Renders PNG cards (750px wide) and feeds into PDF.
 * Zero server dependency — pure Canvas API.
 */

const CARD_WIDTH = 750;
const PADDING = 40;
const CONTENT_WIDTH = CARD_WIDTH - PADDING * 2;
const MAX_CHARS = 2000;

// Design tokens
const BG = '#FFF8F3';
const TEXT_COLOR = '#3D2E27';
const PRIMARY = '#C77D5A';
const TERTIARY = '#B8A99E';
const AI_BG = '#FFFBF7';
const BORDER_LIGHT = '#F2EBE5';
const CARD_RADIUS = 16;

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para === '') { lines.push(''); continue; }
    let line = '';
    for (const char of para) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function truncateText(text) {
  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS) + '…\n(查看全文请导出 Markdown)';
  }
  return text;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Render a LightWeave export card onto an HTML Canvas.
 * @param {object} opts
 * @param {string} opts.content - record body text
 * @param {Array} opts.associations - AI associations
 * @param {object|null} opts.externalKnowledge - { framework, explanation, source }
 * @param {string} opts.scope - 'both' | 'note' | 'ai'
 * @param {string} opts.dateStr - formatted date string
 * @returns {HTMLCanvasElement}
 */
export function renderExportCard({ content, associations, externalKnowledge, scope, dateStr }) {
  const hasAI = (scope === 'both' || scope === 'ai') &&
    ((associations && associations.length > 0) || externalKnowledge);
  const hasNote = scope === 'both' || scope === 'note';

  // Offscreen canvas for measurement
  const measure = document.createElement('canvas');
  measure.width = CARD_WIDTH;
  const mCtx = measure.getContext('2d');

  // Calculate body text lines
  let bodyLines = [];
  if (hasNote && content) {
    mCtx.font = '16px Georgia, "Noto Serif SC", serif';
    bodyLines = wrapLines(mCtx, truncateText(content), CONTENT_WIDTH);
  }

  // Calculate AI section lines
  let aiLines = [];
  if (hasAI) {
    mCtx.font = '14px Georgia, "Noto Serif SC", serif';
    const aiText = buildAIText(associations, externalKnowledge);
    const aiWidth = CONTENT_WIDTH - 32; // inner padding
    aiLines = wrapLines(mCtx, aiText, aiWidth);
  }

  // Calculate total height
  let y = PADDING + 48; // top padding + date row
  if (hasNote && bodyLines.length > 0) {
    y += bodyLines.length * 29; // 16px * 1.8 ≈ 29px per line
    y += 16; // gap after body
  }
  let aiSectionY = 0;
  let aiSectionH = 0;
  if (hasAI) {
    if (hasNote && bodyLines.length > 0) {
      y += 24; // separator gap
    }
    aiSectionY = y;
    aiSectionH = 32 + aiLines.length * 24 + 32; // padding + lines + padding
    y += aiSectionH + 16;
  }
  y += 40; // date + brand
  y += 48; // bottom padding

  const cardHeight = Math.max(y, 1000);

  // Create main canvas
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = cardHeight;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG;
  drawRoundedRect(ctx, 0, 0, CARD_WIDTH, cardHeight, CARD_RADIUS);
  ctx.fill();

  // Top date
  ctx.fillStyle = TERTIARY;
  ctx.font = '13px Georgia, "Noto Serif SC", serif';
  ctx.fillText(dateStr, PADDING, PADDING + 8);

  let curY = PADDING + 48;

  // Body section
  if (hasNote && bodyLines.length > 0) {
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '16px Georgia, "Noto Serif SC", serif';
    for (const line of bodyLines) {
      if (curY + 29 > cardHeight - 100) break; // safety
      ctx.fillText(line, PADDING, curY + 14);
      curY += 29;
    }
    curY += 16;
  }

  // Separator
  if (hasAI && hasNote && bodyLines.length > 0) {
    curY += 8;
    ctx.strokeStyle = BORDER_LIGHT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, curY);
    ctx.lineTo(CARD_WIDTH - PADDING, curY);
    ctx.stroke();
    curY += 24;
    aiSectionY = curY;
  }

  // AI section
  if (hasAI) {
    // Background pill
    ctx.fillStyle = AI_BG;
    drawRoundedRect(ctx, PADDING - 8, curY - 8, CONTENT_WIDTH + 16, aiSectionH || (32 + aiLines.length * 24 + 32), 12);
    ctx.fill();

    curY += 24;
    // AI label
    ctx.fillStyle = PRIMARY;
    ctx.font = '600 14px Georgia, "Noto Serif SC", serif';
    ctx.fillText('AI 分析', PADDING + 8, curY + 2);
    curY += 32;

    // AI content
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '14px Georgia, "Noto Serif SC", serif';
    for (const line of aiLines) {
      if (curY + 24 > cardHeight - 100) break;
      ctx.fillText(line, PADDING + 8, curY + 2);
      curY += 24;
    }
    curY += 24;
  }

  curY = Math.max(curY, cardHeight - 88);

  // Bottom date and brand
  ctx.fillStyle = TERTIARY;
  ctx.font = '13px Georgia, "Noto Serif SC", serif';
  ctx.fillText(dateStr, PADDING, curY + 8);

  ctx.fillStyle = TERTIARY;
  ctx.font = '12px Georgia, "Noto Serif SC", serif';
  ctx.fillText('织光 LightWeave', PADDING, curY + 30);

  return canvas;
}

function buildAIText(associations, externalKnowledge) {
  let text = '';
  if (associations && associations.length > 0) {
    text += '关联发现\n';
    for (const a of associations) {
      text += `· ${a.reason || a.category || '关联记录'}`;
      if (a.confidence) text += `  [${a.confidence}]`;
      text += '\n';
    }
    text += '\n';
  }
  if (externalKnowledge) {
    text += '外部知识\n';
    if (externalKnowledge.framework) text += `${externalKnowledge.framework}\n`;
    if (externalKnowledge.explanation) text += `${externalKnowledge.explanation}\n`;
    if (externalKnowledge.source) text += `来源: ${externalKnowledge.source}\n`;
  }
  return text.trim();
}
