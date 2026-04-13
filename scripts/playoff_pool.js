// 1. CONFIGURATION & STATE
const PLAYOFF_TEAMS = ['BUF', 'MTL', 'TBL', 'BOS', 'OTT', 'CAR', 'PIT', 'PHI', 'WSH', 'COL', 'DAL', 'MIN', 'UTA', 'VEG', 'EDM', 'NSH', 'ANA', 'LAK'];

const skaterStatIdMap = {
    0: 'GP', 1: 'G', 2: 'A', 3: 'PTS', 4: 'PlusMinus', 5: 'PIM',
    14: 'SOG', 31: 'HIT', 32: 'BLK'
};
const goalieStatIdMap = {
    0: 'GP', 19: 'W', 20: 'L', 23: 'GAA', 26: 'SV%', 27: 'SHO'
};

let allPlayers = [];
let skaterStatsMap = {};
let goalieStatsMap = {};
let teamMap = {};

let myEntry = {
    managerName: "",
    roster: { F: [], D: [], G: [] },
    bracket: {},
    cupWinner: ""
};

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    // Inject Header (Standard for your site)
    fetch('/fantasy-hockey/shared/header.html')
        .then(res => res.text())
        .then(html => {
            const header = document.querySelector('.site-header');
            if (header) header.innerHTML = html;
        });

    await initData();
    await loadExistingEntry();

    // Attach Listeners
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
        
        // Build Stats Maps
        skaterStatsMap = buildStatsMap(skaterRes.players, "skater");
        goalieStatsMap = buildStatsMap(goalieRes.players, "goalie");

        // Calculate Fantasy Points (FP/FPG)
        calculateFantasyPoints(skaterStatsMap, playersRes.players, "skater");
        calculateFantasyPoints(goalieStatsMap, playersRes.players, "goalie");

        // Filter for players in your 18-team hunt list
        allPlayers = playersRes.players.filter(p => PLAYOFF_TEAMS.includes(p.team_abbr));

        renderTable();
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

// 3. DATA HELPERS
function buildStatsMap(statsArray, type) {
    const map = {};
    const idMap = (type === "goalie") ? goalieStatIdMap : skaterStatIdMap;
    statsArray.forEach(stat => {
        const id = stat.player_key.split('.').pop();
        const obj = {};
        stat.stats.forEach(s => {
            const key = idMap[s.stat_id];
            if (key) obj[key] = s.value;
        });
        map[id] = obj;
    });
    return map;
}

function calculateFantasyPoints(statsMap, players, type) {
    players.forEach(p => {
        const s = statsMap[p.player_id];
        if (!s) return;
        let fp = 0;
        if (type === "goalie") {
            fp = (s.W || 0) * 3 + (s.L || 0) * -1 + (s.SHO || 0) * 5;
        } else {
            fp = (s.G || 0) * 3 + (s.A || 0) * 2 + (s.PIM || 0) * 0.2 + (s.SOG || 0) * 0.2 + (s.HIT || 0) * 0.1 + (s.BLK || 0) * 0.3;
        }
        s.FP = parseFloat(fp.toFixed(1));
        s.FPG = s.GP ? (fp / s.GP).toFixed(2) : "0.00";
    });
}

