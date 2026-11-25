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

const BAROMETER_CONFIG = {
    'sofer': { label: 'Șofer', type: 'transport', needleAngle: 15, realExpMin: 3800, realExpMax: 5500 },
    'mecanic': { label: 'Mecanic', type: 'skilled', needleAngle: 25, realExpMin: 3200, realExpMax: 4000 },
    'vanzator': { label: 'Vânzător', type: 'minimum_wage', needleAngle: -45, realExpMin: 3200, realExpMax: 3800 },
    'bucatar': { label: 'Bucătar', type: 'horeca', needleAngle: 20, realExpMin: 4200, realExpMax: 6500 },
    'manipulant': { label: 'Manipulant marfă', type: 'minimum_wage', needleAngle: -40, realExpMin: 3300, realExpMax: 4000 },
    'electrician': { label: 'Electrician', type: 'skilled', needleAngle: 30, realExpMin: 3500, realExpMax: 4500 },
    'curatenie': { label: 'Curățenie / Menaj', type: 'minimum_wage', needleAngle: -50, realExpMin: 3200, realExpMax: 3700 },
    'paznic': { label: 'Paznic / Securitate', type: 'minimum_wage', needleAngle: -45, realExpMin: 3200, realExpMax: 3700 },
    'sudor': { label: 'Sudor', type: 'skilled', needleAngle: 25, realExpMin: 3400, realExpMax: 4250 },
    'zidar': { label: 'Zidar / Constructor', type: 'construction', needleAngle: -10, realExpMin: 4200, realExpMax: 6000 },
    'stivuitorist': { label: 'Stivuitorist', type: 'skilled', needleAngle: 15, realExpMin: 3400, realExpMax: 4250 },
    'tamplar': { label: 'Tâmplar', type: 'construction', needleAngle: -5, realExpMin: 3500, realExpMax: 4200 },
    'operator-cnc': { label: 'Operator CNC', type: 'skilled', needleAngle: 20, realExpMin: 3200, realExpMax: 4150 },
    'lacatus': { label: 'Lăcătuș mecanic', type: 'construction', needleAngle: -10, realExpMin: 3500, realExpMax: 4200 },
    'croitor': { label: 'Croitor / Confecționer', type: 'minimum_wage', needleAngle: -45, realExpMin: 3200, realExpMax: 3600 },
    'ospatar': { label: 'Ospătar / Chelner', type: 'horeca', needleAngle: 15, realExpMin: 4000, realExpMax: 6500 },
    'curier': { label: 'Curier / Livrator', type: 'curier', needleAngle: 15, realExpMin: 4200, realExpMax: 6000 },
    'asistent-medical': { label: 'Asistent medical', type: 'skilled', needleAngle: 20, realExpMin: 3450, realExpMax: 4050 },
    'contabil': { label: 'Contabil / Financiar', type: 'skilled', needleAngle: 45, realExpMin: 3700, realExpMax: 5550 },
    'inginer': { label: 'Inginer', type: 'skilled', needleAngle: 55, realExpMin: 4000, realExpMax: 5750 }
};

function roundTo50(val) {
    return (!val || isNaN(val)) ? 0 : Math.round(val / 50) * 50;
}

function normalizeSalaryToNet(minSalary, salaryType, isConstruction = false) {
    const num = Number(minSalary);
    if (!num || isNaN(num) || num < 1500 || num > 40000) return null;
    if (String(salaryType || '').toLowerCase().trim() === 'gross') {
        if (isConstruction || num === 4582) {
            return Math.max(3150, roundTo50(num - Math.round(num * 0.2125) - Math.round(num * 0.10)));
        }
        const brutTaxabil = Math.max(0, num - 300);
        const cas = Math.round(brutTaxabil * 0.25);
        const cass = Math.round(brutTaxabil * 0.10);
        const deducere = num <= 4600 ? 450 : 0;
        const impozit = Math.round(Math.max(0, brutTaxabil - cas - cass - deducere) * 0.10);
        return Math.max(2700, roundTo50(num - cas - cass - impozit));
    }
    return Math.max(isConstruction ? 3150 : 2700, roundTo50(num));
}

