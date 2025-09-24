import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

// Template download API route disabled for simplified deployment
export async function action({ request: _request }: ActionFunctionArgs) {
  return json({ error: 'Template download service temporarily disabled for deployment' }, { status: 503 });
}

/*
 * Original template download implementation commented out for simplified deployment
 * import { createClient } from '@supabase/supabase-js';
 * import type { SupabaseClient } from '@supabase/supabase-js';
 * import { createScopedLogger } from '~/utils/logger';
 *
 * const logger = createScopedLogger('api.template-download');
 *
 * interface ExtractedFile {
 * path: string;
 * content: string;
 * type: 'text' | 'binary';
 * }
 *
 * interface TemplateDownloadResult {
 * success: boolean;
 * files?: ExtractedFile[];
 * template?: {
 *  id: string;
 *  name: string;
 *  storage_path: string;
 * };
 * error?: string;
 * }
 *
 * class ServerTemplateDownloader {
 * private getServiceClient(context: any): SupabaseClient {
 *  const url = process.env.VITE_SUPABASE_TEMPLATE_URL || (context.cloudflare?.env as any)?.VITE_SUPABASE_TEMPLATE_URL;
 *  const serviceKey = process.env.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY || (context.cloudflare?.env as any)?.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY;
 *
 *  if (!url || !serviceKey) {
 *    throw new Error('Supabase service role credentials not configured');
 *  }
 *
 *  return createClient(url, serviceKey);
 * }
 *
 * private isTextFile(filePath: string): boolean {
 *  const textExtensions = [
 *    '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
 *    '.html', '.htm', '.css', '.scss', '.sass', '.less',
 *    '.json', '.xml', '.yaml', '.yml', '.toml',
 *    '.md', '.txt', '.csv', '.sql',
 *    '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h',
 *    '.php', '.sh', '.bash', '.zsh', '.fish',
 *    '.gitignore', '.gitattributes', '.env', '.env.example',
 *    '.editorconfig', '.prettierrc', '.eslintrc', '.babelrc',
 *    'Dockerfile', 'README', 'LICENSE', 'CHANGELOG',
 *    'package.json', 'composer.json', 'Cargo.toml', 'pyproject.toml'
 *  ];
 *
 *  const extension = filePath.toLowerCase();
 *  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
 *
 *  return textExtensions.some(ext =>
 *    extension.endsWith(ext) || fileName === ext.substring(1) || fileName.startsWith(ext.substring(1))
 *  );
 * }
 *
 * async downloadAndExtractTemplate(templateId: string, context: any): Promise<TemplateDownloadResult> {
 *  try {
 *    logger.info(`🔄 Starting server-side template download for ID: ${templateId}`);
 *
 *    const supabase = this.getServiceClient(context);
 *
 *    const { data: template, error: templateError } = await supabase
 *      .from('templates')
 *      .select('*')
 *      .eq('id', templateId)
 *      .single();
 *
 *    if (templateError) {
 *      logger.error('Failed to fetch template metadata:', templateError);
 *      throw new Error(`Template not found: ${templateError.message}`);
 *    }
 *
 *    if (!template) {
 *      throw new Error('Template not found');
 *    }
 *
 *    logger.info(`📋 Found template: ${template.name} (${template.storage_path})`);
 *
 *    const bucketName = 'templates';
 *    const { data: urlData, error: urlError } = await supabase
 *      .storage
 *      .from(bucketName)
 *      .createSignedUrl(template.storage_path, 3600);
 *
 *    if (urlError) {
 *      logger.error('Failed to create signed URL:', urlError);
 *      throw new Error(`Failed to create download URL: ${urlError.message}`);
 *    }
 *
 *    if (!urlData?.signedUrl) {
 *      throw new Error('No signed URL returned');
 *    }
 *
 *    logger.info(`🔗 Created signed URL for: ${template.storage_path}`);
 *
 *    logger.info('⬇️ Downloading template zip file...');
 *    const response = await fetch(urlData.signedUrl);
 *
 *    if (!response.ok) {
 *      throw new Error(`Failed to download template: ${response.statusText}`);
 *    }
 *
 *    const arrayBuffer = await response.arrayBuffer();
 *    logger.info(`📦 Downloaded ${arrayBuffer.byteLength} bytes`);
 *
 *    const JSZip = await import('jszip');
 *    const zip = new JSZip.default();
 *    const zipData = await zip.loadAsync(arrayBuffer);
 *
 *    const extractedFiles: ExtractedFile[] = [];
 *
 *    for (const [relativePath, zipObject] of Object.entries(zipData.files)) {
 *      if (zipObject.dir) {
 *        continue;
 *      }
 *
 *      const excludePatterns = [
 *        'node_modules/',
 *        '.next/',
 *        '.nuxt/',
 *        'dist/',
 *        'build/',
 *        '.git/',
 *        '.DS_Store',
 *        'Thumbs.db',
 *        '.env.local',
 *        '.env.production',
 *        'npm-debug.log',
 *        'yarn-debug.log',
 *        'yarn-error.log',
 *        '.cache/',
 *        'coverage/',
 *        '.nyc_output/',
 *        '.vscode/',
 *        '.idea/'
 *      ];
 *
 *      const shouldSkip = excludePatterns.some(pattern =>
 *        relativePath.includes(pattern) || relativePath.endsWith(pattern.replace('/', ''))
 *      );
 *
 *      if (shouldSkip) {
 *        logger.debug(`⏭️ Skipping excluded file: ${relativePath}`);
 *        continue;
 *      }
 *
 *      try {
 *        const isTextFile = this.isTextFile(relativePath);
 *
 *        if (isTextFile) {
 *          const content = await zipObject.async('text');
 *          extractedFiles.push({
 *            path: relativePath,
 *            content,
 *            type: 'text'
 *          });
 *        } else {
 *          const content = await zipObject.async('base64');
 *          extractedFiles.push({
 *            path: relativePath,
 *            content,
 *            type: 'binary'
 *          });
 *        }
 *
 *        logger.debug(`📄 Extracted file: ${relativePath} (${isTextFile ? 'text' : 'binary'})`);
 *      } catch (fileError) {
 *        logger.warn(`Failed to extract file ${relativePath}:`, fileError);
 *      }
 *    }
 *
 *    logger.info(`✅ Extracted ${extractedFiles.length} files from template`);
 *
 *    return {
 *      success: true,
 *      files: extractedFiles,
 *      template: {
 *        id: template.id,
 *        name: template.name,
 *        storage_path: template.storage_path
 *      }
 *    };
 *  } catch (error) {
 *    logger.error('💥 Error downloading and extracting template:', error);
 *    return {
 *      success: false,
 *      error: error instanceof Error ? error.message : 'Unknown error'
 *    };
 *  }
 * }
 *
 * async validateTemplate(templateId: string, context: any): Promise<{ canLoad: boolean; reason?: string }> {
 *  try {
 *    logger.info(`🔍 Validating template access for ID: ${templateId}`);
 *
 *    const supabase = this.getServiceClient(context);
 *
 *    const { data: template, error: templateError } = await supabase
 *      .from('templates')
 *      .select('id, name, storage_path')
 *      .eq('id', templateId)
 *      .single();
 *
 *    if (templateError) {
 *      logger.error('Template validation failed:', templateError);
 *      return {
 *        canLoad: false,
 *        reason: `Template not found: ${templateError.message}`
 *      };
 *    }
 *
 *    if (!template) {
 *      return {
 *        canLoad: false,
 *        reason: 'Template not found'
 *      };
 *    }
 *
 *    const bucketName = 'templates';
 *    const { data: fileData, error: fileError } = await supabase
 *      .storage
 *      .from(bucketName)
 *      .list('', {
 *        search: template.storage_path
 *      });
 *
 *    if (fileError) {
 *      logger.error('Storage validation failed:', fileError);
 *      return {
 *        canLoad: false,
 *        reason: `Storage access failed: ${fileError.message}`
 *      };
 *    }
 *
 *    const fileExists = fileData && fileData.length > 0;
 *
 *    if (!fileExists) {
 *      return {
 *        canLoad: false,
 *        reason: 'Template file not found in storage'
 *      };
 *    }
 *
 *    logger.info(`✅ Template validation passed: ${template.name}`);
 *    return { canLoad: true };
 *  } catch (error) {
 *    logger.error('💥 Error validating template:', error);
 *    return {
 *      canLoad: false,
 *      reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
 *    };
 *  }
 * }
 * }
 *
 * export async function originalAction({ request, context }: ActionFunctionArgs) {
 * if (request.method !== 'POST') {
 *  return json({ error: 'Method not allowed' }, { status: 405 });
 * }
 *
 * try {
 *  const body = (await request.json()) as {
 *    templateId: string;
 *    action: 'validate' | 'download';
 *  };
 *
 *  const { templateId, action } = body;
 *
 *  if (!templateId) {
 *    return json({ error: 'Template ID required' }, { status: 400 });
 *  }
 *
 *  if (!action) {
 *    return json({ error: 'Action required (validate or download)' }, { status: 400 });
 *  }
 *
 *  logger.info(`🚀 Starting template ${action} for ID: ${templateId}`);
 *
 *  const downloader = new ServerTemplateDownloader();
 *
 *  if (action === 'validate') {
 *    const validation = await downloader.validateTemplate(templateId, context);
 *    return json({
 *      success: true,
 *      validation
 *    });
 *  } else if (action === 'download') {
 *    const result = await downloader.downloadAndExtractTemplate(templateId, context);
 *    return json(result);
 *  } else {
 *    return json({ error: 'Invalid action. Use "validate" or "download"' }, { status: 400 });
 *  }
 * } catch (error) {
 *  logger.error('💥 Template download API failed:', error);
 *
 *  return json({
 *    success: false,
 *    error: error instanceof Error ? error.message : 'Unknown error',
 *  }, { status: 500 });
 * }
 * }
 *
 */ // End of commented template download API
