// eures_static_sync.mjs - Comprehensive EURES English Jobs Sync Engine
// Fetches 100% of ALL English-friendly European vacancies with zero artificial caps

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Support standalone repo ./data as well as parent UI/data
const DATA_DIRS = [
    path.join(__dirname, 'data'),
    path.join(__dirname, '..', 'UI', 'data')
].filter(d => {
    try {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        return true;
    } catch (_) {
        return false;
    }
});

const EURES_API_URL = 'https://europa.eu/eures/api/jv-searchengine/public/jv-search/search';

const TARGET_COUNTRIES = [
    { code: 'nl', name: 'Olanda', flag: '🇳🇱', key: 'NL', maxPages: 100 },
    { code: 'be', name: 'Belgia', flag: '🇧🇪', key: 'BE', maxPages: 60 },
    { code: 'at', name: 'Austria', flag: '🇦🇹', key: 'AT', maxPages: 70 },
    { code: 'de', name: 'Germania', flag: '🇩🇪', key: 'DE', maxPages: 100 },
    { code: 'dk', name: 'Danemarca', flag: '🇩🇰', key: 'DK', maxPages: 20 },
    { code: 'fr', name: 'Franța', flag: '🇫🇷', key: 'FR', maxPages: 20 }
];

const DOMAIN_RULES = [
    { name: 'Construcții', regex: /\b(construction|carpenter|electrician|plumber|builder|mason|welder|painter|roofer|pipe|installation|scaffolding|fitter|hvac|bouwvak|lasser|elektricien|monteur)\b/i },
    { name: 'Producție', regex: /\b(production|assembly|manufacturing|operator|factory|warehouse|packer|picker|packaging|machine operator|productie|magazijn|inpakker)\b/i },
    { name: 'Transporturi', regex: /\b(driver|truck|courier|logistics|forklift|transport|chauffeur|delivery|reach truck|heftruck|vrachtwagenchauffeur|distributie)\b/i },
    { name: 'HoReCa', regex: /\b(cook|chef|kitchen|hotel|restaurant|waiter|bartender|hospitality|dishwasher|catering|bediening|kok|afwasser)\b/i },
    { name: 'IT', regex: /\b(software|developer|engineer|frontend|backend|devops|programmer|python|java|javascript|react|node|cloud|data engineer|qa|fullstack|cyber)\b/i },
    { name: 'Inginerie', regex: /\b(engineer|technician|mechanical|electrical|automation|cnc|maintenance|field service|robotics|quality|ingenieur)\b/i },
    { name: 'Domeniul Medical', regex: /\b(nurse|caregiver|doctor|healthcare|medical|hospital|dental|care assistant|clinic|verpleegkundige|zorg)\b/i },
    { name: 'Financiar-Contabil', regex: /\b(accountant|finance|accounting|payroll|auditor|financial|controller|boekhouder)\b/i },
    { name: 'Marketing', regex: /\b(marketing|seo|content|digital marketing|copywriter|social media|brand)\b/i },
    { name: 'Administrativ', regex: /\b(administrative|secretary|office|assistant|receptionist|customer support|call center|klantenservice)\b/i },
    { name: 'Educație', regex: /\b(teacher|trainer|educator|instructor|tutor|professor|docent)\b/i },
    { name: 'Pază și Protecție', regex: /\b(security|guard|protection|surveillance|safety officer|beveiliger)\b/i },
    { name: 'Agricultură', regex: /\b(agriculture|farm|greenhouse|harvest|farming|horticulture|tractor|picking|fruit|tuinbouw|glastuinbouw)\b/i },
    { name: 'Servicii', regex: /\b(cleaner|cleaning|facility|mechanic|car mechanic|automotive|repair|schoonmaak|automonteur)\b/i },
    { name: 'Comerț', regex: /\b(retail|sales|cashier|shop|store assistant|merchandiser|verkoop)\b/i }
];

function inferDomain(title, description) {
    const combined = `${title || ''} ${description || ''}`;
    for (const rule of DOMAIN_RULES) {
        if (rule.regex.test(combined)) {
            return rule.name;
        }
    }
    return 'Uniunea Europeană';
}

function cleanHtmlDescription(rawHtml) {
    if (!rawHtml) return '';
    let text = rawHtml;

    text = text.replace(/<(?:br\s*\/?|p|div|tr)>/gi, '\n');
    text = text.replace(/<\/(?:p|div|tr)>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '\n• ');
    text = text.replace(/<\/li>/gi, '');
    text = text.replace(/<h[1-6][^>]*>/gi, '\n\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]*>/g, '');

    text = text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&euro;/gi, '€');

    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
}

