const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const items = [];

    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by semicolon, handling quotes if necessary (though simple split works for these files as they don't seem to have embedded semicolons, wait, some have quotes!)
        // Using a simple regex to split by semicolon honoring quotes
        const regex = /;(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        let parts = line.split(regex).map(p => p.replace(/^"|"$/g, '').trim());

        if (parts.length >= 2 && parts[0]) {
            items.push(parts);
        }
    }
    return items;
}

async function seed() {
    console.log("Reading CSV files...");

    // Boq
    const boqData = parseCSV('../designator.csv');
    const boqRows = boqData.map(p => ({
        task_name: p[0],
        description: p[1] || null,
        unit: p[2] || null
    }));

    // Material
    const materialData = parseCSV('../material.csv');
    const materialRows = materialData.map(p => ({
        code: p[0],
        material_name: p[1] || null,
        unit: p[2] || null
    }));

    if (boqRows.length === 0 && materialRows.length === 0) {
        console.log("No data to insert");
        return;
    }

    console.log(`Pusging ${boqRows.length} BOQ items and ${materialRows.length} Material items...`);

    const dummyProjects = [
        { project_name: "Proyek Fiber Jakarta Pusat" },
        { project_name: "Proyek Jaringan Surabaya" },
        { project_name: "Perawatan FAT Bandung" },
        { project_name: "Instalasi Baru ODC Medan" },
        { project_name: "Korektif Maintenance" }
    ];

    // Clear existing items just in case (optional, we'll just insert)
    // Or upsert. But tables don't have constraints on name to use upsert easily.
    // Instead, let's delete all and reinsert.
    await supabase.from('master_boq').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('master_material').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('master_project').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log("Inserting projects...");
    await supabase.from('master_project').insert(dummyProjects);

    // Insert in chunks of 500
    for (let i = 0; i < boqRows.length; i += 500) {
        const chunk = boqRows.slice(i, i + 500);
        const { error } = await supabase.from('master_boq').insert(chunk);
        if (error) console.error("Error inserting BOQ:", error.message);
    }

    for (let i = 0; i < materialRows.length; i += 500) {
        const chunk = materialRows.slice(i, i + 500);
        const { error } = await supabase.from('master_material').insert(chunk);
        if (error) console.error("Error inserting Materials:", error.message);
    }

    console.log("Done seeding CSVs into database!");
}

seed().catch(console.error);
