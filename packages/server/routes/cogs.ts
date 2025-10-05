import { Router, Request, Response } from 'express';
import Airtable from 'airtable';

const router = Router();

// Initialize Airtable base
let baseInstance: ReturnType<typeof Airtable.base> | null = null;

function getBase(): ReturnType<typeof Airtable.base> {
  if (!baseInstance) {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      throw new Error('Airtable credentials not configured in server environment');
    }
    Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
    baseInstance = Airtable.base(process.env.AIRTABLE_BASE_ID);
  }
  return baseInstance;
}

// Interface for COGS Calculator Entry
interface COGSCalculatorEntry {
  sessionName: string;
  recipeName: string;
  recipeId: string;
  unitCost: number;
  quantitySold: number;
  totalCost: number;
  notes?: string;
}

/**
 * GET /api/cogs/sessions
 * Get list of all saved COGS calculator sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const base = getBase();
    const records = await base('Customer COGS Calculator')
      .select({
        fields: ['Session Name'],
        view: 'Grid view'
      })
      .all();

    // Get unique session names
    const sessionNames = new Set<string>();
    records.forEach(record => {
      const sessionName = record.get('Session Name') as string;
      if (sessionName) {
        sessionNames.add(sessionName);
      }
    });

    const sessions = Array.from(sessionNames).sort();
    console.log(`📂 Retrieved ${sessions.length} COGS calculator sessions`);

    res.json({
      success: true,
      data: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('❌ Error fetching COGS sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch COGS calculator sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cogs/sessions/:sessionName
 * Load a specific COGS calculator session
 */
router.get('/sessions/:sessionName', async (req: Request, res: Response) => {
  try {
    const { sessionName } = req.params;
    const base = getBase();

    const records = await base('Customer COGS Calculator')
      .select({
        filterByFormula: `{Session Name} = '${sessionName.replace(/'/g, "\\'")}'`,
        view: 'Grid view'
      })
      .all();

    const entries: COGSCalculatorEntry[] = records.map(record => ({
      sessionName: record.get('Session Name') as string,
      recipeName: record.get('Recipe Name') as string,
      recipeId: record.get('Recipe ID') as string,
      unitCost: record.get('Unit Cost') as number,
      quantitySold: record.get('Quantity Sold') as number,
      totalCost: record.get('Total Cost') as number,
      notes: record.get('Notes') as string | undefined
    }));

    console.log(`📂 Loaded session '${sessionName}' with ${entries.length} entries`);

    res.json({
      success: true,
      data: entries,
      sessionName,
      count: entries.length
    });
  } catch (error) {
    console.error('❌ Error loading COGS session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load COGS calculator session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/cogs/sessions
 * Save a new COGS calculator session
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { sessionName, entries } = req.body as {
      sessionName: string;
      entries: COGSCalculatorEntry[];
    };

    if (!sessionName || !entries || !Array.isArray(entries)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'sessionName and entries array are required'
      });
    }

    if (entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'At least one entry is required'
      });
    }

    const base = getBase();

    // Create records in Airtable
    const recordsToCreate = entries.map(entry => ({
      fields: {
        'Session Name': sessionName,
        'Recipe Name': entry.recipeName,
        'Recipe ID': entry.recipeId,
        'Unit Cost': entry.unitCost,
        'Quantity Sold': entry.quantitySold,
        'Total Cost': entry.totalCost,
        'Notes': entry.notes || ''
      }
    }));

    // Airtable allows max 10 records per batch
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < recordsToCreate.length; i += batchSize) {
      batches.push(recordsToCreate.slice(i, i + batchSize));
    }

    let totalCreated = 0;
    for (const batch of batches) {
      const created = await base('Customer COGS Calculator').create(batch);
      totalCreated += created.length;
    }

    console.log(`💾 Saved session '${sessionName}' with ${totalCreated} entries`);

    res.json({
      success: true,
      message: `Session '${sessionName}' saved successfully`,
      sessionName,
      entriesCount: totalCreated
    });
  } catch (error) {
    console.error('❌ Error saving COGS session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save COGS calculator session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/cogs/sessions/:sessionName
 * Delete a COGS calculator session
 */
router.delete('/sessions/:sessionName', async (req: Request, res: Response) => {
  try {
    const { sessionName } = req.params;
    const base = getBase();

    // Find all records for this session
    const records = await base('Customer COGS Calculator')
      .select({
        filterByFormula: `{Session Name} = '${sessionName.replace(/'/g, "\\'")}'`,
        view: 'Grid view'
      })
      .all();

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: `No session found with name '${sessionName}'`
      });
    }

    // Delete records in batches
    const recordIds = records.map(r => r.id);
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < recordIds.length; i += batchSize) {
      batches.push(recordIds.slice(i, i + batchSize));
    }

    let totalDeleted = 0;
    for (const batch of batches) {
      await base('Customer COGS Calculator').destroy(batch);
      totalDeleted += batch.length;
    }

    console.log(`🗑️ Deleted session '${sessionName}' (${totalDeleted} records)`);

    res.json({
      success: true,
      message: `Session '${sessionName}' deleted successfully`,
      deletedCount: totalDeleted
    });
  } catch (error) {
    console.error('❌ Error deleting COGS session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete COGS calculator session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
