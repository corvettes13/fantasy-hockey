const params = new URLSearchParams(window.location.search);
const team1Id = params.get('team1');
const team2Id = params.get('team2');

// Change this to 'let' and remove the default "1"
let weekNum = params.get('week'); 
let currentViewDate = "totals";

const SCORING_WEIGHTS = {
    "G": 3.0, "A": 2.0, "SOG": 0.2, "HIT": 0.1, "BLK": 0.3,
    "PIM": 0.2, "GW": 0.5, "SH": 2.0, "GA": -1.0, "SV": 0.2, "SO": 5.0,
    "W": 3.0, "L": -1.0, "GS": 1.0 // Standardizing goalie DEC/GS based on your teams.js logic
};

document.addEventListener('DOMContentLoaded', () => {
    loadMatchupFromLogs();
});
async function loadMatchupFromLogs() {
    try {
        const [teams, standings, matchups, playersMetaRaw, projections] = await Promise.all([
            fetch('/fantasy-hockey/data/league_teams.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/2025_standings.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/2025_matchups.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/players.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/player_projections.json').then(r => r.json())
        ]);
        
        const liveWeek = standings.teams[0].current_week;
        if (!weekNum) {
            weekNum = String(liveWeek);
        }

        const playersMeta = {};
        playersMetaRaw.players.forEach(p => {
            playersMeta[String(p.player_id)] = p;
        });
        
        const targetWeekInt = parseInt(weekNum);
        const isFutureWeek = targetWeekInt > liveWeek;

        const weekData = matchups.weeks[weekNum];
        if (!weekData) throw new Error("Week not found");
        setupWeekSwitcher(matchups);
        console.log(weekNum);
        // Inside loadMatchupFromLogs, after you have 'matchups' and 'weekNum'
        renderLeagueScoreboard(matchups.weeks[weekNum].matchups, weekNum);

        function renderLeagueScoreboard(allMatchups, week) {
            const container = document.getElementById('league-scoreboard');
            if (!container) return;
            container.innerHTML = '';

            // 1. Find the highest score across all 12 teams
            let highestScore = 0;
            allMatchups.forEach(m => {
                m.teams.forEach(t => {
                    const score = t.team.team_points.total;
                    if (score > highestScore) highestScore = score;
                });
            });

            // 2. Render the cards
            allMatchups.forEach(m => {
                const team1 = m.teams[0].team;
                const team2 = m.teams[1].team;

                const t1Score = team1.team_points.total;
                const t2Score = team2.team_points.total;

                // Flags for matchup leader and league high
                const t1Leading = t1Score > t2Score;
                const t2Leading = t2Score > t1Score;
                const t1IsHigh = t1Score === highestScore && highestScore > 0;
                const t2IsHigh = t2Score === highestScore && highestScore > 0;

                const matchupLink = `matchups.html?week=${week}&team1=${team1.team_id}&team2=${team2.team_id}`;
                
                const card = document.createElement('a');
                card.href = matchupLink;
                card.className = 'mini-matchup-card';
                
                // Highlight active matchup
                if ((team1.team_id == team1Id && team2.team_id == team2Id) || 
                    (team1.team_id == team2Id && team2.team_id == team1Id)) {
                    card.style.borderColor = '#0055a5';
                    card.style.background = '#f0f7ff';
                }

                card.innerHTML = `
                    ${renderMiniTeamRow(team1, t1Leading, t1IsHigh)}
                    ${renderMiniTeamRow(team2, t2Leading, t2IsHigh)}
                `;
                container.appendChild(card);
            });
        }

        function renderMiniTeamRow(t, isLeader, isLeagueHigh) {
            const currentScore = t.team_points.total.toFixed(1);
            let newProj = t.new_projected_total || 0.00;
            newProj = newProj.toFixed(1);
            const logo = t.team_logos.team_logo.url;
            
            const movesMade = t.roster_adds ? (t.roster_adds.value || 0) : 0;
            const movesDisplay = `${movesMade} of 5`;

            // Logic: apply 'mini-leader' for bold, 'league-high' for Money Green
            let scoreClass = 'mini-current-score';
            if (isLeader) scoreClass += ' mini-leader';
            if (isLeagueHigh) scoreClass += ' league-high';

            return `
                <div class="mini-team-row">
                    <div class="mini-team-info">
                        <img src="${logo}" class="mini-logo">
                        <span class="mini-name">${t.name}</span>
                    </div>
                    <div class="mini-score-group">
                        <span class="${scoreClass}">${currentScore}</span>
                        <span class="mini-proj-score"><i>Proj: ${newProj}</i></span>
                        <span class="mini-adds">${movesDisplay}</span>
                    </div>
                </div>
            `;
        }
        
        const dateRange = {
            start: weekData.matchups[0].week_start,
            end: weekData.matchups[0].week_end
        };
        
        // Inside loadMatchupFromLogs, after you find 'weekData'
        const team1Key = `465.l.13153.t.${team1Id}`;
        const team2Key = `465.l.13153.t.${team2Id}`;

        const currentMatchupData = weekData.matchups.find(m => 
            m.teams.some(t => t.team.team_key === team1Key)
        );

        if (currentMatchupData) {
            currentMatchupData.teams.forEach(t => {
                const side = t.team.team_key === team1Key ? 1 : 2;
                document.getElementById(`team${side}-skater-rem`).textContent = t.team.games_remaining_skaters || 0;
                document.getElementById(`team${side}-goalie-rem`).textContent = t.team.games_remaining_goalies || 0;
            });
        }
        
        // Inside loadMatchupFromLogs, after finding currentMatchupData
        if (currentMatchupData) {
            currentMatchupData.teams.forEach(t => {
                const side = t.team.team_key === team1Key ? 1 : 2;
                
                const initProj = t.team.initial_projection || 0;
                const newProj = t.team.new_projected_total || 0;

                // Update Initial Projection text
                document.getElementById(`team${side}-init-proj`).textContent = initProj.toFixed(1);

                // Update New Projection text and color
                const newProjEl = document.getElementById(`team${side}-new-proj`);
                const newProjContainer = document.getElementById(`team${side}-new-proj-container`);
                
                newProjEl.textContent = newProj.toFixed(1);

                // Apply Green/Red logic
                if (newProj > initProj) {
                    newProjContainer.classList.add('proj-better');
                    newProjContainer.classList.remove('proj-worse');
                } else if (newProj < initProj) {
                    newProjContainer.classList.add('proj-worse');
                    newProjContainer.classList.remove('proj-better');
                } else {
                    newProjContainer.classList.remove('proj-better', 'proj-worse');
                }
            });
        }

        renderDayTabs(dateRange, team1Id, team2Id);

        const [log1, log2] = await Promise.all([
            fetch(`/fantasy-hockey/data/team_logs/team_${team1Id}_log.json`).then(r => r.json()).catch(() => ({log:{}})),
            fetch(`/fantasy-hockey/data/team_logs/team_${team2Id}_log.json`).then(r => r.json()).catch(() => ({log:{}}))
        ]);

        renderTeamHero(1, team1Id, teams, standings);
        renderTeamHero(2, team2Id, teams, standings);

        // Render Roster
        renderRosterFromLogs(1, log1, dateRange, playersMeta, projections, teams);
        renderRosterFromLogs(2, log2, dateRange, playersMeta, projections, teams);

        // OVERRIDE SCORE IF FUTURE WEEK
        if (isFutureWeek) {
            overrideScoresWithProjections(weekData.matchups, team1Id, team2Id);
        }

    } catch (err) {
        console.error("Error loading log-based matchups:", err);
    }
}

