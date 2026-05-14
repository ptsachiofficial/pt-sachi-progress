const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
    const { data } = await supabase.from('laporan_kerja').select('*').not('photo_urls', 'eq', '[]').limit(1);
    console.log(JSON.stringify(data, null, 2));
}
test();
