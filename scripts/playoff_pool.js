// 1. CONFIGURATION & STATE
const PLAYOFF_TEAMS = ['CAR','PIT','PHI','BUF','MTL','TBL','BOS','OTT','COL','DAL','MIN','VEG','EDM','ANA','UTA','LAK'];

const skaterStatIdMap = {
    0: 'GP', 1: 'G', 2: 'A', 3: 'PTS', 4: 'PlusMinus', 5: 'PIM',
    14: 'SOG', 31: 'HIT', 32: 'BLK', 34: 'ATOI'
};
const goalieStatIdMap = {
    0: 'GP', 18: 'GS', 19: 'W', 20: 'L', 22: 'GA', 23: 'GAA',
    24: 'SA', 25: 'SV', 26: 'SV%', 27: 'SHO'
};

let allPlayers = [], skaterStatsMap = {}, goalieStatsMap = {}, teamMap = {};
let currentSortKey = "FPG", sortDirection = -1, statsMap = {};

// Initial state object
let myEntry = { 
    managerName: "",
    roster: { F: [], D: [], G: [] }, 
    bracket: {}, 
    cupWinner: "" 
};

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    fetch('/fantasy-hockey/shared/header.html').then(res => res.text()).then(html => {
        const header = document.querySelector('.site-header');
        if (header) header.innerHTML = html;
    });

    await initData();
    await loadExistingEntry();

    const posFilter = document.getElementById('pos-filter');
    const nameFilter = document.getElementById('name-filter');

    if (posFilter) posFilter.addEventListener('change', renderTable);
    if (nameFilter) nameFilter.addEventListener('input', renderTable);
});

async function initData() {
    try {
        const [playersRes, teamsRes, skaterRes, goalieRes] = await Promise.all([
            fetch('/fantasy-hockey/data/players.json').then(res => res.json()),
            fetch('/fantasy-hockey/teams/nhl_teams.json').then(res => res.json()),
            fetch('/fantasy-hockey/data/2026_skater_stats.json').then(res => res.json()),
            fetch('/fantasy-hockey/data/2026_goalie_stats.json').then(res => res.json())
        ]);

        teamMap = Object.fromEntries(teamsRes.map(t => [t.team_abbreviation, t.logo_url]));
        skaterStatsMap = buildStatsMap(skaterRes.players, "skater");
        goalieStatsMap = buildStatsMap(goalieRes.players, "goalie");

        calculateFantasyPoints(skaterStatsMap, playersRes.players, "skater");
        calculateFantasyPoints(goalieStatsMap, playersRes.players, "goalie");

        allPlayers = playersRes.players.filter(p => PLAYOFF_TEAMS.includes(p.team_abbr));

        renderTable();
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

// 3. STATS LOGIC
function buildStatsMap(statsArray, type) {
    const map = {};
    const idMap = (type === "goalie") ? goalieStatIdMap : skaterStatIdMap;
    statsArray.forEach(stat => {
        const id = stat.player_key.split('.').pop();
        const obj = {};
        stat.stats.forEach(s => {
            const statId = s._extracted_data?.stat_id ?? s.stat_id;
            const key = idMap[statId];
            let value = s._extracted_data?.value ?? s.value;

            if (value === '-' || value === '–' || value === undefined || value === null) value = 0;

            if (key) {
                if (key === 'ATOI') {
                    obj[key] = value;
                } else {
                    obj[key] = parseFloat(value) || 0;
                }
            }
        });
        map[id] = obj;
    });
    return map;
}

function calculateFantasyPoints(map, players, type) {
    players.forEach(p => {
        const s = map[p.player_id];
        if (!s) return;
        const gp = parseFloat(s.GP) || 0;
        let fp = 0;
        if (type === "goalie") {
            fp = ((parseFloat(s.GS)||0)*1) + ((parseFloat(s.W)||0)*3) + ((parseFloat(s.L)||0)*-1) + ((parseFloat(s.SV)||0)*0.2) + ((parseFloat(s.GA)||0)*-1) + ((parseFloat(s.SHO)||0)*5);
        } else {
            fp = ((parseFloat(s.G)||0)*3) + ((parseFloat(s.A)||0)*2) + ((parseFloat(s.PIM)||0)*0.2) + ((parseFloat(s.SHG)||0)*2) + ((parseFloat(s.GWG)||0)*0.5) + ((parseFloat(s.SOG)||0)*0.2) + ((parseFloat(s.HIT)||0)*0.1) + ((parseFloat(s.BLK)||0)*0.3);
        }
        s.FP = fp.toFixed(1); 
        s.FPG = gp > 0 ? (fp / gp).toFixed(2) : "0.00";
    });
}

// 4. SORTING ENGINE
function bindHeaderSortEvents() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.getAttribute('data-sort');
            sortBy(key);
        });
    });
}

function sortBy(key) {
    if (currentSortKey === key) {
        sortDirection *= -1;
    } else {
        sortDirection = -1;
        currentSortKey = key;
    }
    allPlayers.sort((a, b) => {
        const aS = (a.position === 'G' ? goalieStatsMap[a.player_id] : skaterStatsMap[a.player_id]) || {};
        const bS = (b.position === 'G' ? goalieStatsMap[b.player_id] : skaterStatsMap[b.player_id]) || {};
        let aVal = parseFloat(aS[currentSortKey]) || 0;
        let bVal = parseFloat(bS[currentSortKey]) || 0;
        return (aVal - bVal) * sortDirection;
    });
    renderTable();
}

function atoiToSeconds(timeStr) {
    if (typeof timeStr !== 'string') return 0;
    const [min, sec] = timeStr.split(':').map(Number);
    return (min || 0) * 60 + (sec || 0);
}

// 5. RENDERING
function renderTable() {
    const posEl = document.getElementById('pos-filter');
    const nameEl = document.getElementById('name-filter');
    const tbody = document.getElementById('players-body');
    const thead = document.getElementById('players-head');

    if (!tbody || !thead || !posEl) return;

    const posFilter = posEl.value;
    const nameFilter = (nameEl ? nameEl.value.toLowerCase() : "");
    const isG = posFilter === 'G';
    const minGP = 20;

    statsMap = isG ? goalieStatsMap : skaterStatsMap;

    thead.innerHTML = `
        <tr>
            <th>Action</th>
            <th style="text-align: left;">Player</th>
            <th>Pos</th>
            <th data-sort="GP">GP</th>
            ${isG ? `
                <th data-sort="W">W</th><th data-sort="L">L</th><th data-sort="GAA">GAA</th>
                <th data-sort="SV%">SV%</th><th data-sort="SHO">SO</th>
            ` : `
                <th data-sort="G">G</th><th data-sort="A">A</th><th data-sort="PTS">PTS</th>
                <th data-sort="PIM">PIM</th><th data-sort="SOG">SOG</th><th data-sort="HIT">HIT</th><th data-sort="BLK">BLK</th>
            `}
            <th data-sort="FP">FP</th>
            <th data-sort="FPG">FP/G</th>
        </tr>`;

    bindHeaderSortEvents();

    let filtered = allPlayers.filter(p => {
        const s = statsMap[p.player_id] || {};
        const gp = parseFloat(s.GP) || 0;
        const matchesName = p.full_name.toLowerCase().includes(nameFilter);
        const matchesPos = !posFilter ? true : (posFilter === 'F'