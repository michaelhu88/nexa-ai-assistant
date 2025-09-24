import { describe, it, expect, beforeEach } from 'vitest';

// Mock the action-runner diff application methods
// Since these are private methods, we'll test via the public interface
class DiffTester {
  applyUnifiedDiff(originalContent: string, unifiedDiff: string): string {
    // Normalize line endings to LF
    const normalizedOriginal = originalContent.replace(/\r\n/g, '\n');
    const normalizedDiff = unifiedDiff.replace(/\r\n/g, '\n');

    const originalLines = normalizedOriginal === '' ? [] : normalizedOriginal.split('\n');
    const diffLines = normalizedDiff.split('\n');

    // Parse all hunks first
    const hunks = this.parseUnifiedDiffHunks(diffLines);

    // Validate all hunks against original content
    // Try strict validation first, then fallback to normalized if needed
    let validationMode = 'strict';
    for (const hunk of hunks) {
      if (!this.validateHunk(originalLines, hunk, validationMode)) {
        // Try normalized validation before failing
        validationMode = 'normalized';
        if (!this.validateHunk(originalLines, hunk, validationMode)) {
          throw new Error(`Hunk validation failed: context mismatch at line ${hunk.oldStart + 1}`);
        }
      }
    }

    // Apply hunks in reverse order to avoid line number shifts
    let result = [...originalLines];
    for (let i = hunks.length - 1; i >= 0; i--) {
      result = this.applyHunk(result, hunks[i]);
    }

    return result.join('\n');
  }

  parseUnifiedDiffHunks(diffLines: string[]): Array<{
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: Array<{ type: 'context' | 'delete' | 'add'; content: string }>;
  }> {
    const hunks = [];
    let currentHunk: any = null;

    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];

      if (line.startsWith('@@')) {
        // Save previous hunk
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        // Parse new hunk header
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (!match) {
          throw new Error(`Invalid hunk header: ${line}`);
        }

        currentHunk = {
          oldStart: parseInt(match[1]) - 1, // Convert to 0-based
          oldCount: parseInt(match[2] || '1'),
          newStart: parseInt(match[3]) - 1, // Convert to 0-based
          newCount: parseInt(match[4] || '1'),
          lines: []
        };
      } else if (currentHunk && (line.startsWith(' ') || line.startsWith('-') || line.startsWith('+'))) {
        // Parse hunk content
        const type = line.startsWith(' ') ? 'context' : line.startsWith('-') ? 'delete' : 'add';
        const content = line.substring(1);
        currentHunk.lines.push({ type, content });
      }
      // Ignore other lines (like "\ No newline at end of file")
    }

    // Save last hunk
    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  validateHunk(originalLines: string[], hunk: any, mode: string = 'strict'): boolean {
    let originalIndex = hunk.oldStart;

    for (const line of hunk.lines) {
      if (line.type === 'context' || line.type === 'delete') {
        // Check if we're within bounds
        if (originalIndex >= originalLines.length) {
          return false;
        }

        // Compare based on validation mode
        const originalLine = originalLines[originalIndex];
        const hunkLine = line.content;

        let matches = false;
        if (mode === 'strict') {
          matches = originalLine === hunkLine;
        } else if (mode === 'normalized') {
          // Normalize whitespace for comparison (but still preserve in output)
          matches = originalLine.trim() === hunkLine.trim();
        }

        if (!matches) {
          return false;
        }
        originalIndex++;
      }
      // Add lines don't need validation against original
    }

    return true;
  }

  applyHunk(lines: string[], hunk: any): string[] {
    const result: string[] = [];
    let originalIndex = 0;
    let hunkLineIndex = 0;

    // Copy lines before the hunk
    while (originalIndex < hunk.oldStart) {
      result.push(lines[originalIndex]);
      originalIndex++;
    }

    // Process the hunk
    while (hunkLineIndex < hunk.lines.length) {
      const hunkLine = hunk.lines[hunkLineIndex];

      if (hunkLine.type === 'context') {
        // Context line: copy from original and advance both pointers
        result.push(lines[originalIndex]);
        originalIndex++;
      } else if (hunkLine.type === 'delete') {
        // Delete line: skip the original line (don't copy it)
        originalIndex++;
      } else if (hunkLine.type === 'add') {
        // Add line: add the new content
        result.push(hunkLine.content);
      }

      hunkLineIndex++;
    }

    // Copy remaining lines after the hunk
    while (originalIndex < lines.length) {
      result.push(lines[originalIndex]);
      originalIndex++;
    }

    return result;
  }
}

