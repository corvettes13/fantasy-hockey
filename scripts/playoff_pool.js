// 1. CONFIGURATION & STATE
const PLAYOFF_TEAMS = ['BUF', 'MTL', 'TBL', 'CAR', 'PHI', 'COL', 'MIN', 'VGK', 'ANA'];

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

const TEAM_MAP = {
    'VEG': 'VGK'
};

let isRound2 = true; // Manual toggle for now
let existingRoster = null;

async function checkExistingUser(email) {
    if (!email) return alert("Please enter your email first.");
    
    // Change /get-entry to /playoff-get to match worker.js
    const res = await fetch(`/playoff-get?email=${encodeURIComponent(email)}`);
    
    if (res.ok) {
        const data = await res.json();
        if (data && data.roster) {
            existingRoster = data;
            myEntry = JSON.parse(JSON.stringify(data)); // Deep copy to current state
            enterRound2Mode(data);
            updateCounts();
            renderTable();
            alert("Roster found! You can now add 2 skaters or 1 goalie.");
        } else {
            alert("No existing roster found for this email. If this is your first entry, ignore this.");
        }
    }
}

function enterRound2Mode(data) {
    // Helper to safely disable elements
    const safeDisable = (id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    };

    const currentRound = matchupData ? matchupData.current_round : 2;
    renderRoundMatchups(currentRound);

    data.allIds = [...data.roster.F, ...data.roster.D, ...data.roster.G];

    if (document.getElementById('manager-name')) {
        document.getElementById('manager-name').value = data.managerName || "";
    }
    safeDisable('manager-name');
    
    if (document.getElementById('cup-winner')) {
        document.getElementById('cup-winner').value = data.cupWinner || "";
    }
    safeDisable('cup-winner');

    // 5. Disable Round 1 radio buttons
    document.querySelectorAll('#round-1-bracket input').forEach(el => el.disabled = true);
    
    // 6. Handle previous R2 picks
    if (data.bracket) {
        Object.keys(data.bracket).forEach(key => {
            if (key.startsWith('r2')) {
                const val = data.bracket[key];
                const radio = document.querySelector(`input[name="${key}"][value="${val}"]`);
                if (radio) radio.checked = true;
            }
        });
    }
}

function validateRound2() {
    const newSkaters = selectedSkaters.filter(id => !existingRoster.allIds.includes(id));
    const newGoalies = selectedGoalies.filter(id => !existingRoster.G.includes(id));
    
    const isValid = (newSkaters.length === 2 && newGoalies.length === 0) || 
                    (newSkaters.length === 0 && newGoalies.length === 1);
                    
    document.getElementById('save-entry').disabled = !isValid;
}


// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    fetch('/fantasy-hockey/shared/header.html').then(res => res.text()).then(html => {
        const header = document.querySelector('.site-header');
        if (header) header.innerHTML = html;
    });
    
    if (isRound2) {
        const r2Section = document.getElementById('round-2-bracket');
        if (r2Section) r2Section.style.display = 'block';
    }

    await initData();    
    await loadExistingEntry();

    const posFilter = document.getElementById('pos-filter');
    const nameFilter = document.getElementById('name-filter');

    if (posFilter) posFilter.addEventListener('change', renderTable);
    if (nameFilter) nameFilter.addEventListener('input', renderTable);

});

let matchupData = null;
let playoffStatsMap = {}; 

