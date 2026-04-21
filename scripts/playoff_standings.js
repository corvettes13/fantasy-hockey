const WORKER_ALL_ENTRIES = '/list-entries'; 
const SKATER_STATS = '/fantasy-hockey/data/2026_playoff_skater_stats.json';
const GOALIE_STATS = '/fantasy-hockey/data/2026_playoff_goalie_stats.json';
const PLAYERS_JSON = '/fantasy-hockey/data/players.json';

const CUP_VALUES = {
    "COL": { name: "Colorado", pts: 50 },
    "TBL": { name: "Tampa Bay", pts: 59 },
    "CAR": { name: "Carolina", pts: 75 },
    "DAL": { name: "Dallas", pts: 150 },
    "VEG": { name: "Vegas", pts: 150 },
    "EDM": { name: "Edmonton", pts: 188 },
    "MIN": { name: "Minnesota", pts: 213 },
    "BUF": { name: "Buffalo", pts: 225 },
    "OTT": { name: "Ottawa", pts: 225 },
    "UTA": { name: "Utah", pts: 425 },
    "MTL": { name: "Montreal", pts: 450 },
    "PIT": { name: "Pittsburgh", pts: 513 },
    "ANA": { name: "Anaheim", pts: 700 },
    "PHI": { name: "Philadelphia", pts: 763 },
    "BOS": { name: "Boston", pts: 763 },
    "LAK": { name: "Los Angeles", pts: 825 }
};

// Toggle this to true ONLY when the Stanley Cup is actually awarded
const CHAMPION_DETERMINED = null; // Set to "COL" etc.

