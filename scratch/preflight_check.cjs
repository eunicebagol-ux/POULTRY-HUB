const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

let envVars = {};
try {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || "").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        envVars[match[1]] = val;
      }
    });
  }
} catch (e) {
  console.error("Could not read .env.local");
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("STATUS: NO_ENV_KEYS");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runPreflight() {
  console.log("=== SUPABASE READ-ONLY PREFLIGHT RESULTS ===");

  try {
    const { data, error } = await supabase.from("customers").select("id, clerk_user_id").limit(1);
    if (error) {
      if (error.message && error.message.includes("clerk_user_id")) {
        console.log("- Column customers.clerk_user_id: FALSE (Missing)");
      } else {
        console.log("- Column customers.clerk_user_id Error:", error.message);
      }
    } else {
      console.log("- Column customers.clerk_user_id: TRUE (Exists)");
    }
  } catch (err) {
    console.log("- Column customers.clerk_user_id Check Error:", err.message);
  }

  try {
    const { data, error } = await supabase
      .from("customers")
      .select("clerk_user_id")
      .not("clerk_user_id", "is", null);

    if (error) {
      console.log("- Duplicate clerk_user_id Check Error:", error.message);
    } else if (data) {
      const ids = data.map((r) => r.clerk_user_id).filter(Boolean);
      const counts = {};
      let duplicates = [];
      ids.forEach((id) => {
        counts[id] = (counts[id] || 0) + 1;
        if (counts[id] > 1 && !duplicates.includes(id)) {
          duplicates.push(id);
        }
      });
      console.log(`- Duplicate non-NULL clerk_user_id count: ${duplicates.length}`);
      console.log(`- Total records with non-NULL clerk_user_id: ${ids.length}`);
    }
  } catch (err) {
    console.log("- Duplicate check exception:", err.message);
  }

  try {
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active");
    if (pErr) {
      console.log("- Profiles check error:", pErr.message);
    } else {
      console.log(`- Profiles count: ${profs.length}`);
      profs.forEach((p) => {
        console.log(`  * ${p.id} | ${p.role} | active=${p.is_active} | ${p.full_name}`);
      });
    }
  } catch (err) {
    console.log("- Profiles check exception:", err.message);
  }
}

runPreflight();
