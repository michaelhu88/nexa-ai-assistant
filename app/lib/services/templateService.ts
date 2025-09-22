import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('templateService');

// Template interface matching your database schema
export interface Template {
  id: string;
  name: string;
  keywords?: string[];
  storage_path: string;
  created_at: string;
}

class TemplateService {
  private supabaseClient: SupabaseClient | null = null;

  /**
   * Get or create Supabase client for template database
   */
  private getTemplateClient(): SupabaseClient {
    if (!this.supabaseClient) {
      const url = import.meta.env?.VITE_SUPABASE_TEMPLATE_URL;
      const anonKey = import.meta.env?.VITE_SUPABASE_TEMPLATE_ANON_KEY;

      if (!url || !anonKey) {
        throw new Error('Supabase template credentials not configured. Please check your .env file.');
      }

      this.supabaseClient = createClient(url, anonKey);
      logger.info('Supabase template client initialized with anon key');
    }

    return this.supabaseClient;
  }

  /**
   * Get Supabase client with service role for storage operations
   */
  private getServiceClient(): SupabaseClient {
    const url = import.meta.env?.VITE_SUPABASE_TEMPLATE_URL;
    const serviceKey = import.meta.env?.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error('Supabase service role credentials not configured. Please check your .env file.');
    }

    return createClient(url, serviceKey);
  }

  /**
   * List all available templates
   */
  async listTemplates(): Promise<Template[]> {
    try {
      const client = this.getTemplateClient();

      const { data, error } = await client.from('templates').select('*').order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch templates:', error);
        throw new Error(`Failed to fetch templates: ${error.message}`);
      }

      logger.info(`Fetched ${data?.length || 0} templates`);

      return data || [];
    } catch (error) {
      logger.error('Error in listTemplates:', error);
      throw error;
    }
  }

  /**
   * Get a template by name
   */
  async getTemplateByName(name: string): Promise<Template | null> {
    try {
      const client = this.getTemplateClient();

      const { data, error } = await client.from('templates').select('*').eq('name', name).single();

      if (error) {
        if (error.code === 'PGRST116') {
          logger.info(`Template not found: ${name}`);
          return null;
        }

        logger.error('Failed to fetch template:', error);
        throw new Error(`Failed to fetch template: ${error.message}`);
      }

      logger.info(`Found template: ${name}`);

      return data;
    } catch (error) {
      logger.error('Error in getTemplateByName:', error);
      throw error;
    }
  }

  /**
   * Get signed URL for downloading template from storage
   * Uses service role client since storage requires elevated permissions
   */
  async getTemplateDownloadUrl(storagePath: string): Promise<string> {
    try {
      // Use service client for storage operations due to RLS restrictions
      const client = this.getServiceClient();
      const bucketName = 'templates';

      // Create a signed URL that expires in 1 hour
      const { data, error } = await client.storage.from(bucketName).createSignedUrl(storagePath, 3600);

      if (error) {
        logger.error('Failed to create signed URL:', error);
        throw new Error(`Failed to create download URL: ${error.message}`);
      }

      if (!data?.signedUrl) {
        throw new Error('No signed URL returned');
      }

      logger.info(`Created signed URL for: ${storagePath}`);

      return data.signedUrl;
    } catch (error) {
      logger.error('Error in getTemplateDownloadUrl:', error);
      throw error;
    }
  }

  /**
   * Search templates by keywords
   */
  async searchTemplates(query: string): Promise<Template[]> {
    try {
      const client = this.getTemplateClient();
      const searchTerm = query.toLowerCase();

      // First, get all templates (since we need to search in array field)
      const { data, error } = await client.from('templates').select('*').order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to search templates:', error);
        throw new Error(`Failed to search templates: ${error.message}`);
      }

      // Filter by name or keywords
      const filtered = (data || []).filter((template) => {
        // Check name
        if (template.name.toLowerCase().includes(searchTerm)) {
          return true;
        }

        // Check keywords
        if (template.keywords && Array.isArray(template.keywords)) {
          return template.keywords.some((keyword: string) => keyword.toLowerCase().includes(searchTerm));
        }

        return false;
      });

      logger.info(`Found ${filtered.length} templates matching: ${query}`);

      return filtered;
    } catch (error) {
      logger.error('Error in searchTemplates:', error);
      throw error;
    }
  }

  /**
   * Test connection to Supabase
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = this.getTemplateClient();

      // Try to fetch templates with limit 1 to test connection
      const { error } = await client.from('templates').select('id').limit(1);

      if (error) {
        logger.error('Connection test failed:', error);
        return false;
      }

      logger.info('Connection test successful');

      return true;
    } catch (error) {
      logger.error('Connection test error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const templateService = new TemplateService();