// 4. UI RENDERING
function renderTable() {
    const posEl = document.getElementById('pos-filter');
    const nameEl = document.getElementById('name-filter');
    const tbody = document.getElementById('players-body');
    const thead = document.getElementById('players-head');

    if (!tbody || !thead || !posEl) return;

    const posFilter = posEl.value;
    const nameFilter = (nameEl ? nameEl.value.toLowerCase() : "");
    const isG = posFilter === 'G';

    thead.innerHTML = `
        <tr>
            <th>Action</th>
            <th>Player</th>
            <th>Pos</th>
            <th>GP</th>
            ${isG ? '<th>W</th><th>L</th><th>GAA</th><th>SV%</th><th>SO</th>' : '<th>G</th><th>A</th><th>PTS</th><th>PIM</th><th>SOG</th><th>HIT</th><th>BLK</th>'}
            <th>FP</th>
            <th>FP/G</th>
        </tr>`;

    let filtered = allPlayers.filter(p => {
        const matchesName = p.full_name.toLowerCase().includes(nameFilter);
        const matchesPos = !posFilter ? true : (posFilter === 'F' ? ['C', 'LW', 'RW'].includes(p.position) : p.position === posFilter);
        return matchesName && matchesPos;
    });

    // Sort by FPG
    filtered.sort((a, b) => {
        const aStats = (a.position === 'G' ? goalieStatsMap[a.player_id] : skaterStatsMap[a.player_id]) || {};
        const bStats = (b.position === 'G' ? goalieStatsMap[b.player_id] : skaterStatsMap[b.player_id]) || {};
        return (parseFloat(bStats.FPG) || 0) - (parseFloat(aStats.FPG) || 0);
    });

    tbody.innerHTML = '';
    filtered.forEach(p => {
        const stats = (p.position === 'G' ? goalieStatsMap[p.player_id] : skaterStatsMap[p.player_id]) || {};
        const isSelected = isAlreadyInRoster(p.player_id);
        const logo = teamMap[p.team_abbr] || '';

        const row = document.createElement('tr');
        if (isSelected) row.className = 'selected-row';

        row.innerHTML = `
            <td><button onclick="togglePlayer(${p.player_id})">${isSelected ? 'Remove' : 'Add'}</button></td>
            <td class="player-cell">
                <img src="${logo}" style="width:20px; vertical-align:middle; margin-right:5px;">
                <strong>${p.full_name}</strong>
            </td>
            <td>${p.position}</td>
            <td>${stats.GP || 0}</td>
            ${p.position === 'G' ? `
                <td>${stats.W || 0}</td><td>${stats.L || 0}</td><td>${stats.GAA || '0.00'}</td>
                <td>${stats['SV%'] ? (stats['SV%'] * 100).toFixed(1) + '%' : '0%'}</td><td>${stats.SHO || 0}</td>
            ` : `
                <td>${stats.G || 0}</td><td>${stats.A || 0}</td><td>${stats.PTS || 0}</td>
                <td>${stats.PIM || 0}</td><td>${stats.SOG || 0}</td><td>${stats.HIT || 0}</td><td>${stats.BLK || 0}</td>
            `}
            <td>${stats.FP || 0}</td>
            <td style="font-weight:bold">${stats.FPG || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// 5. ROSTER LOGIC
window.togglePlayer = function(id) {
    const p = allPlayers.find(x => x.player_id == id);
    if (!p) return;
    const cat = p.position === 'G' ? 'G' : (p.position === 'D' ? 'D' : 'F');

    if (isAlreadyInRoster(id)) {
        myEntry.roster[cat] = myEntry.roster[cat].filter(x => x != id);
    } else {
        if (cat === 'F' && myEntry.roster.F.length >= 12) return alert("12 Forwards Max");
        if (cat === 'D' && myEntry.roster.D.length >= 5) return alert("5 Defense Max");
        if (cat === 'G' && myEntry.roster.G.length >= 3) return alert("3 Goalies Max");
        myEntry.roster[cat].push(id);
    }
    updateCounts();
    renderTable();
};

function updateCounts() {
    ['F', 'D', 'G'].forEach(c => {
        const el = document.getElementById(`count-${c}`);
        if (el) el.innerText = myEntry.roster[c].length;
    });
    
    const total = myEntry.roster.F.length + myEntry.roster.D.length + myEntry.roster.G.length;
    const saveBtn = document.getElementById('save-entry');
    if (saveBtn) saveBtn.disabled = (total !== 20);
}

function isAlreadyInRoster(id) {
    return [...myEntry.roster.F, ...myEntry.roster.D, ...myEntry.roster.G].includes(id);
}

// 6. PERSISTENCE
window.saveEntry = async function() {
    try {
        const res = await fetch('/playoff-submit', { 
            method: 'POST', 
            body: JSON.stringify(myEntry),
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) alert("Entry Saved!");
    } catch (err) {
        alert("Save failed.");
    }
};

async function loadExistingEntry() {
    try {
        const res = await fetch('/playoff-get');
        const data = await res.json();
        if (data && data.roster) {
            myEntry = data;
            updateCounts();
            renderTable();
        }
    } catch (err) {
        console.log("No existing entry found.");
    }
}