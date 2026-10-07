import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLogs() {
  // 1. Get row count
  const { count, error: countErr } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true });
    
  if (countErr) {
    console.error("Error fetching count:", countErr);
    return;
  }
  
  console.log(`Total rows in activity_logs: ${count}`);

  // 2. Get distinct actions and their counts
  const { data: logs, error: logsErr } = await supabase
    .from('activity_logs')
    .select('*');

  if (logsErr) {
    console.error("Error fetching logs:", logsErr);
    return;
  }

  const actions = {};
  const modules = {};
  let nullActor = 0;
  let populatedEntity = 0;
  let metadataPresent = 0;

  logs.forEach(log => {
    actions[log.action] = (actions[log.action] || 0) + 1;
    modules[log.entity_table] = (modules[log.entity_table] || 0) + 1;
    
    if (!log.actor_id) nullActor++;
    if (log.entity_id) populatedEntity++;
    if (log.metadata && Object.keys(log.metadata).length > 0) metadataPresent++;
  });

  console.log("\nDistinct Actions:");
  console.table(actions);

  console.log("\nDistinct Entity Tables (Modules):");
  console.table(modules);

  console.log(`\nLogs with null actor_id: ${nullActor}`);
  console.log(`Logs with populated entity_id: ${populatedEntity}`);
  console.log(`Logs with metadata: ${metadataPresent}`);
  
  // 3. Sample of a few logs
  console.log("\nSample Logs (up to 3):");
  console.log(JSON.stringify(logs.slice(0, 3), null, 2));
}

inspectLogs();
