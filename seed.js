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
        if (!line || line === ';;;') continue; // skip empty and trailing lines

        // Split by semicolon, handling quotes
        const regex = /;(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        let parts = line.split(regex).map(p => p.replace(/^"|"$/g, '').trim());

        // Must have at least ITEM DESIGN and URAIAN DESIGN
        if (parts.length >= 2 && parts[0]) {
            items.push(parts);
        }
    }
    return items;
}

async function seed() {
    console.log("Reading CSV files...");

    // Boq (designator.csv)
    const boqData = parseCSV('../designator.csv');
    const boqRows = boqData.map(p => ({
        task_name: p[0],
        description: p[1] || '',
        unit: p[2] || ''
    }));

    // Material (material.csv)
    const materialData = parseCSV('../material.csv');
    const materialRows = materialData.map(p => ({
        code: p[0],
        material_name: p[1] || '',
        unit: p[2] || ''
    }));

    if (boqRows.length === 0 && materialRows.length === 0) {
        console.log("No data to insert");
        return;
    }

    console.log(`Pushing ${boqRows.length} BOQ items and ${materialRows.length} Material items...`);

    // Clean up specific tables carefully (do not truncate if they have relations, wait we can delete all since we recreate them now)
    // Actually we only delete if needed, let's delete existing master_boq and master_material
    await supabase.from('master_boq').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('master_material').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert in chunks of 500
    let insertedBoq = 0;
    for (let i = 0; i < boqRows.length; i += 500) {
        const chunk = boqRows.slice(i, i + 500);
        const { error } = await supabase.from('master_boq').insert(chunk);
        if (error) console.error("Error inserting BOQ:", error.message);
        else insertedBoq += chunk.length;
    }
    console.log(`Inserted ${insertedBoq} BOQ.`);

    let insertedMat = 0;
    for (let i = 0; i < materialRows.length; i += 500) {
        const chunk = materialRows.slice(i, i + 500);
        const { error } = await supabase.from('master_material').insert(chunk);
        if (error) console.error("Error inserting Materials:", error.message);
        else insertedMat += chunk.length;
    }
    console.log(`Inserted ${insertedMat} Material.`);

    console.log("Done seeding CSVs into database!");
}

seed().catch(console.error);
