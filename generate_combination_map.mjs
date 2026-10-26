// generate_combination_map.mjs - Offline matrix generator for pSEO 0-job recommendations
// Queries Supabase active jobs, maps trade <-> county presence, outputs data/combination_map.json
// Zero request-time load on Supabase; pushed directly to GitHub CDN alongside EURES data.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eiioaktlzpptiwcbjnqc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaW9ha3RsenBwdGl3Y2JqbnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDUzNjQsImV4cCI6MjA5Nzg4MTM2NH0.i93YX7oimKMe8AfjQEC1imHRGXQ-tCNNm9tbJjxiQRc';

// 42 Romanian Counties
const COUNTY_MAP = {
    'alba': ['Alba'],
    'arad': ['Arad'],
    'arges': ['Argeș', 'Arges'],
    'bacau': ['Bacău', 'Bacau'],
    'bihor': ['Bihor'],
    'bistrita-nasaud': ['Bistrița-Năsăud', 'Bistrita-Nasaud', 'Bistrita'],
    'botosani': ['Botoșani', 'Botosani'],
    'braila': ['Brăila', 'Braila'],
    'brasov': ['Brașov', 'Brasov'],
    'bucuresti': ['București', 'Bucuresti', 'Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5', 'Sector 6'],
    'buzau': ['Buzău', 'Buzau'],
    'caras-severin': ['Caraș-Severin', 'Caras-Severin', 'Resita', 'Reșița'],
    'calarasi': ['Călărași', 'Calarasi'],
    'cluj': ['Cluj', 'Cluj-Napoca'],
    'constanta': ['Constanța', 'Constanta'],
    'covasna': ['Covasna', 'Sfantu Gheorghe', 'Sfântu Gheorghe'],
    'dambovita': ['Dâmbovița', 'Dambovita', 'Targoviste'],
    'dolj': ['Dolj', 'Craiova'],
    'galati': ['Galați', 'Galati'],
    'giurgiu': ['Giurgiu'],
    'gorj': ['Gorj', 'Targu Jiu', 'Târgu Jiu'],
    'harghita': ['Harghita', 'Miercurea Ciuc'],
    'hunedoara': ['Hunedoara', 'Deva'],
    'ialomita': ['Ialomița', 'Ialomita', 'Slobozia'],
    'iasi': ['Iași', 'Iasi'],
    'ilfov': ['Ilfov', 'Otopeni', 'Voluntari', 'Buftea', 'Pantelimon', 'Chiajna', 'Bragadiru', 'Popesti-Leordeni'],
    'maramures': ['Maramureș', 'Maramures', 'Baia Mare'],
    'mehedinti': ['Mehedinți', 'Mehedinti', 'Drobeta-Turnu Severin'],
    'mures': ['Mureș', 'Mures', 'Targu Mures', 'Târgu Mureș'],
    'neamt': ['Neamț', 'Neamt', 'Piatra Neamt'],
    'olt': ['Olt', 'Slatina'],
    'prahova': ['Prahova', 'Ploiesti'],
    'satu-mare': ['Satu Mare', 'Satu-Mare'],
    'salaj': ['Sălaj', 'Salaj', 'Zalau'],
    'sibiu': ['Sibiu'],
    'suceava': ['Suceava'],
    'teleorman': ['Teleorman', 'Alexandria'],
    'timis': ['Timiș', 'Timis', 'Timisoara', 'Timișoara'],
    'tulcea': ['Tulcea'],
    'vaslui': ['Vaslui', 'Barlad'],
    'valcea': ['Vâlcea', 'Valcea', 'Ramnicu Valcea', 'Râmnicu Vâlcea'],
    'vrancea': ['Vrancea', 'Focsani', 'Focșani']
};