async function fetchActiveJobs() {
    console.log('🔄 Descarcare anunturi active din Supabase...');
    const allJobs = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const to = from + batchSize - 1;
        const url = `${SUPABASE_URL}/rest/v1/jobs?select=occupation,description,address_locality_name,minimum_salary,salary_type&open_positions=gt.0`;
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
    const counts = {};
    const tradeCounts = {};
    const countyCounts = {};
    const tradeSalaries = {};

    Object.keys(TRADE_DEFINITIONS).forEach(t => {
        byTradeSets[t] = new Set();
        tradeSalaries[t] = [];
    });
    Object.keys(COUNTY_MAP).forEach(c => { byCountySets[c] = new Set(); });

    let mappedCount = 0;
    let analyzedSalaryJobs = 0;

    for (const job of jobs) {
        const countySlug = resolveCounty(job.address_locality_name);
        if (countySlug) {
            countyCounts[countySlug] = (countyCounts[countySlug] || 0) + 1;
        }

        const hasSalary = Number(job.minimum_salary || 0) > 0;
        if (hasSalary) analyzedSalaryJobs++;

        const trades = resolveTrades(job.occupation, job.description);
        for (const tradeSlug of trades) {
            tradeCounts[tradeSlug] = (tradeCounts[tradeSlug] || 0) + 1;
            if (countySlug) {
                const key = `${tradeSlug}/${countySlug}`;
                counts[key] = (counts[key] || 0) + 1;
            }
            if (hasSalary) {
                const cfg = BAROMETER_CONFIG[tradeSlug];
                const net = normalizeSalaryToNet(job.minimum_salary, job.salary_type, cfg?.type === 'construction');
                if (net && net >= 2300) tradeSalaries[tradeSlug].push(net);
            }
        }

        if (!countySlug || trades.length === 0) continue;

        mappedCount++;
        for (const tradeSlug of trades) {
            byTradeSets[tradeSlug].add(countySlug);
            byCountySets[countySlug].add(tradeSlug);
        }
    }

    const byTrade = {};
    for (const [trade, countiesSet] of Object.entries(byTradeSets)) {
        byTrade[trade] = Array.from(countiesSet).sort((a, b) => (counts[`${trade}/${b}`] || 0) - (counts[`${trade}/${a}`] || 0));
    }

    const byCounty = {};
    for (const [county, tradesSet] of Object.entries(byCountySets)) {
        byCounty[county] = Array.from(tradesSet).sort((a, b) => (counts[`${b}/${county}`] || 0) - (counts[`${a}/${county}`] || 0));
    }

    const payload = {
        updatedAt: new Date().toISOString(),
        totalActiveJobsScanned: jobs.length,
        totalJobsMapped: mappedCount,
        byTrade,
        byCounty,
        counts,
        tradeCounts,
        countyCounts
    };

    const outPath = path.join(DATA_DIR, 'combination_map.json');
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');

    const barometerTrades = {};
    const getP = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];
    for (const [tradeSlug, cfg] of Object.entries(BAROMETER_CONFIG)) {
        const salaries = (tradeSalaries[tradeSlug] || []).slice().sort((a, b) => a - b);
        const sampleSize = salaries.length;
        const isConst = cfg.type === 'construction';
        const minLegal = isConst ? 3150 : 2700;
        const grossLegal = isConst ? 4582 : 4350;

        let p25 = minLegal, median = roundTo50(minLegal * 1.15), p75 = roundTo50(minLegal * 1.35), hasSufficientData = false;
        if (sampleSize >= 3) {
            hasSufficientData = true;
            p25 = Math.max(minLegal, roundTo50(getP(salaries, 0.25)));
            median = Math.max(p25, roundTo50(getP(salaries, 0.50)));
            p75 = Math.max(median, roundTo50(getP(salaries, 0.75)));
        }

        const isClustered = (p75 - p25 <= 100);
        const entryMin = p25;
        const entryRange = `~${entryMin.toLocaleString('ro-RO')} – ${roundTo50(p25 + 500).toLocaleString('ro-RO')} lei`;
        const expMin = cfg.realExpMin || roundTo50((isClustered ? p25 : median) + (isClustered ? 500 : 350));
        const expMax = cfg.realExpMax || roundTo50((isClustered ? p25 : p75) + (isClustered ? 1000 : 750));
        const experiencedRange = `~${expMin.toLocaleString('ro-RO')} – ${expMax.toLocaleString('ro-RO')} lei`;
        const startingNet = Math.max(minLegal, entryMin || minLegal);
        const headlineSalary = `de la ~${startingNet.toLocaleString('ro-RO')} lei net`;

        let p1 = '', p2 = '', p3 = '';
        if (cfg.type === 'minimum_wage') {
            p1 = `Cel mai des întâlnit salariu din contracte este <strong>Salariul Minim pe economie</strong>:<br>• Aprox. <strong>${grossLegal.toLocaleString('ro-RO')} RON Brut</strong> (înainte de taxare)<br>• Aprox. <strong>~${minLegal.toLocaleString('ro-RO')} RON NET</strong> (după taxare, în mână)`;
            p2 = `La care uneori se mai pot adăuga și bonuri de masă, în cazul în care compania oferă așa ceva.`;
            p3 = `Deci un salariu orientativ de pornire pentru un <strong>${cfg.label}</strong> fără experiență ar începe de la <strong>~${minLegal.toLocaleString('ro-RO')} lei net</strong>, iar în funcție de beneficiile pe care compania le oferă (bonuri de masă, sporuri de tură sau vechime), venitul total net ar putea crește spre <strong>${experiencedRange}</strong>, uneori poate chiar depăși această sumă în unele companii.`;
        } else if (cfg.type === 'construction') {
            p1 = `În sectorul construcțiilor, baza minimă garantată prin lege este reglementată separat:<br>• Aprox. <strong>${grossLegal.toLocaleString('ro-RO')} RON Brut</strong> (înainte de taxare)<br>• Aprox. <strong>~${minLegal.toLocaleString('ro-RO')} RON NET</strong> (după taxare, beneficiind de facilitățile fiscale specifice domeniului)`;
            p2 = `La această bază se pot adăuga tichete de masă sau sporuri pentru ore suplimentare, în funcție de politica fiecărei firme sau a șantierului.`;
            p3 = `Pentru meseriași cu experiență (finisaje interioare, fațade sau echipe de șantier), venitul net este de regulă între <strong>${experiencedRange}</strong>, iar uneori poate chiar depăși această sumă în unele companii sau la lucrări complexe.`;
        } else if (cfg.type === 'transport') {
            p1 = `Pe distribuție locală sau la debut, salariul fix din contract pornește de la <strong>~${minLegal.toLocaleString('ro-RO')} lei net</strong> (la care se pot adăuga tichete de masă unde se oferă).`;
            p2 = `Pe distribuție națională grea (C+E) sau curse lungi în țară, venitul ajunge de regulă la <strong>${experiencedRange} net</strong>.`;
            p3 = `Pe curse externe pe comunitate (UE), venitul net este compus din salariul de bază plus diurna zilnică neimpozabilă (75–95 €/zi), ajungând de regulă la <strong>~2.400 – 3.000 € net pe lună</strong>, iar uneori poate chiar depăși această sumă în unele companii de transport internațional.`;
        } else if (cfg.type === 'horeca') {
            p1 = `Salariul fix din contractele oficiale este de regulă salariul minim garantat: aprox. <strong>4.350 RON Brut</strong> → aprox. <strong>~${minLegal.toLocaleString('ro-RO')} RON NET</strong> (la care se pot adăuga tichete de masă dacă sunt oferite).`;
            p2 = `În restaurante și evenimente, o componentă esențială a câștigurilor este reprezentată de bacșiș (tips) și cota-parte din vânzări.`;
            p3 = `Pentru personal calificat pe locații cu vad bun, terase sau evenimente à la carte, venitul total net ajunge de regulă la <strong>${experiencedRange}</strong>, iar uneori poate chiar depăși această sumă în sezon sau în locații aglomerate.`;
        } else if (cfg.type === 'curier') {
            p1 = `Salariul fix de pornire din contract este de regulă de la <strong>~${minLegal.toLocaleString('ro-RO')} lei net</strong> (cu tichete de masă unde se acordă).`;
            p2 = `În marile rețele de curierat, venitul include bonusuri per colet livrat (1–3 lei/colet) și bacșișul de la clienți.`;
            p3 = `Pentru curieri cu experiență pe flote mari și zone centrale, venitul total net ajunge de regulă la <strong>${experiencedRange}</strong>, iar uneori poate chiar depăși această sumă în perioadele aglomerate din an.`;
        } else {
            p1 = `În ofertele din piață, salariile de pornire pentru debutanți încep de regulă de la <strong>${entryRange}</strong> pe contract.`;
            p2 = `La care se pot adăuga tichete de masă, bonusuri de performanță sau sporuri de tură/noapte, în funcție de companie.`;
            p3 = `Pentru specialiști cu experiență sau autorizații recunoscute, mediana pieței ajunge la <strong>~${median.toLocaleString('ro-RO')} lei net</strong>, iar uneori poate chiar depăși <strong>~${p75.toLocaleString('ro-RO')} lei net</strong> în unele companii mari sau industriale.`;
        }

        barometerTrades[tradeSlug] = {
            tradeSlug, label: cfg.label, sampleSize, hasSufficientData,
            categoryType: cfg.type, needleAngle: cfg.needleAngle, headlineSalary, startingNet,
            minLegalNet: minLegal, grossLegal, p25, median, p75, entryRange, experiencedRange,
            narrative: { p1, p2, p3 }
        };
    }

    const barometerPath = path.join(DATA_DIR, 'trade_barometer.json');
    fs.writeFileSync(barometerPath, JSON.stringify({
        updatedAt: new Date().toISOString(),
        analyzedJobs: analyzedSalaryJobs,
        source: 'euzmj_scraper',
        trades: barometerTrades
    }, null, 2), 'utf-8');

    await Promise.all([
        fetch('https://purge.jsdelivr.net/gh/zmd2508/euzmj262508@main/data/combination_map.json').catch(() => {}),
        fetch('https://purge.jsdelivr.net/gh/zmd2508/euzmj262508@main/data/trade_barometer.json').catch(() => {})
    ]);

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Matrice + Barometru salvate cu succes in: ${outPath} & ${barometerPath}`);
    console.log(`📊 Statistici: ${mappedCount}/${jobs.length} joburi mapate (${Object.keys(counts).length} perechi active, ${analyzedSalaryJobs} oferte cu salariu) in ${durationSec} secunde.`);
    console.log(`   Meserii active acoperite: ${Object.keys(byTrade).filter(t => byTrade[t].length > 0).length}`);
    console.log(`   Judete cu joburi mapate: ${Object.keys(byCounty).filter(c => byCounty[c].length > 0).length}`);
}

run().catch(err => {
    console.error('❌ Eroare generare matrice combinatii:', err);
    process.exit(1);
});
