const params = new URLSearchParams(window.location.search);
const team1Id = params.get('team1');
const team2Id = params.get('team2');
const weekNum = params.get('week') || "1";
let currentViewDate = "totals"; // Global state

const SCORING_WEIGHTS = {
    "G": 3.0, "A": 2.0, "SOG": 0.2, "HIT": 0.1, "BLK": 0.3,
    "PIM": 0.2, "GW": 0.5, "SH": 2.0, "GA": -1.0, "SV": 0.2, "SO": 5.0,
    "W": 3.0, "L": -1.0, "GS": 1.0 // Standardizing goalie DEC/GS based on your teams.js logic
};

document.addEventListener('DOMContentLoaded', () => {
    if (!team1Id || !team2Id) return;
    loadMatchupFromLogs();
});

async function loadMatchupFromLogs() {
    try {
        // 1. Fetch initial metadata
        const [teams, standings, matchups, playersMetaRaw, projections] = await Promise.all([
            fetch('/fantasy-hockey/data/league_teams.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/2025_standings.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/2025_matchups.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/players.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/player_projections.json').then(r => r.json()) // New Fetch
        ]);

        // Create the lookup map
        const playersMeta = {};
        playersMetaRaw.players.forEach(p => {
            playersMeta[String(p.player_id)] = p;
        });

        // 2. Get Date Range for the week
        const weekData = matchups.weeks[weekNum];
        if (!weekData) throw new Error("Week not found");
        
        const dateRange = {
            start: weekData.matchups[0].week_start,
            end: weekData.matchups[0].week_end
        };

        renderDayTabs(dateRange, team1Id, team2Id);

        // 3. Load Team Logs (Now that we have the IDs)
        const [log1, log2] = await Promise.all([
            fetch(`/fantasy-hockey/data/team_logs/team_${team1Id}_log.json`).then(r => r.json()),
            fetch(`/fantasy-hockey/data/team_logs/team_${team2Id}_log.json`).then(r => r.json())
        ]);

        // 4. Render Hero Section
        renderTeamHero(1, team1Id, teams, standings);
        renderTeamHero(2, team2Id, teams, standings);

        // 5. Aggregate Stats and Render Rosters (Only call these ONCE)
        renderRosterFromLogs(1, log1, dateRange, playersMeta, projections, teams);
        renderRosterFromLogs(2, log2, dateRange, playersMeta, projections, teams);

    } catch (err) {
        console.error("Error loading log-based matchups:", err);
    }
}

function renderTeamHero(index, teamId, allTeams, standings) {
    const teamKey = `465.l.13153.t.${teamId}`;
    const teamData = allTeams.find(t => t.team_info.team_key === teamKey);
    const standingInfo = standings.teams.find(s => s.team_key === teamKey);

    if (!teamData || !standingInfo) return;

    document.getElementById(`team${index}-logo`).src = teamData.team_info.logo_url || standingInfo.manager.image_url;
    document.getElementById(`team${index}-name`).textContent = teamData.team_info.name;
    document.getElementById(`team${index}-manager`).textContent = `${standingInfo.manager.nickname}`;
    
    const record = `${standingInfo.wins}-${standingInfo.losses}`;
    const rank = standingInfo.rank;
    const suffix = getOrdinalSuffix(rank);
    document.getElementById(`team${index}-meta`).innerHTML = `<strong>Record:</strong> ${record} | <strong>${rank}${suffix}</strong>`;
}