async function initData() {
    try {
        const [playersRes, teamsRes, skaterRes, goalieRes, matchupRes, pSkaterRes, pGoalieRes] = await Promise.all([
            fetch('/fantasy-hockey/data/players.json').then(res => res.json()),
            fetch('/fantasy-hockey/teams/nhl_teams.json').then(res => res.json()),
            fetch('/fantasy-hockey/data/2026_skater_stats.json').then(res => res.json()),
            fetch('/fantasy-hockey/data/2026_goalie_stats.json').then(res => res.json()),
            fetch('/fantasy-hockey/data/playoff_matchups.json').then(res => res.json()),
            // NEW: Fetch playoff-specific stats
            fetch('/fantasy-hockey/data/2026_playoff_skater_stats.json').then(res => res.json()),
            fetch('/fantasy-hockey/data/2026_playoff_goalie_stats.json').then(res => res.json())
        ]);

        matchupData = matchupRes;
        teamMap = Object.fromEntries(teamsRes.map(t => [t.team_abbreviation, t.logo_url]));
        
        // Regular Season Maps
        skaterStatsMap = buildStatsMap(skaterRes.players, "skater");
        goalieStatsMap = buildStatsMap(goalieRes.players, "goalie");
        
        // --- NEW: Build the Playoff Stats Map ---
        // Your playoff JSON is a flat array, so we map by 'Player' name (normalized)
        playoffStatsMap = {};
        [...pSkaterRes, ...pGoalieRes].forEach(entry => {
            playoffStatsMap[entry.Player] = entry.fantasy_points;
        });

        calculateFantasyPoints(skaterStatsMap, playersRes.players, "skater");
        calculateFantasyPoints(goalieStatsMap, playersRes.players, "goalie");

        allPlayers = playersRes.players.filter(p => PLAYOFF_TEAMS.includes(p.team_abbr));
        
        const currentRound = matchupData.current_round;
        const acceptingNew = matchupData.accepting_new_entries;
        
        const teamFilter = document.getElementById('team-filter');
        if (teamFilter) {
            // Fill the dropdown with active teams from our Master JSON
            const activeTeams = matchupData.active_teams || [];
            activeTeams.sort().forEach(abbr => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = abbr;
                teamFilter.appendChild(opt);
            });
            teamFilter.addEventListener('change', renderTable);
        }        
        
        renderTable();        

      if (currentRound > 1) {
          if (!acceptingNew) {
              const lookup = document.getElementById('lookup-section');
              if (lookup) lookup.style.display = 'block';

              const main = document.querySelector('.main-content');
              if (main) {
                  // Keep the opacity if you want a "locked" look, 
                  // but remove pointerEvents so they can still scroll/browse.
                  main.style.opacity = '1.0'; 
                  main.style.pointerEvents = 'auto'; 
              }
          }
          renderRoundMatchups(currentRound);
      }
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
        let aVal, bVal;

        if (key === 'playoffTotal') {
            // Lookup playoff points for sorting
            const aKey = (a.position === 'G') ? `G_${a.team_abbr}` : normalizeName(a.full_name);
            const bKey = (b.position === 'G') ? `G_${b.team_abbr}` : normalizeName(b.full_name);
            aVal = playoffStatsMap[aKey]?.total || 0;
            bVal = playoffStatsMap[bKey]?.total || 0;
        } else {
            // Standard regular season sorting
            const aS = (a.position === 'G' ? goalieStatsMap[a.player_id] : skaterStatsMap[a.player_id]) || {};
            const bS = (b.position === 'G' ? goalieStatsMap[b.player_id] : skaterStatsMap[b.player_id]) || {};
            aVal = parseFloat(aS[currentSortKey]) || 0;
            bVal = parseFloat(bS[currentSortKey]) || 0;
        }

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
    const teamFilter = document.getElementById('team-filter').value;

    if (!tbody || !thead || !posEl) return;

    const posFilter = posEl.value;
    const nameFilter = (nameEl ? nameEl.value.toLowerCase() : "");
    const isG = posFilter === 'G';
    const minGP = 10;

    statsMap = isG ? goalieStatsMap : skaterStatsMap;

    thead.innerHTML = `
        <tr>
            <th>Action</th>
            <th style="text-align: left;">Player</th>
            <th>Pos</th>
            <th data-sort="playoffTotal">Playoff Pts</th> <th data-sort="GP">Reg GP</th>
            ${isG ? `
                <th data-sort="W">W</th><th data-sort="L">L</th><th data-sort="GAA">GAA</th>
                <th data-sort="SV%">SV%</th><th data-sort="SHO">SO</th>
            ` : `
                <th data-sort="G">G</th><th data-sort="A">A</th><th data-sort="PTS">PTS</th>
                <th data-sort="PIM">PIM</th><th data-sort="SOG">SOG</th><th data-sort="HIT">HIT</th><th data-sort="BLK">BLK</th>
            `}
            <th data-sort="FPG">Reg FP/G</th>
        </tr>`;

    bindHeaderSortEvents();

    let filtered = allPlayers.filter(p => {
        const s = statsMap[p.player_id] || {};
        const gp = parseFloat(s.GP) || 0;
        const matchesName = p.full_name.toLowerCase().includes(nameFilter);
        const matchesTeam = !teamFilter ? true : p.team_abbr === teamFilter;
        const matchesPos = !posFilter ? true : (
            posFilter === 'F' 
            ? (p.position.includes('C') || p.position.includes('LW') || p.position.includes('RW')) 
            : p.position.includes(posFilter)
        );
        return matchesName && matchesPos && matchesTeam;
    });

    filtered.sort((a, b) => {
        const aS = statsMap[a.player_id] || {};
        const bS = statsMap[b.player_id] || {};
        let aVal = (currentSortKey === 'ATOI') ? atoiToSeconds(aS.ATOI) : parseFloat(aS[currentSortKey] || 0);
        let bVal = (currentSortKey === 'ATOI') ? atoiToSeconds(bS.ATOI) : parseFloat(bS[currentSortKey] || 0);
        return (aVal - bVal) * sortDirection;
    });

    tbody.innerHTML = '';
        filtered.forEach(p => {
            const s = statsMap[p.player_id] || {};
            const isSelected = isAlreadyInRoster(p.player_id);
            
            // 1. Identify if player is from the Round 1 Roster (Legacy)
            const isLegacy = existingRoster && (
                existingRoster.roster.F.includes(p.player_id) || 
                existingRoster.roster.D.includes(p.player_id) || 
                existingRoster.roster.G.includes(p.player_id)
            );

            // 2. Playoff Points Lookup
            const playoffLookupKey = (p.position === 'G') ? `G_${p.team_abbr}` : normalizeName(p.full_name);
            const pStats = playoffStatsMap[playoffLookupKey] || { total: 0 };

            const row = document.createElement('tr');
            if (isSelected) row.className = 'selected-row';
            if (isLegacy) row.style.opacity = '0.7'; // Visual indicator for locked players

            // 3. Build the Row
            row.innerHTML = `
                <td>
                    <button onclick="togglePlayer(${p.player_id})" ${isLegacy ? 'disabled' : ''}>
                        ${isLegacy ? '🔒' : (isSelected ? 'Remove' : 'Add')}
                    </button>
                </td>
                <td class="player-cell">
                    <img src="${teamMap[p.team_abbr] || ''}" alt="logo" style="width:20px; height:20px; vertical-align:middle;">
                    <a href="${p.url || '#'}" target="_blank" style="${isLegacy ? 'color: #666; text-decoration: none;' : ''}">
                        ${p.full_name}
                    </a>
                    <span class="team-abbr">${p.team_abbr}</span>
                </td>
                <td>${p.position}</td>
                
                <td style="font-weight:bold;">${parseFloat(pStats.total || 0).toFixed(1)}</td>

                <td>${s.GP || 0}</td>
                ${p.position === 'G' ? `
                    <td>${s.W || 0}</td><td>${s.L || 0}</td><td>${parseFloat(s.GAA || 0).toFixed(2)}</td>
                    <td>${typeof s['SV%'] === 'number' ? (s['SV%'] * 100).toFixed(1) + '%' : (s['SV%'] || '0%')}</td><td>${s.SHO || 0}</td>
                ` : `
                    <td>${s.G || 0}</td><td>${s.A || 0}</td><td>${s.PTS || 0}</td>
                    <td>${s.PIM || 0}</td><td>${s.SOG || 0}</td><td>${s.HIT || 0}</td><td>${s.BLK || 0}</td>
                `}
                
                <td style="font-weight:bold; color: #0055a5;">${s.FPG || '0.00'}</td>
            `;
            tbody.appendChild(row);
        });
}