// 20 Standard Trade Definitions & Keywords
const TRADE_DEFINITIONS = {
    'sofer': [
        'SOFER', 'ȘOFER', 'CONDUCĂTOR AUTO', 'CONDUCATOR AUTO', 'CAMION', 
        'SOFER TIR', 'ȘOFER TIR', 'SOFER DISTRIBUTIE', 'PERMIS CATEGORIA'
    ],
    'mecanic': [
        'MECANIC', 'MECANIC AUTO', 'MECANIC UTILAJ', 'MECANIC AGRICOL', 
        'ELECTROMECANIC', 'MECATRONIST', 'DIAGNOSTICIAN AUTO', 'TEHNICIAN MECANIC'
    ],
    'vanzator': [
        'VÂNZATOR', 'VANZATOR', 'LUCRATOR COMERCIAL', 'LUCRĂTOR COMERCIAL', 
        'CASIER', 'MAGAZIN', 'VÂNZARI', 'VANZARI', 'CONSILIER VANZARI'
    ],
    'bucatar': [
        'BUCATAR', 'BUCĂTAR', 'BUCATARIE', 'AJUTOR BUCATAR', 'PREPARATE CULINARE'
    ],
    'manipulant': [
        'MANIPULANT', 'DEPOZIT', 'GESTIONAR', 'MAGAZIONER', 'PICKER', 
        'STIVUITORIST', 'LUCRATOR DEPOZIT', 'MUNCITOR DEPOZIT'
    ],
    'electrician': [
        'ELECTRICIAN', 'ELECTROMECANIC', 'AUTOMATIST', 'TABLOURI ELECTRICE', 
        'INSTALATII ELECTRICE'
    ],
    'curatenie': [
        'CURATENIE', 'CURĂȚENIE', 'FEMEIE DE SERVICIU', 'SPALATOR', 'MENAJERA', 
        'INGRIJITOR', 'CAMERISTA', 'INGRIJITOR CLADIRI'
    ],
    'paznic': [
        'AGENT DE SECURITATE', 'AGENT SECURITATE', 'PAZA', 'PAZNIC', 
        'SUPRAVEGHERE OBIECTIVE', 'AGENT PAZA'
    ],
    'sudor': [
        'SUDOR', 'SUDURĂ', 'SUDURA', 'MIG-MAG', 'MIG/MAG', 'TIG', 'WIG', 'AUTOGEN'
    ],
    'zidar': [
        'ZIDAR', 'ZUGRAV', 'FINISOR', 'FAIANTA', 'GRESIE', 'PARCHET', 'TENCUITOR', 'GLETUIRE'
    ],
    'stivuitorist': [
        'STIVUITORIST', 'MOTOSTIVUITORIST', 'IFRONIST', 'ISCIR'
    ],
    'tamplar': [
        'TAMPLAR', 'TÂMPLAR', 'DULGHER', 'MOBILIER', 'PRELUCRAREA LEMNULUI'
    ],
    'operator-cnc': [
        'CNC', 'COMANDĂ NUMERICĂ', 'COMANDA NUMERICA', 'FREZOR', 'STRUNGAR'
    ],
    'lacatus': [
        'LACATUS', 'LĂCĂTUȘ', 'CONFECTII METALICE', 'LACATUSERIE'
    ],
    'croitor': [
        'CROITOR', 'CONFECTIONER', 'CONFECȚIONER', 'CROITORIE', 'CONFECTII', 
        'CUSATOR', 'CUSĂTOR', 'TEXTILE'
    ],
    'ospatar': [
        'OSPATAR', 'OSPĂTAR', 'CHELNER', 'BARMAN'
    ],
    'curier': [
        'CURIER', 'LIVRATOR', 'POSTAS'
    ],
    'asistent-medical': [
        'ASISTENT MEDICAL', 'INFIRMIER', 'INGRIJITOR BOLNAVI', 'FARMACIST'
    ],
    'contabil': [
        'CONTABIL', 'ECONOMIST', 'AUDITOR', 'FINANCIAR'
    ],
    'inginer': [
        'INGINER', 'PROIECTANT', 'DIRIGINTE DE SANTIER'
    ]
};

function normalizeText(str) {
    if (!str) return '';
    return String(str)
        .replace(/ș/g, 's').replace(/Ș/g, 'S')
        .replace(/ț/g, 't').replace(/Ț/g, 'T')
        .replace(/ă/g, 'a').replace(/Ă/g, 'A')
        .replace(/â/g, 'a').replace(/Â/g, 'A')
        .replace(/î/g, 'i').replace(/Î/g, 'I')
        .toUpperCase();
}

