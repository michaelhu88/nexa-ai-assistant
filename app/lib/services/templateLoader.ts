import { type Template } from './templateService';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';
import { Buffer } from 'node:buffer';

const logger = createScopedLogger('templateLoader');

export interface ExtractedFile {
  path: string;
  content: string;
  type: 'text' | 'binary';
}

export interface TemplateLoadResult {
  success: boolean;
  filesLoaded: number;
  template: Template;
  error?: string;
}

export class TemplateLoaderService {
  /**
   * Download and extract template using server-side API
   */
  private async _downloadAndExtractTemplate(template: Template): Promise<ExtractedFile[]> {
    try {
      logger.info(`Downloading template via API: ${template.name}`);

      // Call server-side template download API
      const response = await fetch('/api/template-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: template.id,
          action: 'download',
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          `Template download API failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`,
        );
      }

      const result = (await response.json()) as {
        success: boolean;
        files?: ExtractedFile[];
        error?: string;
      };

      if (!result.success) {
        throw new Error(`Template download failed: ${result.error}`);
      }

      if (!result.files || result.files.length === 0) {
        throw new Error('No files returned from template download API');
      }

      logger.info(`✅ Downloaded ${result.files.length} files via API`);

      return result.files;
    } catch (error) {
      logger.error('Error downloading template via API:', error);
      throw new Error(`Failed to extract template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply extracted template files to the workbench
   */
  private async _applyTemplateToWorkbench(files: ExtractedFile[]): Promise<void> {
    try {
      logger.info(`Applying ${files.length} files to workbench`);

      for (const file of files) {
        if (file.type === 'text') {
          // Add text files to workbench
          await workbenchStore.createFile(file.path, file.content);
          logger.debug(`Added file to workbench: ${file.path}`);
        } else {
          // For binary files, decode base64 and create as binary
          const binaryContent = new Uint8Array(Buffer.from(file.content, 'base64'));
          await workbenchStore.createFile(file.path, binaryContent);
          logger.debug(`Added binary file to workbench: ${file.path}`);
        }
      }

      logger.info('Template files applied to workbench successfully');
    } catch (error) {
      logger.error('Error applying template to workbench:', error);
      throw error;
    }
  }

  /**
   * Determine if a file should be treated as text based on its extension
   */
  private _isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.vue',
      '.svelte',
      '.html',
      '.htm',
      '.css',
      '.scss',
      '.sass',
      '.less',
      '.json',
      '.xml',
      '.yaml',
      '.yml',
      '.toml',
      '.md',
      '.txt',
      '.csv',
      '.sql',
      '.py',
      '.rb',
      '.go',
      '.rs',
      '.java',
      '.c',
      '.cpp',
      '.h',
      '.php',
      '.sh',
      '.bash',
      '.zsh',
      '.fish',
      '.gitignore',
      '.gitattributes',
      '.env',
      '.env.example',
      '.editorconfig',
      '.prettierrc',
      '.eslintrc',
      '.babelrc',
      'Dockerfile',
      'README',
      'LICENSE',
      'CHANGELOG',
      'package.json',
      'composer.json',
      'Cargo.toml',
      'pyproject.toml',
    ];

    const extension = filePath.toLowerCase();
    const fileName = filePath.split('/').pop()?.toLowerCase() || '';

    return textExtensions.some(
      (ext) => extension.endsWith(ext) || fileName === ext.substring(1) || fileName.startsWith(ext.substring(1)),
    );
  }

  /**
   * Load a template into the workbench
   */
  async loadTemplateIntoWorkbench(template: Template): Promise<TemplateLoadResult> {
    try {
      logger.info(`Loading template into workbench: ${template.name}`);

      // Download and extract template
      const extractedFiles = await this._downloadAndExtractTemplate(template);

      if (extractedFiles.length === 0) {
        throw new Error('No files found in template');
      }

      // Apply to workbench
      await this._applyTemplateToWorkbench(extractedFiles);

      const result: TemplateLoadResult = {
        success: true,
        filesLoaded: extractedFiles.length,
        template,
      };

      logger.info(`Template loaded successfully: ${template.name} (${extractedFiles.length} files)`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to load template ${template.name}:`, error);

      return {
        success: false,
        filesLoaded: 0,
        template,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if workbench already has significant content
   * Returns true if workbench has files that might conflict with template
   */
  hasExistingContent(): boolean {
    const files = workbenchStore.files.get();
    const fileCount = Object.keys(files).length;

    // Consider workbench "empty" if it has 0 files or only basic config files
    const basicFiles = ['package.json', '.gitignore', 'README.md', '.env.example'];
    const hasOnlyBasicFiles = Object.keys(files).every((path) =>
      basicFiles.some((basicFile) => path.endsWith(basicFile)),
    );

    return fileCount > 0 && !hasOnlyBasicFiles;
  }

  /**
   * Validate that template can be safely loaded using server-side API
   */
  async validateTemplateLoad(template: Template): Promise<{ canLoad: boolean; reason?: string }> {
    // Check if workbench has existing content
    if (this.hasExistingContent()) {
      return {
        canLoad: false,
        reason: 'Workbench already contains files. Template loading is only allowed in empty workbench.',
      };
    }

    // Check if template exists and is accessible via API
    try {
      logger.info(`Validating template via API: ${template.name}`);

      const response = await fetch('/api/template-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: template.id,
          action: 'validate',
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { error?: string };
        return {
          canLoad: false,
          reason: `Template validation API failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`,
        };
      }

      const result = (await response.json()) as {
        success: boolean;
        validation?: { canLoad: boolean; reason?: string };
        error?: string;
      };

      if (!result.success) {
        return {
          canLoad: false,
          reason: `Template validation failed: ${result.error}`,
        };
      }

      if (!result.validation) {
        return {
          canLoad: false,
          reason: 'No validation result returned from API',
        };
      }

      logger.info(`✅ Template validation result: canLoad=${result.validation.canLoad}`);

      return result.validation;
    } catch (error) {
      return {
        canLoad: false,
        reason: `Template validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Export singleton instance
export const templateLoader = new TemplateLoaderService();