function renderRosterFromLogs(index, teamLog, range, playersMeta, projections, teams) {
    const skaterBody = document.getElementById(`team${index}-skaters-body`);
    const goalieBody = document.getElementById(`team${index}-goalies-body`);
    const skaterFooter = document.getElementById(`team${index}-skaters-footer`);
    const goalieFooter = document.getElementById(`team${index}-goalies-footer`);
    
    // NEW: Get the current roster player keys for THIS team
    const teamKey = `465.l.13153.t.${index === 1 ? team1Id : team2Id}`;
    const currentTeamData = teams.find(t => t.team_info.team_key === teamKey);
    const currentRosterKeys = new Set(currentTeamData?.roster.map(p => p.player_key) || []);
    
    if (!skaterBody || !goalieBody) return;

    const skaters = {};
    const goalies = {};
    const activeSkaterTotals = { points: 0, 1:0, 2:0, 5:0, 9:0, 12:0, 14:0, 32:0, 31:0 };
    const activeGoalieTotals = { points: 0, 18:0, 19:0, 20:0, 22:0, 25:0, 27:0 };

    // Create a set of all dates in the range to iterate through
    let start = new Date(range.start + "T12:00:00");
    const end = new Date(range.end + "T12:00:00");
    const datesInRange = [];
    while (start <= end) {
        datesInRange.push(start.toISOString().split('T')[0]);
        start.setDate(start.getDate() + 1);
    }

    datesInRange.forEach(date => {
        const isSingleDateView = (currentViewDate !== "totals" && currentViewDate === date);
        const isTotalsView = (currentViewDate === "totals");

        if (!isSingleDateView && !isTotalsView) return;

        const dayLog = teamLog.log[date];

        if (dayLog) {
            // ACTUAL STATS: Process normally (historical record)
            dayLog.players.forEach(p => {
                processPlayerData(String(p.player_id), p.stats, p.position_status, skaters, goalies, activeSkaterTotals, activeGoalieTotals, playersMeta, false, true);
            });
        } else if (isSingleDateView) {
            // PROJECTIONS: Only process if the user clicked a future date
            Object.keys(projections).forEach(playerKey => {
                
                // --- WHITELIST CHECK ---
                // Only show projections if the player is actually on the team right now
                if (!currentRosterKeys.has(playerKey)) return;

                const playerProj = projections[playerKey];
                const id = String(playerProj.player_id);
                
                if (playerProj[date]) {
                    const projPoints = playerProj[date];
                    processPlayerData(id, { "pointsOnly": projPoints }, "Util", skaters, goalies, activeSkaterTotals, activeGoalieTotals, playersMeta, true, false);
                }
            });
        }
    });

    renderSkaterRows(skaterBody, skaters, playersMeta);
    renderGoalieRows(goalieBody, goalies, playersMeta);
    
    renderTotalsFooter(skaterFooter, activeSkaterTotals, 'skater');
    renderTotalsFooter(goalieFooter, activeGoalieTotals, 'goalie');

    // Header score update
    const totalScore = activeSkaterTotals.points + activeGoalieTotals.points;
    document.getElementById(`team${index}-score`).textContent = totalScore.toFixed(1);
}

function renderTotalsFooter(footer, totals, type) {
    if (type === 'skater') {
        footer.innerHTML = `
            <tr class="totals-row">
                <td>TOTALS</td>
                <td>${totals.points.toFixed(1)}</td>
                <td>${totals[1]}</td><td>${totals[2]}</td><td>${totals[5].toFixed(0)}</td>
                <td>${totals[9]}</td><td>${totals[12]}</td><td>${totals[14]}</td>
                <td>${totals[32]}</td><td>${totals[31]}</td>
            </tr>`;
    } else {
        const svPct = (totals[25] + totals[22]) > 0 ? (totals[25] / (totals[25] + totals[22])).toFixed(3) : '.000';
        footer.innerHTML = `
            <tr class="totals-row">
                <td>ACTIVE TOTALS</td>
                <td>${totals.points.toFixed(1)}</td>
                <td>${totals[18]}</td><td>${totals[19]}</td><td>${totals[20]}</td>
                <td>${totals[22]}</td><td>${totals[25]}</td><td>${svPct}</td><td>${totals[27]}</td>
            </tr>`;
    }
}

function renderSkaterRows(tbody, data, playersMeta) {
    tbody.innerHTML = '';
    Object.values(data).sort((a,b) => b.points - a.points).forEach(p => {
        const m = playersMeta[p.id] || {};
        const s = p.stats;
        const pointDisplay = p.isProjected ? `<em>${p.points.toFixed(1)}*</em>` : p.points.toFixed(1);
        tbody.innerHTML += `
            <tr>
                <td class="player-cell-matchup">
                    <div class="player-container">
                        <img src="${m.headshot_url || ''}" class="player-img">
                        <div class="player-info-text">
                            <div class="player-name-link">${p.name}</div>
                            <div class="player-subtext">${m.team_abbr || ''} - ${m.eligible_positions?.filter(x=>x!=='Util').join(',')}</div>
                        </div>
                    </div>
                </td>
                <td class="fw-bold">${pointDisplay}</td>
                <td>${s[1]||0}</td><td>${s[2]||0}</td><td>${s[5]||0}</td>
                <td>${s[9]||0}</td><td>${s[12]||0}</td><td>${s[14]||0}</td>
                <td>${s[32]||0}</td><td>${s[31]||0}</td>
            </tr>`;
    });
}

function renderGoalieRows(tbody, data, playersMeta) {
    tbody.innerHTML = '';
    Object.values(data).sort((a,b) => b.points - a.points).forEach(p => {
        const m = playersMeta[p.id] || {};
        const s = p.stats;
        const pointDisplay = p.isProjected ? `<em>${p.points.toFixed(1)}*</em>` : p.points.toFixed(1);
        const svPct = (s[25] + s[22]) > 0 ? (s[25] / (s[25] + s[22])).toFixed(3) : '.000';
        
        tbody.innerHTML += `
            <tr>
                <td class="player-cell-matchup">
                    <div class="player-container">
                        <img src="${m.headshot_url || ''}" class="player-img">
                        <div class="player-info-text">
                            <div class="player-name-link">${p.name}</div>
                            <div class="player-subtext">${m.team_abbr || ''} - G</div>
                        </div>
                    </div>
                </td>
                <td class="fw-bold">${pointDisplay}</td>
                <td>${s[18]||0}</td><td>${s[19]||0}</td><td>${s[20]||0}</td>
                <td>${s[22]||0}</td><td>${s[25]||0}</td><td>${svPct}</td><td>${s[27]||0}</td>
            </tr>`;
    });
}