// 6. BRACKET & CUP LOGIC
window.updateBracket = function(seriesId, winner) {
    if (!myEntry.bracket) myEntry.bracket = {};
    myEntry.bracket[seriesId] = winner;
};

window.updateCupWinner = function(team) {
    myEntry.cupWinner = team;
};

// 7. UTILITIES
window.togglePlayer = function(id) {
    const p = allPlayers.find(x => x.player_id == id);
    if (!p) return;
    
    const cat = p.position === 'G' ? 'G' : (p.position === 'D' ? 'D' : 'F');
    
    if (isAlreadyInRoster(id)) {
        // Double check: Never allow removal of a legacy player
        const isLegacy = existingRoster && 
                         (existingRoster.roster.F.includes(id) || 
                          existingRoster.roster.D.includes(id) || 
                          existingRoster.roster.G.includes(id));
        if (isLegacy) return; 

        myEntry.roster[cat] = myEntry.roster[cat].filter(x => x != id);
    } else {
        // Skip the 12/5/3 checks entirely if isRound2 is active
        myEntry.roster[cat].push(id);
    }
    updateCounts();
    renderTable();
};

function updateCounts() {
    // Update the UI counters for visual feedback
    ['F', 'D', 'G'].forEach(c => {
        const el = document.getElementById(`count-${c}`);
        if (el) el.innerText = myEntry.roster[c].length;
    });

    const saveBtn = document.getElementById('save-entry');
    if (!saveBtn) return;

    if (isRound2 && existingRoster) {
        // Calculate the difference between current selections and original roster
        const newSkaters = [
            ...myEntry.roster.F.filter(id => !existingRoster.roster.F.includes(id)),
            ...myEntry.roster.D.filter(id => !existingRoster.roster.D.includes(id))
        ];
        const newGoalies = myEntry.roster.G.filter(id => !existingRoster.roster.G.includes(id));

        const skaterCount = newSkaters.length;
        const goalieCount = newGoalies.length;

        // Rule: Exactly 2 new skaters AND 0 goalies OR Exactly 1 new goalie AND 0 skaters
        const isValid = (skaterCount === 2 && goalieCount === 0) || 
                        (skaterCount === 0 && goalieCount === 1);

        saveBtn.disabled = !isValid;
        saveBtn.innerText = isValid ? "Submit Round 2 Changes" : `Add ${2 - skaterCount} Skaters OR 1 Goalie`;
        saveBtn.setAttribute('onclick', 'saveSupplement()');
    } else {
        // Round 1 Logic
        const total = myEntry.roster.F.length + myEntry.roster.D.length + myEntry.roster.G.length;
        saveBtn.disabled = (total !== 20);
    }
}

