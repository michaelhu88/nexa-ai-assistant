import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

// Template listing API route disabled for simplified deployment
export async function loader({ request }: ActionFunctionArgs) {
  return json({ error: 'Template listing service temporarily disabled for deployment' }, { status: 503 });
}

export async function action({ request }: ActionFunctionArgs) {
  return json({ error: 'Template search service temporarily disabled for deployment' }, { status: 503 });
}

/* Original template listing implementation commented out for simplified deployment
import { createClient } from '@supabase/supabase-js';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.templates');

interface Template {
  id: string;
  name: string;
  keywords?: string[];
  storage_path: string;
  created_at: string;
}

export async function originalLoader({ context }: ActionFunctionArgs) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_TEMPLATE_URL || (context.cloudflare?.env as any)?.VITE_SUPABASE_TEMPLATE_URL;
    const supabaseKey =
      process.env.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY || (context.cloudflare?.env as any)?.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Missing Supabase template credentials');
      return json({ error: 'Template service not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch templates:', error);
      return json({ error: 'Failed to fetch templates', details: error.message }, { status: 500 });
    }

    logger.info(`Fetched ${data?.length || 0} templates`);

    return json({ templates: data || [] });
  } catch (error) {
    logger.error('Error in loader:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function originalAction({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as { query?: string };
    const { query } = body;

    if (!query) {
      return json({ error: 'Query parameter required' }, { status: 400 });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_TEMPLATE_URL || (context.cloudflare?.env as any)?.VITE_SUPABASE_TEMPLATE_URL;
    const supabaseKey =
      process.env.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY || (context.cloudflare?.env as any)?.SUPABASE_TEMPLATE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logger.error('Missing Supabase template credentials');
      return json({ error: 'Template service not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to search templates:', error);
      return json({ error: 'Failed to search templates', details: error.message }, { status: 500 });
    }

    const searchTerm = query.toLowerCase();
    const filtered = (data || []).filter((template: Template) => {
      if (template.name.toLowerCase().includes(searchTerm)) {
        return true;
      }

      if (template.keywords && Array.isArray(template.keywords)) {
        return template.keywords.some((keyword: string) => keyword.toLowerCase().includes(searchTerm));
      }

      return false;
    });

    logger.info(`Found ${filtered.length} templates matching: ${query}`);

    return json({ templates: filtered });
  } catch (error) {
    logger.error('Error in action:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

*/ // End of commented template listing API