function calculatePointsFromLog(s, isGoalie) {
    if (!s) return 0;
    // If it's a projection, it won't have stat IDs, just the total
    if (s.pointsOnly) return s.pointsOnly;
    
    if (isGoalie) {
        return (
            (s[18] ?? 0) * SCORING_WEIGHTS.GS +
            (s[19] ?? 0) * SCORING_WEIGHTS.W +
            (s[20] ?? 0) * SCORING_WEIGHTS.L +
            (s[27] ?? 0) * SCORING_WEIGHTS.SO +
            (s[25] ?? 0) * SCORING_WEIGHTS.SV +
            (s[22] ?? 0) * SCORING_WEIGHTS.GA
        );
    } else {
        return (
            (s[1] ?? 0) * SCORING_WEIGHTS.G +
            (s[2] ?? 0) * SCORING_WEIGHTS.A +
            (s[5] ?? 0) * SCORING_WEIGHTS.PIM +
            (s[14] ?? 0) * SCORING_WEIGHTS.SOG +
            (s[31] ?? 0) * SCORING_WEIGHTS.HIT +
            (s[32] ?? 0) * SCORING_WEIGHTS.BLK +
            (s[12] ?? 0) * SCORING_WEIGHTS.GW +
            (s[9] ?? 0) * SCORING_WEIGHTS.SH
        );
    }
}

function getOrdinalSuffix(i) {
    var j = i % 10, k = i % 100;
    if (j == 1 && k != 11) return "st";
    if (j == 2 && k != 12) return "nd";
    if (j == 3 && k != 13) return "rd";
    return "th";
}

function renderDayTabs(range, t1, t2) {
    const tabContainer = document.getElementById('day-tabs');
    tabContainer.innerHTML = '';

    // 1. Create Totals Tab
    const totalsTab = createTab("Totals", "totals");
    tabContainer.appendChild(totalsTab);

    // 2. Create Date Tabs
    let start = new Date(range.start + "T12:00:00");
    const end = new Date(range.end + "T12:00:00");

    const todayStr = new Date().toISOString().split('T')[0];

    while (start <= end) {
        const dateStr = start.toISOString().split('T')[0];
        
        // If the page is first loading and no date is set, 
        // you could optionally default currentViewDate to todayStr
        // if (currentViewDate === "totals" && dateStr === todayStr) { ... }

        const label = start.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
        tabContainer.appendChild(createTab(label, dateStr));
        start.setDate(start.getDate() + 1);
    }
}

function createTab(label, value) {
    const li = document.createElement('li');
    li.className = `Navitem ${currentViewDate === value ? 'Selected' : ''}`;
    li.textContent = label;
    
    li.onclick = () => {
        // Only reload if the date actually changed
        if (currentViewDate !== value) {
            currentViewDate = value;
            loadMatchupFromLogs(); 
        }
    };
    return li;
}

function processPlayerData(id, stats, status, skaters, goalies, activeSkaterTotals, activeGoalieTotals, playersMeta, isProjected, shouldCount) {
    const isG = status === 'G' || (playersMeta[id] && playersMeta[id].primary_position === 'G');
    const targetMap = isG ? goalies : skaters;
    const isActive = status !== 'BN' && status !== 'IR' && status !== 'IR+';

    if (!targetMap[id]) {
        targetMap[id] = { 
            id, 
            name: playersMeta[id]?.full_name || "Unknown Player", 
            stats: {}, 
            points: 0,
            isProjected: false 
        };
    }

    if (isProjected) targetMap[id].isProjected = true;

    const dayPoints = calculatePointsFromLog(stats, isG);
    
    // Only add points to the player's total if they are "Active" and "Counting" (Actual Log Data)
    // OR if we are looking at a specific projection day
    if (shouldCount || isProjected) {
        targetMap[id].points += dayPoints;
    }

    if (isActive && shouldCount) {
        const teamTotals = isG ? activeGoalieTotals : activeSkaterTotals;
        teamTotals.points += dayPoints;

        Object.entries(stats || {}).forEach(([statId, val]) => {
            targetMap[id].stats[statId] = (targetMap[id].stats[statId] || 0) + val;
            const numId = Number(statId);
            if (teamTotals.hasOwnProperty(numId)) {
                teamTotals[numId] += val;
            }
        });
    }
}