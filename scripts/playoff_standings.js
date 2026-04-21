const WORKER_ALL_ENTRIES = '/list-entries'; 
const SKATER_STATS = '/fantasy-hockey/data/2026_playoff_skater_stats.json';
const GOALIE_STATS = '/fantasy-hockey/data/2026_playoff_goalie_stats.json';
const PLAYERS_JSON = '/fantasy-hockey/data/players.json';
const TEAMS_JSON = '/fantasy-hockey/teams/nhl_teams.json';

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

const CHAMPION_DETERMINED = null; 

// ... (Keep your constants and CUP_VALUES at the top)

async function initStandings() {
    try {
        const [entriesRes, skatersRes, goaliesRes, playersRes, nhlTeamsRes] = await Promise.all([
            fetch(WORKER_ALL_ENTRIES).then(res => res.json()),
            fetch(SKATER_STATS).then(res => res.json()),
            fetch(GOALIE_STATS).then(res => res.json()),
            fetch(PLAYERS_JSON).then(res => res.json()),
            fetch(TEAMS_JSON).then(res => res.json())
        ]);

        const playerInfoMap = Object.fromEntries(playersRes.players.map(p => [p.player_id, p]));
        const nhlTeamMap = Object.fromEntries(nhlTeamsRes.map(t => [t.team_abbreviation, t.logo_url]));
        const statsMap = {};
        [...skatersRes, ...goaliesRes].forEach(p => { 
            statsMap[p.Player] = p.fantasy_points; 
        });

        const cupPickCounts = {};
        const playerPickCounts = {};
        const eliminatedTeams = []; 

        const standings = entriesRes.map(entry => {
            let rPoints = { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
            let aliveCount = 0;

            const allIds = [...entry.roster.F, ...entry.roster.D, ...entry.roster.G];
            allIds.forEach(id => {
                const pInfo = playerInfoMap[id];
                const pts = statsMap[pInfo?.full_name] || { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
                
                rPoints.r1 += pts.r1; rPoints.r2 += pts.r2; rPoints.r3 += pts.r3; rPoints.r4 += pts.r4;
                rPoints.total += pts.total;

                if (pInfo && !eliminatedTeams.includes(pInfo.team_abbr)) aliveCount++;
                if (id) playerPickCounts[id] = (playerPickCounts[id] || 0) + 1;
            });

            const cupAbbr = entry.cupWinner;
            if (cupAbbr) cupPickCounts[cupAbbr] = (cupPickCounts[cupAbbr] || 0) + 1;

            const cupData = CUP_VALUES[cupAbbr] || { name: cupAbbr, pts: 0 };
            let cupBonus = (CHAMPION_DETERMINED === cupAbbr) ? cupData.pts : 0;

            return {
                manager: entry.managerName,
                id: entry.entryId,
                grandTotal: rPoints.total + cupBonus,
                active: aliveCount,
                r1: rPoints.r1, r2: rPoints.r2, r3: rPoints.r3, r4: rPoints.r4,
                cupWinnerStr: `${cupData.name} (${cupData.pts} pts)`
            };
        });

        standings.sort((a, b) => b.grandTotal - a.grandTotal);
        
        renderTable(standings);
        renderPopularTeams(cupPickCounts, nhlTeamMap); 
        renderPopularPlayers(playerPickCounts, playerInfoMap, nhlTeamMap); // Pass nhlTeamMap here

    } catch (err) {
        console.error(err);
    }
}

function renderPopularTeams(counts, logoMap) {
    const body = document.getElementById('popular-picks-body');
    if (!body) return;

    const sortedTeams = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    body.innerHTML = sortedTeams.map(([teamAbbr, count]) => {
        const logoUrl = logoMap[teamAbbr] || '';
        const teamName = CUP_VALUES[teamAbbr] ? CUP_VALUES[teamAbbr].name : teamAbbr;
        return `
            <tr>
                <td style="text-align: left;">
                    <div style="display: flex; align-items: center; gap: 15px; font-weight: bold; min-height: 50px;">
                        <img src="${logoUrl}" alt="${teamAbbr}" style="width: 45px; height: auto;">
                        <span>${teamName}</span>
                    </div>
                </td>
                <td style="font-weight: bold; font-size: 1.2rem; vertical-align: middle;">${count}</td>
            </tr>
        `;
    }).join('');
}

function renderPopularPlayers(counts, infoMap, logoMap) {
    const grid = document.getElementById('popular-players-grid');
    if (!grid) return;

    const sortedPlayers = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
    
    grid.innerHTML = sortedPlayers.map(([id, count]) => {
        const p = infoMap[id];
        const teamAbbr = p?.team_abbr || '';
        const teamLogo = logoMap[teamAbbr] || ''; // Pull logo from nhlTeamMap
        
        return `
            <div class="popular-player-card">
                <div class="pick-count-badge">${count}</div>
                <img src="${teamLogo}" class="team-logo" alt="${teamAbbr}">
                <div class="player-info">
                    <span class="player-name">${p?.full_name || 'Unknown'}</span>
                    <span class="player-meta">${teamAbbr} | ${p?.position || '---'}</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderTable(standings) {
    const tbody = document.getElementById('standings-body');
    if (!tbody) return;

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
            <td>0</td> 
            <td style="text-align: left;">${s.cupWinnerStr}</td>
        </tr>
    `).join('');
}

initStandings();