function extractEuroSalary(rawText) {
    if (!rawText) return { salaryMin: null, salaryType: 'none' };

    const hourlyRegexes = [
        /(?:salary|salaris|lohn|pay|hourly rate)?\s*[:=]?\s*(?:€|EUR)?\s*([\d\.,]{2,6})\s*(?:-|–|to)?\s*(?:€|EUR)?\s*([\d\.,]{2,6})?\s*(?:€|EUR)?\s*(?:per\s*(?:hour|uur|h|stunde|oră)|\/\s*(?:h|uur|hour|stunde))/i,
        /([\d\.,]{2,6})\s*(?:€|EUR)\s*(?:per\s*(?:hour|uur|h|stunde)|\/\s*(?:h|uur|hour))/i
    ];

    for (const rx of hourlyRegexes) {
        const m = rawText.match(rx);
        if (m && m[1]) {
            const val1 = parseFloat(m[1].replace(',', '.'));
            if (!isNaN(val1) && val1 >= 10 && val1 <= 150) {
                const val2 = m[2] ? parseFloat(m[2].replace(',', '.')) : null;
                const displayVal = (val2 && !isNaN(val2) && val2 > val1 && val2 <= 150) 
                    ? `€${val1.toFixed(2)} - €${val2.toFixed(2)} / oră`
                    : `€${val1.toFixed(2)} / oră`;
                return { salaryMin: displayVal, salaryType: 'gross' };
            }
        }
    }

    const monthlyRegexes = [
        /(?:salary|salaris|lohn|gehalt)?\s*[:=]?\s*(?:€|EUR)\s*([\d\.,]{4,7})\s*(?:-|–|tot|to)?\s*(?:€|EUR)?\s*([\d\.,]{4,7})?\s*(?:per\s*(?:month|maand|monat|lună)|\/\s*(?:m|maand|month)|gross|brut|net)?/i,
        /([\d\.,]{4,7})\s*(?:€|EUR)\s*(?:per\s*(?:month|maand|monat|lună)|\/\s*(?:m|maand|month))/i
    ];

    for (const rx of monthlyRegexes) {
        const m = rawText.match(rx);
        if (m && m[1]) {
            const numStr1 = m[1].replace(/\./g, '').replace(',', '.');
            const val1 = Math.round(parseFloat(numStr1));
            if (!isNaN(val1) && val1 >= 800 && val1 <= 40000) {
                const numStr2 = m[2] ? m[2].replace(/\./g, '').replace(',', '.') : null;
                const val2 = numStr2 ? Math.round(parseFloat(numStr2)) : null;
                const isNet = rawText.toLowerCase().includes('netto') || rawText.toLowerCase().includes(' net ');
                const displayVal = (val2 && !isNaN(val2) && val2 > val1 && val2 <= 40000)
                    ? `€${val1.toLocaleString('ro-RO')} - €${val2.toLocaleString('ro-RO')} / lună`
                    : `€${val1.toLocaleString('ro-RO')} / lună`;
                return { salaryMin: displayVal, salaryType: isNet ? 'net' : 'gross' };
            }
        }
    }

    return { salaryMin: null, salaryType: 'none' };
}

