const WORKER_ALL_ENTRIES = '/list-entries'; 
const SKATER_STATS = '/fantasy-hockey/data/2026_playoff_skater_stats.json';
const GOALIE_STATS = '/fantasy-hockey/data/2026_playoff_goalie_stats.json';
const PLAYERS_JSON = '/fantasy-hockey/data/players.json';
const TEAMS_JSON = '/fantasy-hockey/teams/nhl_teams.json';

function normalizeName(name) {
    if (!name) return "";
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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

const CHAMPION_DETERMINED = "CAR"; 
const MATCHUPS_JSON = '/fantasy-hockey/data/playoff_matchups.json';

async function initStandings() {
    try {
        const [entriesRes, skatersRes, goaliesRes, playersRes, nhlTeamsRes, matchupData] = await Promise.all([
            fetch(WORKER_ALL_ENTRIES).then(res => res.json()),
            fetch(SKATER_STATS).then(res => res.json()),
            fetch(GOALIE_STATS).then(res => res.json()),
            fetch(PLAYERS_JSON).then(res => res.json()),
            fetch(TEAMS_JSON).then(res => res.json()),
            fetch(MATCHUPS_JSON).then(res => res.json())
        ]);

        const playerInfoMap = Object.fromEntries(playersRes.players.map(p => [p.player_id, p]));
        const nhlTeamMap = Object.fromEntries(nhlTeamsRes.map(t => [t.team_abbreviation, t.logo_url]));
        const statsMap = {};
        
        // Map the full raw JSON elements cleanly indexed by key name
        [...skatersRes, ...goaliesRes].forEach(p => { statsMap[p.Player] = p; });

        const cupPickCounts = {};
        const playerPickCounts = {};
        const eliminatedTeams = Object.keys(CUP_VALUES).filter(team => !matchupData.active_teams.includes(team));

        const standings = entriesRes.map(entry => {
            let rPoints = { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
            let aliveCount = 0;
            let bracketPoints = 0;

            // --- CALCULATE BRACKET POINTS ---
            Object.entries(matchupData.rounds).forEach(([roundKey, roundData]) => {
                Object.entries(roundData.matchups).forEach(([matchupId, status]) => {
                    if (status.winner && entry.bracket[matchupId] === status.winner) {
                        bracketPoints += roundData.points_per_pick;
                    }
                });
            });

            // 1. Calculate points for BASELINE lineup players
            const originalRosterIds = [...entry.roster.F, ...entry.roster.D, ...entry.roster.G];
            originalRosterIds.forEach(id => {
                const pts = getPlayerPoints(id, playerInfoMap, statsMap);
                
                rPoints.r1 += pts.r1; 
                rPoints.r2 += pts.r2; 
                rPoints.r3 += pts.r3; 
                rPoints.r4 += pts.r4;
                rPoints.total += pts.total;

                aliveCount += updateCounts(id, playerInfoMap, eliminatedTeams, playerPickCounts);
            });

            // 2. Calculate points for SUPPLEMENTAL mid-round changes
            if (entry.supplemental) {
                Object.keys(entry.supplemental).forEach(roundKey => {
                    const pickedInRound = parseInt(roundKey.replace('r', ''), 10);
                    
                    if (entry.supplemental[roundKey] && Array.isArray(entry.supplemental[roundKey])) {
                        entry.supplemental[roundKey].forEach(id => {
                            const pts = getPlayerPoints(id, playerInfoMap, statsMap);
                            
                            if (pickedInRound <= 2) rPoints.r2 += pts.r2;
                            if (pickedInRound <= 3) rPoints.r3 += pts.r3;
                            if (pickedInRound <= 4) rPoints.r4 += pts.r4;
                            
                            let validSupplementalTotal = 0;
                            if (pickedInRound <= 2) validSupplementalTotal += pts.r2;
                            if (pickedInRound <= 3) validSupplementalTotal += pts.r3;
                            if (pickedInRound <= 4) validSupplementalTotal += pts.r4;
                            
                            rPoints.total += validSupplementalTotal;

                            aliveCount += updateCounts(id, playerInfoMap, eliminatedTeams, playerPickCounts);
                        });
                    }
                });
            }

            const cupAbbr = entry.cupWinner ? entry.cupWinner.trim().toUpperCase() : "";
            if (cupAbbr) {
                const trackingKey = (cupAbbr === "CAROLINA") ? "CAR" : cupAbbr;
                cupPickCounts[trackingKey] = (cupPickCounts[trackingKey] || 0) + 1;
            }

            const cupData = CUP_VALUES[cupAbbr] || CUP_VALUES[cupAbbr === "CAROLINA" ? "CAR" : ""] || { name: cupAbbr, pts: 0 };
            
            let cupBonus = 0;
            const officialWinner = matchupData.stanley_cup_winner;
            if (officialWinner && (cupAbbr === officialWinner.toUpperCase() || cupAbbr === "CAROLINA")) {
                cupBonus = matchupData.stanley_cup_points || cupData.pts;
            }

            return {
                manager: entry.managerName,
                id: entry.entryId,
                grandTotal: rPoints.total + bracketPoints + cupBonus,
                bracketPoints: bracketPoints, 
                active: aliveCount,
                r1: rPoints.r1, r2: rPoints.r2, r3: rPoints.r3, r4: rPoints.r4,
                cupWinnerStr: `${cupData.name} (+${cupBonus} pts)`
            };
        });

        standings.sort((a, b) => b.grandTotal - a.grandTotal);
        
        renderTable(standings);
        renderPopularTeams(cupPickCounts, nhlTeamMap); 
        renderPopularPlayers(playerPickCounts, playerInfoMap, nhlTeamMap);

    } catch (err) {
        console.error(err);
    }
}

function renderPopularPlayers(counts, infoMap, logoMap) {
    const grid = document.getElementById('popular-players-grid');
    if (!grid) return;

    const sortedPlayers = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    
    grid.innerHTML = sortedPlayers.map(([id, count]) => {
        const isGoalieTeam = id.startsWith('G_');
        const p = infoMap[id];
        
        const displayName = isGoalieTeam ? `${id.replace('G_', '')} Goalies` : normalizeName(p?.full_name || 'Unknown');
        const teamAbbr = isGoalieTeam ? id.replace('G_', '') : (p?.team_abbr || '');
        const teamLogo = logoMap[teamAbbr] || '';
        
        return `
            <div class="popular-player-card">
                <div class="pick-count-badge">${count}</div>
                <img src="${teamLogo}" class="team-logo" alt="${teamAbbr}">
                <div class="player-info">
                    <span class="player-name">${displayName}</span>
                    <span class="player-meta">${teamAbbr} | ${isGoalieTeam ? 'G' : (p?.position || '---')}</span>
                </div>
            </div>
        `;
    }).join('');
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

function renderTable(standings) {
    const tbody = document.getElementById('standings-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    standings.forEach((s, index) => {
        const row = `
            <tr>
                <td class="pos-rank">${index + 1}</td>
                <td style="text-align: left;">
                    <a href="entry.html?id=${s.id}" class="manager-link">${s.manager}</a>
                </td>
                <td style="font-weight: bold;">${s.grandTotal.toFixed(1)}</td>
                <td>${s.active}</td>
                <td>${s.r1.toFixed(1)}</td>
                <td>${s.r2.toFixed(1)}</td>
                <td>${s.r3.toFixed(1)}</td>
                <td>${s.r4.toFixed(1)}</td>
                <td>${s.bracketPoints}</td> 
                <td style="text-align: left;">${s.cupWinnerStr}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    bindSortingEvents();
}

// FIX: Pulls score blocks properly using the nested .fantasy_points layer from your JSON
function getPlayerPoints(id, infoMap, statsMap) {
    let lookupName;
    const isGoalieTeam = typeof id === 'string' && id.startsWith('G_');

    if (isGoalieTeam) {
        lookupName = id;
    } else {
        const pInfo = infoMap[id];
        lookupName = pInfo?.full_name ? normalizeName(pInfo.full_name) : 'Unknown';
    }

    const rawPlayerCard = statsMap[lookupName];
    
    // Fallback block if the stats mapping for this lookupName is unrecorded or missing
    if (!rawPlayerCard || !rawPlayerCard.fantasy_points) {
        return { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
    }

    // Extract the points securely from the inner fantasy_points structure
    const fp = rawPlayerCard.fantasy_points;
    return {
        r1: parseFloat(fp.r1 || 0),
        r2: parseFloat(fp.r2 || 0),
        r3: parseFloat(fp.r3 || 0),
        r4: parseFloat(fp.r4 || 0),
        total: parseFloat(fp.total || 0)
    };
}

function updateCounts(id, infoMap, eliminatedTeams, countsMap) {
    let teamAbbr;
    let isAlive = 0;

    if (typeof id === 'string' && id.startsWith('G_')) {
        teamAbbr = id.split('_')[1];
    } else {
        teamAbbr = infoMap[id]?.team_abbr;
    }

    if (teamAbbr === "VEG") teamAbbr = "VGK";

    if (teamAbbr && !eliminatedTeams.includes(teamAbbr)) {
        isAlive = 1; 
    }

    if (id) {
        countsMap[id] = (countsMap[id] || 0) + 1;
    }

    return isAlive;
}

function bindSortingEvents() {
    const headers = document.querySelectorAll('#standings-table th');
    headers.forEach((header, index) => {
        if (header.classList.contains('pos-rank')) return;

        header.addEventListener('click', () => {
            const table = document.getElementById('standings-table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const isAscending = header.classList.contains('sort-asc');

            headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

            rows.sort((a, b) => {
                let cellA = a.children[index].textContent.trim();
                let cellB = b.children[index].textContent.trim();

                const valA = isNaN(cellA.replace(/,/g, '')) ? cellA.toLowerCase() : parseFloat(cellA.replace(/,/g, ''));
                const valB = isNaN(cellB.replace(/,/g, '')) ? cellB.toLowerCase() : parseFloat(cellB.replace(/,/g, ''));

                if (valA < valB) return isAscending ? 1 : -1;
                if (valA > valB) return isAscending ? -1 : 1;
                return 0;
            });

            header.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

initStandings();