async function initStandings() {
    try {
        const [entriesRes, skatersRes, goaliesRes, playersRes, nhlTeamsRes] = await Promise.all([
            fetch('/list-entries').then(res => res.json()),
            fetch('../data/2026_playoff_skater_stats.json').then(res => res.json()),
            fetch('../data/2026_playoff_goalie_stats.json').then(res => res.json()),
            fetch('../data/players.json').then(res => res.json()),
            fetch('../teams/nhl_teams.json').then(res => res.json()) // Fetch teams for logos
        ]);

        const playerInfoMap = Object.fromEntries(playersRes.players.map(p => [p.player_id, p]));
        const nhlTeamMap = Object.fromEntries(nhlTeamsRes.map(t => [t.team_abbreviation, t.logo_url]));
        const statsMap = {};
        [...skatersRes, ...goaliesRes].forEach(p => { statsMap[p.Player] = p.fantasy_points; });

        const teamPickCounts = {};
        const playerPickCounts = {};

        const standings = entriesRes.map(entry => {
            let rPoints = { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
            let activeCount = 0;

            const allIds = [...entry.roster.F, ...entry.roster.D, ...entry.roster.G];
            allIds.forEach(id => {
                const pInfo = playerInfoMap[id];
                const pts = statsMap[pInfo?.full_name] || { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
                
                rPoints.r1 += pts.r1; rPoints.r2 += pts.r2; rPoints.r3 += pts.r3; rPoints.r4 += pts.r4;
                rPoints.total += pts.total;
                if (pts.total > 0) activeCount++;

                if (pInfo?.team_abbr) {
                    teamPickCounts[pInfo.team_abbr] = (teamPickCounts[pInfo.team_abbr] || 0) + 1;
                }
                if (id) {
                    playerPickCounts[id] = (playerPickCounts[id] || 0) + 1;
                }
            });

            const cupAbbr = entry.cupWinner;
            const cupData = CUP_VALUES[cupAbbr] || { name: cupAbbr, pts: 0 };
            let cupBonus = (CHAMPION_DETERMINED === cupAbbr) ? cupData.pts : 0;

            return {
                manager: entry.managerName,
                id: entry.entryId,
                grandTotal: rPoints.total + cupBonus,
                active: activeCount,
                r1: rPoints.r1, r2: rPoints.r2, r3: rPoints.r3, r4: rPoints.r4,
                cupWinnerStr: `${cupData.name} (${cupData.pts} pts)`
            };
        });

        standings.sort((a, b) => b.grandTotal - a.grandTotal);
        
        renderTable(standings);
        renderPopularTeams(teamPickCounts, nhlTeamMap); // Pass the logo map
        renderPopularPlayers(playerPickCounts, playerInfoMap);

    } catch (err) {
        console.error(err);
    }
}

function renderPopularPlayers(counts, infoMap) {
    const body = document.getElementById('popular-players-body');
    if (!body) return;

    // Sort players by pick count and take top 20
    const sortedPlayers = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
    
    body.innerHTML = sortedPlayers.map(([id, count]) => {
        const p = infoMap[id];
        return `
            <tr>
                <td style="text-align: left; font-weight: bold; font-size: 0.85rem;">
                    ${p?.full_name || 'Unknown'}
                </td>
                <td style="text-align: left; font-size: 0.75rem; color: #666;">
                    ${p?.team_abbr || '---'} | ${p?.position || '---'}
                </td>
                <td style="font-weight: bold;">${count}</td>
            </tr>
        `;
    }).join('');
}

function renderPopularTeams(counts, logoMap) {
    const body = document.getElementById('popular-picks-body');
    if (!body) return;

    // Remove .slice(0, 5) to show all teams
    const sortedTeams = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    body.innerHTML = sortedTeams.map(([teamAbbr, count]) => {
        const logoUrl = logoMap[teamAbbr] || '';
        return `
            <tr>
                <td style="text-align: left; display: flex; align-items: center; gap: 10px; font-weight: bold;">
                    <img src="${logoUrl}" alt="${teamAbbr}" style="width: 25px; height: auto;">
                    ${teamAbbr}
                </td>
                <td style="font-weight: bold;">${count}</td>
            </tr>
        `;
    }).join('');
}

function renderTable(standings) {
    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = standings.map((s, i) => `
        <tr>
            <td class="pos-rank">${i + 1}</td>
            <td style="text-align: left;"><a href="entry.html?id=${s.id}" class="manager-link">${s.manager}</a></td>
            <td><strong>${s.grandTotal.toFixed(1)}</strong></td>
            <td>${s.active}</td>
            <td>${s.r1.toFixed(1)}</td>
            <td>${s.r2.toFixed(1)}</td>
            <td>${s.r3.toFixed(1)}</td>
            <td>${s.r4.toFixed(1)}</td>
            <td>0</td> <td style="text-align: left;">${s.cupWinnerStr}</td>
        </tr>
    `).join('');
}

initStandings();

async function initStandings() {
    try {
        const [entriesRes, skatersRes, goaliesRes, playersRes] = await Promise.all([
            fetch(WORKER_ALL_ENTRIES).then(res => res.json()),
            fetch(SKATER_STATS).then(res => res.json()),
            fetch(GOALIE_STATS).then(res => res.json()),
            fetch(PLAYERS_JSON).then(res => res.json())
        ]);

        // Map IDs to static player info (names, positions)
        const playerInfoMap = Object.fromEntries(playersRes.players.map(p => [p.player_id, p]));
        
        // Build the Stats Map (Normalized names as keys)
        const statsMap = {};
        [...skatersRes, ...goaliesRes].forEach(p => {
            statsMap[p.Player] = p.fantasy_points;
        });
        
        const eliminatedTeams = [];
        // Calculate data for each manager
        const standings = entriesRes.map(entry => {
            let r1 = 0, r2 = 0, r3 = 0, r4 = 0, totalRoster = 0;
            let activePlayersCount = 0;
            
            let aliveCount = 0;
            const allIds = [...entry.roster.F, ...entry.roster.D, ...entry.roster.G];
            
            allIds.forEach(id => {
                const pInfo = playerInfoMap[id];
                if (pInfo && !eliminatedTeams.includes(pInfo.team_abbr)) {
                  aliveCount++;
                }
                const pts = statsMap[pInfo?.full_name] || { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
                
                r1 += pts.r1; 
                r2 += pts.r2; 
                r3 += pts.r3; 
                r4 += pts.r4;
                totalRoster += pts.total;

                // Simple check for "Active": did they score any points yet?
                if (pts.total > 0) activePlayersCount++;
            });

            // Placeholder for Bracket scoring logic
            const pickPoints = 0; 
            const grandTotal = totalRoster + pickPoints;

            return {
                manager: entry.managerName,
                id: entry.entryId,
                grandTotal: grandTotal,
                activePlayers: activePlayersCount, aliveCount,
                r1: r1, r2: r2, r3: r3, r4: r4,
                pickPoints: pickPoints,
                cupWinner: entry.cupWinner || 'N/A'
            };
        });

        // Sort by Grand Total (Highest first)
        standings.sort((a, b) => b.grandTotal - a.grandTotal);

        renderTable(standings);
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('standings-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" style="color:red;">Error loading standings: ${err.message}</td></tr>`;
        }
    }
}

function renderTable(standings) {
    const tbody = document.getElementById('standings-body');
    const countEl = document.getElementById('display-entry-count');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (countEl) countEl.textContent = standings.length;

    standings.forEach((s, index) => {
        // We use .toFixed(1) for the points, but integer for Pick Points and Active Count
        const row = `
            <tr>
                <td class="pos-rank">${index + 1}</td>
                <td style="text-align: left;">
                    <a href="entry.html?id=${s.id}" class="manager-link">${s.manager}</a>
                </td>
                <td><strong>${s.grandTotal.toFixed(1)}</strong></td>
                <td>${s.activePlayers}</td>
                <td>${s.r1.toFixed(1)}</td>
                <td>${s.r2.toFixed(1)}</td>
                <td>${s.r3.toFixed(1)}</td>
                <td>${s.r4.toFixed(1)}</td>
                <td>${s.pickPoints}</td>
                <td style="text-align: left; font-size: 0.8rem;">${s.cupWinner}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    // Re-initialize sortable behavior after rendering
    if (typeof makeTableSortable === 'function') {
        makeTableSortable();
    }
}

// Kick off the script
initStandings();