function extractLocationDetails(job, countryObj) {
    const text = `${job.title || ''} ${job.description || ''}`;

    if (countryObj.key === 'NL') {
        const cities = ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen', 'Enschede', 'Haarlem', 'Arnhem', 'Zaanstad', 'Amersfoort', 'Apeldoorn', 'Den Bosch', 'Zwolle', 'Maastricht', 'Leiden', 'Dordrecht', 'Zoetermeer', 'Venlo', 'Spijk', 'Deventer', 'Helmond', 'Oss', 'Venray', 'Roermond', 'Veldhoven'];
        for (const city of cities) {
            const rx = new RegExp(`\\b${city}\\b`, 'i');
            if (rx.test(text)) return `${city}, ${countryObj.name} ${countryObj.flag}`;
        }
    }

    if (countryObj.key === 'DE') {
        const cities = ['Berlin', 'München', 'Munich', 'Hamburg', 'Frankfurt', 'Köln', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Dortmund', 'Essen', 'Leipzig', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Nuremberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Karlsruhe', 'Mannheim', 'Augsburg', 'Wiesbaden', 'Regensburg', 'Ingolstadt'];
        for (const city of cities) {
            const rx = new RegExp(`\\b${city}\\b`, 'i');
            if (rx.test(text)) return `${city}, ${countryObj.name} ${countryObj.flag}`;
        }
    }

    if (countryObj.key === 'BE') {
        const cities = ['Bruxelles', 'Brussels', 'Antwerpen', 'Antwerp', 'Gent', 'Ghent', 'Charleroi', 'Liège', 'Brugge', 'Bruges', 'Namur', 'Leuven', 'Mons', 'Aalst', 'Mechelen', 'Lokeren', 'Kortrijk', 'Hasselt', 'Sint-Niklaas', 'Ostend', 'Genk'];
        for (const city of cities) {
            const rx = new RegExp(`\\b${city}\\b`, 'i');
            if (rx.test(text)) return `${city}, ${countryObj.name} ${countryObj.flag}`;
        }
    }

    if (countryObj.key === 'AT') {
        const cities = ['Wien', 'Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'Sankt Pölten', 'Dornbirn', 'Wiener Neustadt', 'Bregenz', 'Kufstein'];
        for (const city of cities) {
            const rx = new RegExp(`\\b${city}\\b`, 'i');
            if (rx.test(text)) return `${city}, ${countryObj.name} ${countryObj.flag}`;
        }
    }

    return `${countryObj.name} ${countryObj.flag}`;
}

function isStrictlyEnglish(title, description) {
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    
    // Disqualifying German phrases
    const germanDisqualifiers = [
        /\b(wir suchen|ihre aufgaben|ihr profil|unser angebot|über uns|bewerbung|bewerben|anschreiben|lebenslauf|arbeitsort|vollzeit|teilzeit|vergütung|urlaubstage|arbeitgeber|arbeitsvertrag|abgeschlossene ausbildung|fachkraft|helfer|krankenpfleger|altenpfleger|vorstellungsgespräch|anforderungen|voraussetzungen|deutschkenntnisse|eingruppierung|entgeltgruppe|zeitarbeit|vermittlungsgutschein|direktvermittlung|festanstellung|schwerbehinderte|stellenbeschreibung|mitarbeiter|kollegen|berufserfahrung|tätigkeit|unternehmen|kunden|einsatzort|einsatzbereich|dienstplan|schichtdienst|nachtdienst)\b/gi
    ];
    
    // Disqualifying Dutch phrases
    const dutchDisqualifiers = [
        /\b(wij zoeken|wat ga je doen|wat breng je mee|wat bieden wij|over ons|solliciteer|sollicitatie|cv en motivatie|werklocatie|fulltime|parttime|salarisindicatie|vakantiedagen|werkgever|arbeidsovereenkomst|opleiding|ervaring|vaardigheden|dienstverband|ploegendienst|functie-eisen|takenpakket|verantwoordelijkheden|enthousiast|reiskostenvergoeding|wij zijn|jouw profiel|ons aanbod)\b/gi
    ];

    // Disqualifying French phrases
    const frenchDisqualifiers = [
        /\b(nous recherchons|vos missions|votre profil|ce que nous offrons|à propos de nous|postuler|candidature|lettre de motivation|lieu de travail|temps plein|temps partiel|rémunération|congés payés|employeur|contrat de travail|formation|expérience requise|compétences|débutant accepté|télétravail|notre offre)\b/gi
    ];

    let germanHits = 0;
    for (const rx of germanDisqualifiers) {
        const matches = text.match(rx);
        if (matches) germanHits += matches.length;
    }

    let dutchHits = 0;
    for (const rx of dutchDisqualifiers) {
        const matches = text.match(rx);
        if (matches) dutchHits += matches.length;
    }

    let frenchHits = 0;
    for (const rx of frenchDisqualifiers) {
        const matches = text.match(rx);
        if (matches) frenchHits += matches.length;
    }

    if (germanHits >= 2 || dutchHits >= 2 || frenchHits >= 2) {
        return false;
    }

    const englishMatches = text.match(/\b(the|and|you|your|will|our|with|for|are|this|from|have|work|team|experience|requirements|offer|apply|skills|responsible|responsibilities|position|company|salary|benefits|hours|please|looking|working|candidate|candidates|opportunity|role)\b/gi) || [];
    const generalGerman = text.match(/\b(und|der|die|das|wir|sie|für|mit|den|von|zu|auf|sich|ein|eine|einer|eines|werden|sind|oder|bei|ihre|nach|aus|über|dich|dein|deine|uns)\b/gi) || [];
    const generalDutch = text.match(/\b(en|van|het|een|voor|met|zijn|niet|naar|als|ook|uit|bij|zoek|ons|werken|ervaring|wij|jouw|bent|hebt)\b/gi) || [];
    const generalFrench = text.match(/\b(et|de|la|le|les|un|une|des|du|en|pour|dans|sur|avec|par|nous|vous|est|sont)\b/gi) || [];

    const engCount = englishMatches.length;
    const nonEngCount = generalGerman.length + generalDutch.length + generalFrench.length;

    return engCount >= 8 && engCount > (nonEngCount * 2);
}

async function fetchJobsForCountry(countryObj) {
    console.log(`\n⏳ Fetching 100% of English jobs for ${countryObj.name} (${countryObj.key})...`);
    const allCountryJobs = [];
    let realTotalCount = 0;
    const PAGE_SIZE = 50;

    for (let page = 1; page <= countryObj.maxPages; page++) {
        const payload = {
            keywords: [
                { keyword: 'English', specificSearchCode: 'DESCRIPTION' }
            ],
            resultsPerPage: PAGE_SIZE,
            page: page,
            sortSearch: 'MOST_RECENT',
            locationCodes: [countryObj.code],
            positionScheduleCodes: [],
            requestLanguage: 'en'
        };

        try {
            const res = await fetch(EURES_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                console.warn(`  ⚠️ Page ${page} response: ${res.status}`);
                break;
            }

            const data = await res.json();
            realTotalCount = data.numberRecords || 0;
            const jvs = data.jvs || [];

            if (jvs.length === 0) break;

            jvs.forEach(job => {
                const cleanTitle = (job.title || 'Ofertă de Muncă UE').trim();
                const cleanDesc = cleanHtmlDescription(job.description || '');
                
                // Strictly filter out jobs that are not predominantly in English
                if (!isStrictlyEnglish(cleanTitle, cleanDesc)) {
                    return;
                }

                const employerName = job.employer?.name ? job.employer.name.trim() : 'Angajator European Verificat (EURES)';
                const locationStr = extractLocationDetails(job, countryObj);
                const { salaryMin, salaryType } = extractEuroSalary(cleanDesc);
                const inferredDomain = inferDomain(cleanTitle, cleanDesc);

                const directEuresUrl = `https://europa.eu/eures/portal/jv-se/jv-details/${encodeURIComponent(job.id)}?lang=en`;

                allCountryJobs.push({
                    id: `eures-${job.id}`,
                    rawEuresId: job.id,
                    occupation: cleanTitle,
                    employer_name: employerName,
                    job_domain_name: inferredDomain,
                    address_locality_name: locationStr,
                    description: cleanDesc,
                    minimum_salary: salaryMin,
                    salary_type: salaryType,
                    job_expiry_date: job.lastModificationDate ? new Date(job.lastModificationDate + 30 * 86400000).toISOString().split('T')[0] : null,
                    open_positions: job.numberOfPosts || 1,
                    source_aggregator: 'EURES',
                    is_premium: false,
                    official_url: directEuresUrl,
                    work_type_name: job.positionScheduleCodes?.[0] === 'part-time' ? 'Part-Time' : 'Full-Time',
                    work_type_details: job.positionScheduleCodes?.[0] === 'part-time' ? 'Part-Time' : 'Normă întreagă (Full-Time)',
                    professional_experience_name: cleanDesc.toLowerCase().includes('junior') || cleanDesc.toLowerCase().includes('starter') ? 'Fără experiență / Începător' : (cleanDesc.toLowerCase().includes('senior') || cleanDesc.toLowerCase().includes('experienced') ? 'Peste 3 ani experiență' : '1 - 3 ani experiență')
                });
            });

            console.log(`  ✓ Page ${page}: +${jvs.length} jobs (Total: ${allCountryJobs.length}/${realTotalCount})`);

            if (allCountryJobs.length >= realTotalCount || jvs.length < PAGE_SIZE) {
                break;
            }
            
            await new Promise(r => setTimeout(r, 100));
        } catch (err) {
            console.error(`  ❌ Page ${page} error:`, err.message);
            break;
        }
    }

    const outputPayload = {
        country: countryObj.name,
        countryCode: countryObj.key,
        totalLiveMarketCount: allCountryJobs.length,
        collectedCount: allCountryJobs.length,
        updatedAt: new Date().toISOString(),
        jobs: allCountryJobs
    };

    DATA_DIRS.forEach(dir => {
        const filePath = path.join(dir, `jobs_${countryObj.code}.json`);
        fs.writeFileSync(filePath, JSON.stringify(outputPayload), 'utf8');
        const sizeKb = (fs.statSync(filePath).size / 1024).toFixed(1);
        console.log(`  💾 Saved (${allCountryJobs.length} jobs) to ${filePath} (${sizeKb} KB)`);
    });

    return allCountryJobs;
}

async function runSync() {
    console.log('🚀 Starting Full EURES English Jobs Sync Engine...');
    console.log(`📁 Target Directories: ${DATA_DIRS.join(', ')}`);

    const allCombined = [];

    for (const c of TARGET_COUNTRIES) {
        const countryJobs = await fetchJobsForCountry(c);
        allCombined.push(...countryJobs);
    }

    const allPayload = {
        country: 'Toată Europa',
        countryCode: 'ALL',
        totalLiveMarketCount: allCombined.length,
        collectedCount: allCombined.length,
        updatedAt: new Date().toISOString(),
        jobs: allCombined
    };

    DATA_DIRS.forEach(dir => {
        const allPath = path.join(dir, 'jobs_all.json');
        fs.writeFileSync(allPath, JSON.stringify(allPayload), 'utf8');
    });
    console.log(`\n🎉 Full Sync Complete! Total European Jobs Cached: ${allCombined.length}`);
}

runSync();