// Pre-compiled regex patterns for matching
const compiledTrades = Object.entries(TRADE_DEFINITIONS).map(([slug, keywords]) => {
    const normalizedKeywords = keywords.map(k => normalizeText(k));
    return { slug, keywords: normalizedKeywords };
});

const compiledCounties = Object.entries(COUNTY_MAP).map(([slug, tokens]) => {
    const normalizedTokens = tokens.map(t => normalizeText(t));
    return { slug, tokens: normalizedTokens };
});

async function fetchActiveJobs() {
    console.log('🔄 Descarcare anunturi active din Supabase...');
    const allJobs = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const to = from + batchSize - 1;
        const url = `${SUPABASE_URL}/rest/v1/jobs?select=occupation,description,address_locality_name&open_positions=gt.0`;
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Range': `${from}-${to}`
            }
        });

        if (!res.ok) {
            throw new Error(`Eroare Supabase HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            allJobs.push(...data);
            process.stdout.write(`   ...descarcate ${allJobs.length} joburi\r`);
            if (data.length < batchSize) {
                hasMore = false;
            } else {
                from += batchSize;
            }
        } else {
            hasMore = false;
        }
    }

    console.log(`\n✅ Total descarcat: ${allJobs.length} joburi active.`);
    return allJobs;
}

function resolveCounty(locString) {
    if (!locString) return null;
    const normLoc = normalizeText(locString);
    for (const c of compiledCounties) {
        for (const token of c.tokens) {
            if (normLoc.includes(token)) {
                return c.slug;
            }
        }
    }
    return null;
}

function resolveTrades(occString, descString) {
    const combined = `${normalizeText(occString)} ${normalizeText(descString ? descString.slice(0, 300) : '')}`;
    const matched = [];
    for (const t of compiledTrades) {
        for (const kw of t.keywords) {
            if (combined.includes(kw)) {
                matched.push(t.slug);
                break;
            }
        }
    }
    return matched;
}

async function run() {
    const startTime = Date.now();
    const jobs = await fetchActiveJobs();

    const byTradeSets = {};
    const byCountySets = {};

    Object.keys(TRADE_DEFINITIONS).forEach(t => { byTradeSets[t] = new Set(); });
    Object.keys(COUNTY_MAP).forEach(c => { byCountySets[c] = new Set(); });

    let mappedCount = 0;

    for (const job of jobs) {
        const countySlug = resolveCounty(job.address_locality_name);
        if (!countySlug) continue;

        const trades = resolveTrades(job.occupation, job.description);
        if (trades.length === 0) continue;

        mappedCount++;
        for (const tradeSlug of trades) {
            byTradeSets[tradeSlug].add(countySlug);
            byCountySets[countySlug].add(tradeSlug);
        }
    }

    const byTrade = {};
    for (const [trade, countiesSet] of Object.entries(byTradeSets)) {
        byTrade[trade] = Array.from(countiesSet).sort();
    }

    const byCounty = {};
    for (const [county, tradesSet] of Object.entries(byCountySets)) {
        byCounty[county] = Array.from(tradesSet).sort();
    }

    const payload = {
        updatedAt: new Date().toISOString(),
        totalActiveJobsScanned: jobs.length,
        totalJobsMapped: mappedCount,
        byTrade,
        byCounty
    };

    const outPath = path.join(DATA_DIR, 'combination_map.json');
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Matrice salvata cu succes in: ${outPath}`);
    console.log(`📊 Statistici: ${mappedCount}/${jobs.length} joburi mapate in ${durationSec} secunde.`);
    console.log(`   Meserii active acoperite: ${Object.keys(byTrade).filter(t => byTrade[t].length > 0).length}`);
    console.log(`   Judete cu joburi mapate: ${Object.keys(byCounty).filter(c => byCounty[c].length > 0).length}`);
}

run().catch(err => {
    console.error('❌ Eroare generare matrice combinatii:', err);
    process.exit(1);
});