function isAlreadyInRoster(id) {
    return [...myEntry.roster.F, ...myEntry.roster.D, ...myEntry.roster.G].includes(id);
}

window.saveEntry = async function() {
    myEntry.managerName = document.getElementById('manager-name').value.trim();
    myEntry.email = document.getElementById('user-email').value.toLowerCase().trim();
    myEntry.password = document.getElementById('league-pass').value;
    
    const cupSelect = document.getElementById('cup-winner');
    if (cupSelect) myEntry.cupWinner = cupSelect.value;

    if (!myEntry.managerName || !myEntry.email || !myEntry.password) {
        return alert("Name, Email, and Password are required!");
    }
    
    const total = myEntry.roster.F.length + myEntry.roster.D.length + myEntry.roster.G.length;
    if (total !== 20) return alert("Roster must have 20 players.");

    try {
        const res = await fetch('/playoff-submit', { 
            method: 'POST', 
            body: JSON.stringify(myEntry),
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (res.status === 401) return alert("Incorrect League Password!");

        if (res.ok) {
            const result = await res.json();
            // Store email locally so the page remembers them
            localStorage.setItem('savedEmail', myEntry.email);
            
            alert(`Entry Saved! Your unique Entry ID is: ${result.entryId}`);
        } else {
            alert("Save failed.");
        }
    } catch (err) { alert("Network error."); }
};

async function loadExistingEntry() {
    // 1. Check if we have a "remembered" email
    let email = localStorage.getItem('savedEmail');

    // 2. If no email in storage, don't try to fetch (keeps page clean for new users)
    if (!email) return;

    try {
        const res = await fetch(`/playoff-get?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        
        if (data && data.roster) {
            myEntry = data;
            existingRoster = data;
            
            // Populate UI fields
            if (myEntry.managerName) document.getElementById('manager-name').value = myEntry.managerName;
            if (myEntry.email) document.getElementById('user-email').value = myEntry.email;
            if (myEntry.cupWinner) document.getElementById('cup-winner').value = myEntry.cupWinner;
            
            if (isRound2) {
                enterRound2Mode(data);
            }
            
            // Re-check radio buttons for the bracket
            if (myEntry.bracket) {
                Object.keys(myEntry.bracket).forEach(seriesId => {
                    const winner = myEntry.bracket[seriesId];
                    const radio = document.querySelector(`input[name="${seriesId}"][value="${winner}"]`);
                    if (radio) radio.checked = true;
                });
            }

            updateCounts();
            renderTable();
            console.log("Welcome back! Your entry has been loaded.");
        }
    } catch (err) { 
        console.log("No existing entry found for this user."); 
    }
}

function renderRoundMatchups(roundNum) {
    if (!matchupData || !matchupData.rounds) return;

    const container = document.getElementById(`r${roundNum}-matchups-list`);
    const roundKey = `r${roundNum}`;
    const roundInfo = matchupData.rounds[roundKey];
    
    // Safety check: if the round doesn't exist in JSON yet, exit
    if (!roundInfo || !roundInfo.matchups) return; 

    // Use roundInfo.matchups instead of r2Data
    container.innerHTML = Object.entries(roundInfo.matchups).map(([id, match]) => `
        <div class="matchup-box" style="margin-bottom: 10px; padding: 8px; border: 1px solid #eee; border-radius: 4px;">
            <div class="matchup-label" style="font-size: 0.75rem; font-weight: bold; color: #444; margin-bottom: 5px;">
                ${match.label}
            </div>
            <div style="display: flex; gap: 15px;">
                <label style="font-size: 0.8rem; cursor: pointer;">
                    <input type="radio" name="${id}" value="${match.teams[0]}" onclick="updateBracket('${id}', '${match.teams[0]}')"> 
                    ${match.teams[0]}
                </label>
                <label style="font-size: 0.8rem; cursor: pointer;">
                    <input type="radio" name="${id}" value="${match.teams[1]}" onclick="updateBracket('${id}', '${match.teams[1]}')"> 
                    ${match.teams[1]}
                </label>
            </div>
        </div>
    `).join('');
}

async function saveSupplement() {
    // 1. Check if elements exist before grabbing values
    const emailEl = document.getElementById('user-email'); 
    const passEl = document.getElementById('league-pass'); 

    if (!emailEl || !passEl) {
        console.error("Missing input fields in HTML. Found emailEl:", !!emailEl, "Found passEl:", !!passEl);
        alert("Technical Error: Input fields not found.");
        return;
    }

    const email = emailEl.value.trim().toLowerCase();
    const leaguePass = passEl.value.trim();

    if (!email) return alert("Email is missing.");
    if (!leaguePass) return alert("Please enter the League Password.");

    if (!leaguePass) {
        return alert("Please enter the League Password to save changes.");
    }

    // 2. Identify newly added players
    const newPlayers = [];
    ['F', 'D', 'G'].forEach(pos => {
        myEntry.roster[pos].forEach(id => {
            // Check against the ORIGINAL roster we loaded at the start
            if (!existingRoster.roster[pos].includes(id)) {
                newPlayers.push({ id: id, pos: pos });
            }
        });
    });

    // 3. Grab Round 2 bracket picks
    const newMatchups = {};
    const currentRound = matchupData.current_round;
    const rMatchups = matchupData.rounds[`r${currentRound}`].matchups;
    
    Object.keys(rMatchups).forEach(key => {
        const selected = document.querySelector(`input[name="${key}"]:checked`);
        if (selected) newMatchups[key] = selected.value;
    });

    const payload = {
        email,
        leaguePass, // This is supplement.leaguePass in your Worker
        newPlayers,
        newMatchups
    };

    const res = await fetch('/submit-supplement', { // Ensure this matches your Worker route
        method: 'POST',
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        alert("Round 2 additions saved successfully!");
        window.location.href = `/playoff_pool/entry.html?id=${existingRoster.entryId}`;
    } else {
        const msg = await res.text();
        alert("Error: " + msg);
    }
}

function normalizeName(name) {
    if (!name) return "";
    // This splits accented characters into their base letter + accent, 
    // then removes the accent marks (diacritics).
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}