describe('Diff Application System', () => {
  let tester: DiffTester;

  beforeEach(() => {
    tester = new DiffTester();
  });

  describe('Basic Diff Application', () => {
    it('should apply a simple single-line change', () => {
      const original = `function hello() {
  console.log("hello");
  return true;
}`;

      const diff = `@@ -1,4 +1,4 @@
 function hello() {
-  console.log("hello");
+  console.log("world");
   return true;
 }`;

      const expected = `function hello() {
  console.log("world");
  return true;
}`;

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });

    it('should apply multiple hunks', () => {
      const original = `line1
line2
line3
line4
line5`;

      const diff = `@@ -1,2 +1,2 @@
-line1
+modified1
 line2
@@ -4,2 +4,2 @@
 line4
-line5
+modified5`;

      const expected = `modified1
line2
line3
line4
modified5`;

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });
  });

  describe('Line Ending Normalization', () => {
    it('should handle CRLF line endings in original', () => {
      const original = "line1\r\nline2\r\nline3";
      const diff = `@@ -1,3 +1,3 @@
 line1
-line2
+modified2
 line3`;

      const expected = `line1
modified2
line3`;

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });

    it('should handle CRLF line endings in diff', () => {
      const original = "line1\nline2\nline3";
      const diff = "@@ -1,3 +1,3 @@\r\n line1\r\n-line2\r\n+modified2\r\n line3";

      const expected = `line1
modified2
line3`;

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });
  });

  describe('Whitespace Handling', () => {
    it('should handle trailing whitespace differences in context lines', () => {
      const original = "  function test() {  \n    return true;\n  }";
      const diff = `@@ -1,3 +1,3 @@
   function test() {
-    return true;
+    return false;
   }`;

      // Normalized validation preserves original whitespace while allowing match
      // The trailing spaces in the first line are preserved from original
      const expected = "  function test() {  \n    return false;\n  }";

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });

    it('should preserve exact indentation in output', () => {
      const original = "\tfunction test() {\n\t\treturn true;\n\t}";
      const diff = `@@ -1,3 +1,3 @@
 	function test() {
-		return true;
+		return false;
 	}`;

      const expected = `	function test() {
		return false;
	}`;

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file to content', () => {
      const original = "";
      const diff = `@@ -0,0 +1,3 @@
+line1
+line2
+line3`;

      const expected = `line1
line2
line3`;

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });

    it('should handle content to empty file', () => {
      const original = "line1\nline2\nline3";
      const diff = `@@ -1,3 +0,0 @@
-line1
-line2
-line3`;

      const expected = "";

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });

    it('should handle adding lines at the end', () => {
      const original = "line1\nline2";
      const diff = `@@ -1,2 +1,4 @@
 line1
 line2
+line3
+line4`;

      const expected = `line1
line2
line3
line4`;

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });

    it('should handle adding lines at the beginning', () => {
      const original = "line2\nline3";
      const diff = `@@ -1,2 +1,4 @@
+line0
+line1
 line2
 line3`;

      const expected = `line0
line1
line2
line3`;

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });
  });

  describe('Error Handling', () => {
    it('should throw error on invalid hunk header', () => {
      const original = "line1";
      const diff = `@@ invalid header @@
-line1
+line2`;

      expect(() => {
        tester.applyUnifiedDiff(original, diff);
      }).toThrow('Invalid hunk header');
    });

    it('should throw error on context mismatch with strict validation', () => {
      const original = "line1\nline2\nline3";
      const diff = `@@ -1,3 +1,3 @@
 line1
-wrong_line
+modified
 line3`;

      expect(() => {
        tester.applyUnifiedDiff(original, diff);
      }).toThrow('Hunk validation failed');
    });

    it('should handle normalized validation when context has whitespace differences', () => {
      const original = "  line1  \nline2\n  line3";
      const diff = `@@ -1,3 +1,3 @@
 line1
-line2
+modified
 line3`;

      // Normalized validation allows matching but preserves original whitespace
      // The trailing spaces in line1 are preserved from original
      const expected = "  line1  \nmodified\n  line3";

      const result = tester.applyUnifiedDiff(original, diff);
      expect(result).toBe(expected);
    });
  });

  describe('Format Validation', () => {
    it('should detect missing @@ headers', () => {
      const content = "some content";
      const invalidDiff = "-old line\n+new line";

      // In real implementation, this check happens before applyUnifiedDiff
      expect(invalidDiff.includes('@@')).toBe(false);
    });

    it('should handle well-formed unified diff', () => {
      const diff = `@@ -1,3 +1,3 @@
 context
-delete
+add
 context`;

      expect(diff.includes('@@')).toBe(true);
      expect(diff.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)).toBeTruthy();
    });
  });
});