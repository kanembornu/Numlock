#!/usr/bin/env node
/**
 * Markdown Link Validator - Wave 3.2
 * Validates local links in Markdown files against the current filesystem.
 * Uses git rename history to detect Wave 3 regressions.
 * Repairs broken links with unambiguous targets.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// Get all tracked Markdown files from git
function getTrackedMarkdownFiles() {
  try {
    const output = execSync('git ls-files "*.md"', { cwd: REPO_ROOT, encoding: 'utf8' });
    return output.trim().split('\n').filter(f => f.length > 0);
  } catch (e) {
    console.error('Error getting tracked files:', e.message);
    return [];
  }
}

// Get git rename mapping from the last commit
function getRenameMapping() {
  try {
    const output = execSync('git diff --name-status -M HEAD~1', { cwd: REPO_ROOT, encoding: 'utf8' });
    const renames = new Map(); // oldPath -> newPath
    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (!line) continue;
      const parts = line.split('\t');
      if (parts[0].startsWith('R')) {
        const oldPath = parts[1];
        const newPath = parts[2];
        renames.set(oldPath, newPath);
      }
    }
    return renames;
  } catch (e) {
    console.error('Error getting rename mapping:', e.message);
    return new Map();
  }
}

// Extract markdown links from content
function extractLinks(content, filePath) {
  const links = [];
  const definitions = new Map();
  
  // Reference definitions: [ref]: url
  const defRegex = /^\[([^\]]+)\]:\s*(\S+)/gm;
  let match;
  while ((match = defRegex.exec(content)) !== null) {
    definitions.set(match[1].toLowerCase(), match[2]);
  }
  
  // Inline links: [text](url)
  const inlineRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = inlineRegex.exec(content)) !== null) {
    links.push({
      type: 'inline',
      label: match[1],
      url: match[2],
      line: content.substring(0, match.index).split('\n').length,
      raw: match[0]
    });
  }
  
  // Images: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = imgRegex.exec(content)) !== null) {
    links.push({
      type: 'image',
      label: match[1],
      url: match[2],
      line: content.substring(0, match.index).split('\n').length,
      raw: match[0]
    });
  }
  
  // Reference-style links: [text][ref] or [text][]
  const refRegex = /\[([^\]]*)\]\[([^\]]*)\]/g;
  while ((match = refRegex.exec(content)) !== null) {
    const refKey = (match[2] || match[1]).toLowerCase();
    const url = definitions.get(refKey);
    links.push({
      type: 'reference',
      label: match[1],
      ref: match[2] || match[1],
      url: url,
      line: content.substring(0, match.index).split('\n').length,
      raw: match[0]
    });
  }
  
  return links;
}

// Check if a URL is external
function isExternalUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://') || 
         url.startsWith('mailto:') || url.startsWith('#');
}

// Resolve a local link relative to the source file
function resolveLocalLink(sourceFileRelPath, linkUrl) {
  // Remove anchor
  const urlNoAnchor = linkUrl.split('#')[0];
  
  if (urlNoAnchor.startsWith('/')) {
    // Repository-root-relative
    return path.join(REPO_ROOT, urlNoAnchor.slice(1));
  }
  
  // Relative to source file
  const sourceDir = path.dirname(path.join(REPO_ROOT, sourceFileRelPath));
  return path.resolve(sourceDir, urlNoAnchor);
}

// Check if path exists (file or directory)
function pathExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

// Check if a link was valid before Wave 3 (existed at old path)
function wasValidBeforeWave3(renameMap, sourceFileRelPath, linkUrl) {
  // 1. Determine the source file's original path before Wave 3 move
  let originalSourceFileRelPath = sourceFileRelPath;
  for (const [oldP, newP] of renameMap.entries()) {
    if (newP === sourceFileRelPath) {
      originalSourceFileRelPath = oldP;
      break;
    }
  }

  // 2. Resolve the linkUrl assuming it's relative to the original source file's directory
  const originalSourceDir = path.dirname(path.join(REPO_ROOT, originalSourceFileRelPath));
  let potentialOldTargetFullPath;
  if (linkUrl.startsWith('/')) {
    potentialOldTargetFullPath = path.join(REPO_ROOT, linkUrl);
  } else {
    potentialOldTargetFullPath = path.resolve(originalSourceDir, linkUrl);
  }
  const potentialOldTargetRelPath = path.relative(REPO_ROOT, potentialOldTargetFullPath);

  // 3. Check if this potentialOldTargetRelPath was itself renamed in Wave 3
  if (renameMap.has(potentialOldTargetRelPath)) {
    const newLocationRelPath = renameMap.get(potentialOldTargetRelPath);
    return { wasValid: true, oldLocation: potentialOldTargetRelPath, newLocation: newLocationRelPath };
  }

  // 4. Also check if the current target (resolved from current source location) is a new path
  const currentTargetFullPath = resolveLocalLink(sourceFileRelPath, linkUrl);
  const currentTargetRelPath = path.relative(REPO_ROOT, currentTargetFullPath);
  for (const [oldP, newP] of renameMap.entries()) {
    if (newP === currentTargetRelPath) {
      // The link points to a new location that was just created - but the file doesn't exist there
      // This suggests the target file was supposed to be moved but isn't there
      return { wasValid: false };
    }
  }

  return { wasValid: false };
}

function main() {
  console.log('=== Markdown Link Validator ===\n');
  
  const markdownFiles = getTrackedMarkdownFiles();
  console.log(`Found ${markdownFiles.length} tracked Markdown files\n`);
  
  const renameMap = getRenameMapping();
  console.log(`Found ${renameMap.size} renames in last commit\n`);
  
  const stats = {
    filesScanned: 0,
    linksExamined: 0,
    validLocal: 0,
    brokenWave3: 0,
    brokenPreExisting: 0,
    external: 0,
    unresolvedReference: 0,
    repaired: 0
  };
  
  const brokenDetails = [];
  const repairs = [];
  
  for (const mdFile of markdownFiles) {
    const fullPath = path.join(REPO_ROOT, mdFile);
    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch (e) {
      console.warn(`Could not read ${mdFile}: ${e.message}`);
      continue;
    }
    
    stats.filesScanned++;
    const links = extractLinks(content, mdFile);
    
    let fileContent = content; // Mutable content for repairs

    for (const link of links) {
      if (!link.url) {
        stats.unresolvedReference++;
        brokenDetails.push({
          file: mdFile,
          line: link.line,
          link: link.raw,
          url: '(undefined reference)',
          resolved: '(undefined)',
          type: 'UNRESOLVED_REFERENCE'
        });
        continue;
      }
      
      // Ignore non-file targets like anchors
      if (link.url.startsWith('#') || link.url.startsWith('mailto:')) {
        stats.external++; 
        continue;
      }

      stats.linksExamined++;
      
      if (isExternalUrl(link.url)) {
        stats.external++;
        continue;
      }
      
      const resolvedFullPath = resolveLocalLink(mdFile, link.url);
      const exists = pathExists(resolvedFullPath);
      
      if (exists) {
        stats.validLocal++;
      } else {
        // Link is broken - determine if it's a Wave 3 regression
        const wave3Check = wasValidBeforeWave3(renameMap, mdFile, link.url);
        
        if (wave3Check.wasValid && wave3Check.newLocation) {
          // This is a Wave 3 regression that can be repaired
          stats.brokenWave3++;
          const newLinkUrl = path.relative(path.dirname(fullPath), path.join(REPO_ROOT, wave3Check.newLocation));
          repairs.push({
            file: mdFile,
            oldRaw: link.raw,
            newRaw: link.raw.replace(link.url, newLinkUrl),
            urlToReplace: link.url,
            newUrlValue: newLinkUrl
          });
          brokenDetails.push({
            file: mdFile,
            line: link.line,
            link: link.raw,
            url: link.url,
            resolved: path.relative(REPO_ROOT, resolvedFullPath),
            type: 'WAVE3_REGRESSION_REPAIRABLE',
            suggestedFix: newLinkUrl
          });
        } else {
          // Broken, and no clear indication it was a Wave 3 change
          stats.brokenPreExisting++;
          brokenDetails.push({
            file: mdFile,
            line: link.line,
            link: link.raw,
            url: link.url,
            resolved: path.relative(REPO_ROOT, resolvedFullPath),
            type: 'PRE_EXISTING'
          });
        }
      }
    }

    // Apply repairs for the current file
    for (const repair of repairs.filter(r => r.file === mdFile)) {
      fileContent = fileContent.replace(repair.oldRaw, repair.newRaw);
      stats.repaired++;
      console.log(`Repaired: ${repair.file}: ${repair.urlToReplace} -> ${repair.newUrlValue}`);
    }
    if (repairs.some(r => r.file === mdFile)) {
      fs.writeFileSync(fullPath, fileContent);
    }
  }
  
  // Report
  console.log('\n=== VALIDATION REPORT ===\n');
  console.log(`Files scanned: ${stats.filesScanned}`);
  console.log(`Links examined: ${stats.linksExamined}`);
  console.log(`Valid local links: ${stats.validLocal}`);
  console.log(`External links (or anchors): ${stats.external}`);
  console.log(`Unresolved references (no definition found): ${stats.unresolvedReference}`);
  console.log(`Broken links introduced by Wave 3 (repaired): ${stats.brokenWave3}`);
  console.log(`Broken links (pre-existing or not clearly Wave 3): ${stats.brokenPreExisting}`);
  console.log(`Links repaired: ${stats.repaired}`);
  
  if (brokenDetails.length > 0) {
    console.log('\n--- Broken Link Details ---\n');
    for (const b of brokenDetails) {
      console.log(`${b.type}: ${b.file}:${b.line}`);
      console.log(`  Link: ${b.link}`);
      console.log(`  Target: ${b.resolved}`);
      if (b.suggestedFix) console.log(`  Suggested Fix: ${b.suggestedFix}`);
      console.log();
    }
  }
  
  // Write report
  const reportPath = path.join(REPO_ROOT, 'docs', 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    brokenDetails,
    repairs
  }, null, 2));
  console.log(`\nReport written to ${reportPath}`);
  
  return stats;
}

main();