function overrideScoresWithProjections(matchups, t1Id, t2Id) {
    // Find the specific matchup involving these two teams
    const team1Key = `465.l.13153.t.${t1Id}`;
    const team2Key = `465.l.13153.t.${t2Id}`;
    
    const matchup = matchups.find(m => 
        m.teams.some(t => t.team.team_key === team1Key) && 
        m.teams.some(t => t.team.team_key === team2Key)
    );

    if (matchup) {
        matchup.teams.forEach(t => {
            const scoreVal = t.team.initial_projection.toFixed(1);
            if (t.team.team_key === team1Key) {
                document.getElementById('team1-score').innerHTML = `<span class="proj-label">PROJ:</span> ${scoreVal}`;
            } else {
                document.getElementById('team2-score').innerHTML = `<span class="proj-label">PROJ:</span> ${scoreVal}`;
            }
        });
    }
}

function renderTeamHero(index, teamId, allTeams, standings) {
    const teamKey = `465.l.13153.t.${teamId}`;
    const teamData = allTeams.find(t => t.team_info.team_key === teamKey);
    const standingInfo = standings.teams.find(s => s.team_key === teamKey);

    if (!teamData || !standingInfo) return;

    // Set Logo
    document.getElementById(`team${index}-logo`).src = teamData.team_info.logo_url || standingInfo.manager.image_url;
    
    // Updated: Make Name Clickable
    const nameEl = document.getElementById(`team${index}-name`);
    const teamUrl = `/fantasy-hockey/teams/team.html?team=${teamId}`;
    nameEl.innerHTML = `<a href="${teamUrl}" class="hero-team-link">${teamData.team_info.name}</a>`;
    
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
    
    // Clear previous renders
    if (skaterBody) skaterBody.innerHTML = '';
    if (goalieBody) goalieBody.innerHTML = '';
    if (skaterFooter) skaterFooter.innerHTML = '';
    if (goalieFooter) goalieFooter.innerHTML = '';

    if (!skaterBody || !goalieBody || !teamLog.log) return;

    // Trackers for current roster and counts
    const teamKey = `465.l.13153.t.${index === 1 ? team1Id : team2Id}`;
    const currentTeamData = teams.find(t => t.team_info.team_key === teamKey);
    const currentRosterKeys = new Set(currentTeamData?.roster.map(p => p.player_key) || []);

    const skaters = {};
    const goalies = {};
    const activeSkaterTotals = { points: 0, 1: 0, 2: 0, 5: 0, 9: 0, 12: 0, 14: 0, 32: 0, 31: 0 };
    const activeGoalieTotals = { points: 0, 18: 0, 19: 0, 20: 0, 22: 0, 25: 0, 27: 0 };
    
    let activeSkaterGP = 0;
    let activeGoalieGP = 0;

    // Generate array of dates for the matchup week
    let start = new Date(range.start + "T12:00:00");
    const end = new Date(range.end + "T12:00:00");
    const datesInRange = [];
    while (start <= end) {
        datesInRange.push(start.toISOString().split('T')[0]);
        start.setDate(start.getDate() + 1);
    }
    
    const today = new Date();
    const todayStr = today.getFullYear() + "-" +
                     String(today.getMonth() + 1).padStart(2, "0") + "-" +
                     String(today.getDate()).padStart(2, "0");


    datesInRange.forEach(date => {
        const isSingleDateView = (currentViewDate !== "totals" && currentViewDate === date);
        const isTotalsView = (currentViewDate === "totals");

        if (!isSingleDateView && !isTotalsView) return;

        const dayLog = teamLog.log[date];

        // 1. Process Actual Logs (ONLY for Past Dates)
        // Since stats update the next day, we ignore dayLogs for today or future.
        if (dayLog && date < todayStr) {
            dayLog.players.forEach(p => {
                const isActive = p.position_status !== 'BN' && p.position_status !== 'IR' && p.position_status !== 'IR+';
                const hasStats = p.stats && Object.keys(p.stats).length > 0;

                // If we are looking at a specific single date (Past Tab), 
                // ONLY process the player if they were in a starting position.
                if (isSingleDateView && !isActive) return; 

                // If we are looking at the "Totals" view, we still want to see the player
                // in the list if they were active AT LEAST ONCE during the week.
                // ----------------

                if (!hasStats) return;

                if (isActive) {
                    if (p.position_status === 'G') activeGoalieGP++;
                    else activeSkaterGP++;
                }

                processPlayerData(
                    String(p.player_id),
                    p.stats,
                    p.position_status,
                    skaters,
                    goalies,
                    activeSkaterTotals,
                    activeGoalieTotals,
                    playersMeta,
                    false, 
                    isActive 
                );
            });
        }

        // 2. Process Projections (For Today and Future Dates)
        // Only displayed when a user clicks into a specific day tab.
        if (isSingleDateView && date >= todayStr) {
            Object.keys(projections).forEach(playerKey => {
                if (!currentRosterKeys.has(playerKey)) return;

                const playerProj = projections[playerKey];
                const id = String(playerProj.player_id);
                const projPoints = playerProj[date];

                if (projPoints && projPoints > 0) {
                    processPlayerData(
                        id,
                        { "pointsOnly": projPoints },
                        "Util",
                        skaters,
                        goalies,
                        activeSkaterTotals,
                        activeGoalieTotals,
                        playersMeta,
                        true, // isProjected
                        false // Projections NEVER count toward the hard Matchup Total
                    );
                }
            });
        }
    });

    // Update Games Played Display
    const skGPDisplay = document.getElementById(`team${index}-skater-gp`);
    const goGPDisplay = document.getElementById(`team${index}-goalie-gp`);
    if (skGPDisplay) skGPDisplay.textContent = activeSkaterGP;
    if (goGPDisplay) goGPDisplay.textContent = activeGoalieGP;

    // Render Table Rows
    renderSkaterRows(skaterBody, skaters, playersMeta);
    renderGoalieRows(goalieBody, goalies, playersMeta);
    
    // Render the Totals/Footer
    renderTotalsFooter(skaterFooter, activeSkaterTotals, 'skater');
    renderTotalsFooter(goalieFooter, activeGoalieTotals, 'goalie');

    // Update Header Score (only if not a future week override)
    const totalScore = activeSkaterTotals.points + activeGoalieTotals.points;
    const scoreEl = document.getElementById(`team${index}-score`);
    // Check if score is currently overridden by 'initial_projection' label
    if (scoreEl && !scoreEl.innerHTML.includes('PROJ:')) {
        scoreEl.textContent = totalScore.toFixed(1);
    }
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

    if (!targetMap[id]) {
        targetMap[id] = { 
            id, 
            name: playersMeta[id]?.full_name || "Unknown Player", 
            stats: {}, 
            points: 0,
            isProjected: false 
        };
    }

    const dayPoints = calculatePointsFromLog(stats, isG);

    if (isProjected) {
        targetMap[id].isProjected = true;
        targetMap[id].points += dayPoints; 
    } else if (shouldCount) {
        // This is the gatekeeper for historical points
        targetMap[id].points += dayPoints;
    }

    // Logic for Matchup Totals (Footer & Header Score):
    if (shouldCount && !isProjected) {
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

function overrideScoresWithProjections(matchups, t1Id, t2Id) {
    // Find the specific matchup involving these two teams
    const team1Key = `465.l.13153.t.${t1Id}`;
    const team2Key = `465.l.13153.t.${t2Id}`;
    
    const matchup = matchups.find(m => 
        m.teams.some(t => t.team.team_key === team1Key) && 
        m.teams.some(t => t.team.team_key === team2Key)
    );

    if (matchup) {
        matchup.teams.forEach(t => {
            const scoreVal = t.team.initial_projection.toFixed(1);
            if (t.team.team_key === team1Key) {
                document.getElementById('team1-score').innerHTML = `<span class="proj-label">PROJ:</span> ${scoreVal}`;
            } else {
                document.getElementById('team2-score').innerHTML = `<span class="proj-label">PROJ:</span> ${scoreVal}`;
            }
        });
    }
}

function setupWeekSwitcher(matchupsData) {
    const dropdown = document.getElementById('week-selector-dropdown');
    const prevBtn = document.getElementById('prev-week');
    const nextBtn = document.getElementById('next-week');
    if (!dropdown) return;

    // 1. Populate Dropdown with all available weeks
    const availableWeeks = Object.keys(matchupsData.weeks).sort((a, b) => a - b);
    dropdown.innerHTML = '';
    
    availableWeeks.forEach(w => {
        const option = document.createElement('option');
        option.value = w;
        option.textContent = w;
        if (w === weekNum) option.selected = true;
        dropdown.appendChild(option);
    });

    // 2. Handle Dropdown Change
    dropdown.onchange = (e) => {
        navigateToWeek(e.target.value);
    };

    // 3. Handle Arrows
    const currentIndex = availableWeeks.indexOf(weekNum);
    
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= availableWeeks.length - 1;

    prevBtn.onclick = () => {
        if (currentIndex > 0) navigateToWeek(availableWeeks[currentIndex - 1]);
    };

    nextBtn.onclick = () => {
        if (currentIndex < availableWeeks.length - 1) navigateToWeek(availableWeeks[currentIndex + 1]);
    };
}

function navigateToWeek(newWeek) {
    // Keep the same teams but change the week
    const newUrl = `matchups.html?week=${newWeek}&team1=${team1Id}&team2=${team2Id}`;
    window.location.href = newUrl;
}

function setupWeekSwitcher(matchupsData) {
    const dropdown = document.getElementById('week-selector-dropdown');
    const prevBtn = document.getElementById('prev-week');
    const nextBtn = document.getElementById('next-week');
    if (!dropdown) return;

    const availableWeeks = Object.keys(matchupsData.weeks).sort((a, b) => a - b);
    dropdown.innerHTML = '';
    
    availableWeeks.forEach(w => {
        const option = document.createElement('option');
        option.value = w;
        option.textContent = w;
        if (w === weekNum) option.selected = true;
        dropdown.appendChild(option);
    });

    dropdown.onchange = (e) => navigateToWeek(e.target.value);

    const currentIndex = availableWeeks.indexOf(weekNum);
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= availableWeeks.length - 1;

    prevBtn.onclick = () => navigateToWeek(availableWeeks[currentIndex - 1]);
    nextBtn.onclick = () => navigateToWeek(availableWeeks[currentIndex + 1]);
}