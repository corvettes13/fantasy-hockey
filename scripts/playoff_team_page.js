const WORKER_ENDPOINT = '/view-entry';
const PLAYERS_JSON = '/fantasy-hockey/data/players.json';
const TEAMS_JSON = '/fantasy-hockey/teams/nhl_teams.json';
const SKATER_STATS_JSON = '/fantasy-hockey/data/2026_playoff_skater_stats.json';
const GOALIE_STATS_JSON = '/fantasy-hockey/data/2026_playoff_goalie_stats.json';
const MATCHUPS_JSON = '/fantasy-hockey/data/playoff_matchups.json';

function normalizeName(name) {
    if (!name) return "";
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const entryId = params.get('id');
    
    if (!entryId) {
        document.getElementById('roster-body').innerHTML = '<tr><td colspan="7">No Entry ID found.</td></tr>';
        return;
    }

    try {
        // Added matchupData to the fetch
        const [entryRes, playersRes, nhlTeamsRes, skaterStatsRes, goalieStatsRes, matchupRes] = await Promise.all([
            fetch(`${WORKER_ENDPOINT}?id=${entryId}`),
            fetch(PLAYERS_JSON).then(res => res.json()),
            fetch(TEAMS_JSON).then(res => res.json()),
            fetch(SKATER_STATS_JSON).then(res => res.json()),
            fetch(GOALIE_STATS_JSON).then(res => res.json()),
            fetch(MATCHUPS_JSON).then(res => res.json())
        ]);

        if (!entryRes.ok) throw new Error("Entry not found.");
        
        const entryData = await entryRes.json();
        const playerMap = Object.fromEntries(playersRes.players.map(p => [p.player_id, p]));
        const nhlTeamMap = Object.fromEntries(nhlTeamsRes.map(t => [t.team_abbreviation, t.logo_url]));
        const matchupData = matchupRes; // Contains active_teams array

        const statsMap = {};
        [...skaterStatsRes, ...goalieStatsRes].forEach(p => {
            statsMap[p.Player] = p.fantasy_points;
        });
        
        // Pass matchupData to the render function
        renderEntry(entryData, playerMap, nhlTeamMap, statsMap, matchupData);
        makeTableSortable();
    } catch (err) {
        console.error(err);
        document.getElementById('roster-body').innerHTML = `<tr><td colspan="7">Error loading data: ${err.message}</td></tr>`;
    }
}

function renderEntry(data, playerMap, nhlTeamMap, statsMap, matchupData) {
    document.getElementById('page-title').textContent = `${data.managerName}'s Picks`;
    document.getElementById('display-manager').textContent = data.managerName;
    document.getElementById('display-id').textContent = data.entryId;
    document.getElementById('display-date').textContent = new Date(data.submittedAt).toLocaleDateString();
    const activeSuppRound = data.supplemental_round;

    const cupWinnerAbbr = data.cupWinner;
    const cupLogoUrl = nhlTeamMap[cupWinnerAbbr];
    document.getElementById('display-cup').textContent = cupWinnerAbbr;
    if (cupLogoUrl) {
        document.getElementById('cup-logo-container').innerHTML = `
            <img src="${cupLogoUrl}" alt="${cupWinnerAbbr}" style="width: 60px; height: auto; display: block; margin: 0 auto;">
        `;
    }
    let rosterTotal = 0;
    let bracketTotal = 0;
    
    // Check if this entry has supplemental picks for specific rounds
    const suppPicksR2 = data.supplemental?.r2 || [];
    const suppPicksR3 = data.supplemental?.r3 || [];
    const suppPicksR4 = data.supplemental?.r4 || [];

    const rosterBody = document.getElementById('roster-body');
    rosterBody.innerHTML = ''; 
    
    // Combine base roster with ALL supplemental picks
    const allIds = [
        ...data.roster.F, 
        ...data.roster.D, 
        ...data.roster.G,
        ...suppPicksR2,
        ...suppPicksR3,
        ...suppPicksR4
    ]; 
     
    allIds.forEach(id => {
        const p = playerMap[id];
        const isGoalieTeam = typeof id === 'string' && id.startsWith('G_');
        const cleanPlayerName = p?.full_name ? normalizeName(p.full_name) : 'Unknown';
        const displayName = isGoalieTeam ? `${id.split('_')[1]} Goalies` : cleanPlayerName;
        const teamAbbr = isGoalieTeam ? id.split('_')[1] : (p?.team_abbr || '---');
        const pts = statsMap[isGoalieTeam ? id : cleanPlayerName] || { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };

        // --- SUPPLEMENTAL LOGIC ---
        let effectiveR1 = pts.r1;
        let effectiveR2 = pts.r2;
        let effectiveR3 = pts.r3;

        let styleR1 = "";
        let styleR2 = "";
        let styleR3 = "";

        if (suppPicksR2.includes(id)) {
            effectiveR1 = 0;
            styleR1 = 'style="color: #ccc; background-color: #fdfdfd;"';
        } 
        
        if (suppPicksR3.includes(id)) {
            effectiveR1 = 0;
            effectiveR2 = 0;
            styleR1 = styleR2 = 'style="color: #ccc; background-color: #fdfdfd;"';
        }

        if (suppPicksR4.includes(id)) {
            effectiveR1 = 0;
            effectiveR2 = 0;
            effectiveR3 = 0;
            styleR1 = styleR2 = styleR3 = 'style="color: #ccc; background-color: #fdfdfd;"';
        }

        const playerTotal = effectiveR1 + effectiveR2 + effectiveR3 + pts.r4;
        rosterTotal += playerTotal;

        const logo = nhlTeamMap[teamAbbr] || '';
        const isEliminated = !matchupData.active_teams.includes(teamAbbr);
        const rowClass = isEliminated ? 'class="contract-red"' : '';
        
        const row = `
            <tr ${rowClass}>
              <td class="player-cell">
                  <img src="${logo}" alt="logo" style="width:28px; height:28px;" />
                  <div style="display:flex; flex-direction:column; text-align:left; line-height:1.1;">
                      <a href="${isGoalieTeam ? '#' : (p?.url || '#')}" target="_blank" style="font-weight:bold; text-decoration:none; color:#0055a5; font-size:0.85rem;">
                          ${displayName}
                      </a>
                      <span style="font-size:0.7rem; color:#666;">${teamAbbr} | ${isGoalieTeam ? 'G' : (p?.position || '---')}</span>
                  </div>
              </td>
              <td ${styleR1}>${pts.r1.toFixed(1)}</td>
              <td ${styleR2}>${pts.r2.toFixed(1)}</td>
              <td ${styleR3}>${pts.r3.toFixed(1)}</td>
              <td>${pts.r4.toFixed(1)}</td>
              <td style="color: #999;">—</td> 
              <td><strong>${playerTotal.toFixed(1)}</strong></td>
            </tr>`;
        rosterBody.insertAdjacentHTML('beforeend', row);
    });
    
    const matchupContainer = document.getElementById('matchup-container');
    matchupContainer.innerHTML = '';

    Object.entries(matchupData.rounds).forEach(([roundKey, roundData]) => {
        Object.entries(roundData.matchups).forEach(([matchupId, status]) => {
            const userPick = data.bracket[matchupId];
            const winner = status.winner;
            const matchupLabel = status.label || matchupId; 
            const ptsWorth = roundData.points_per_pick;
            
            let statusClass = '';
            let ptsDisplay = '';

            if (winner) {
                if (userPick === winner) {
                    statusClass = 'correct';
                    ptsDisplay = `<span class="pts-badge plus">+${ptsWorth} pts</span>`;
                    bracketTotal += ptsWorth;
                } else {
                    statusClass = 'incorrect';
                    ptsDisplay = `<span class="pts-badge zero">+0 pts</span>`;
                }
            }

            const item = document.createElement('div');
            item.className = `matchup-item ${statusClass}`;
            item.innerHTML = `
                <div style="font-size: 0.7rem; color: #666;">${matchupLabel}</div>
                <strong style="font-size: 0.9rem;">${userPick || 'No Pick'}</strong>
                ${ptsDisplay}
            `;
            matchupContainer.appendChild(item);
        });
    });

    const matchupRow = `
            <tr style="background-color: #f9f9f9; border-top: 2px solid #ddd;">
                <td style="text-align: left; padding-left: 10px; font-weight: bold;">Matchup Picks Total</td>
                <td>-</td><td>-</td><td>-</td><td>-</td>
                <td style="font-weight: bold; color: #0055a5;">${bracketTotal}</td> 
                <td style="background-color: #eaf0f6;"><strong>${bracketTotal}</strong></td>
            </tr>`;
    rosterBody.insertAdjacentHTML('beforeend', matchupRow);

    // --- NEW: CALCULATE AND DISPLAY STANLEY CUP WINNER BONUS ---
    let cupBonusPoints = 0;
    const officialWinner = matchupData.stanley_cup_winner;
    const bonusValue = matchupData.stanley_cup_points || 0;

    if (officialWinner && data.cupWinner) {
        const cleanManagerPick = data.cupWinner.trim().toUpperCase();
        const cleanOfficialWinner = officialWinner.trim().toUpperCase();

        // Safely evaluate both abbreviation matches or spelled-out "CAROLINA" string entries
        if (cleanManagerPick === cleanOfficialWinner || cleanManagerPick === "CAROLINA") {
            cupBonusPoints = bonusValue;
        }
    }

    // Add the summary row to show the champion bonus in the grid
    const cupBonusRow = `
            <tr style="background-color: #fff9e6; border-top: 1px dashed #ffcc00;">
                <td style="text-align: left; padding-left: 10px; font-weight: bold; color: #b38600;">🏆 Stanley Cup Pick Bonus</td>
                <td>-</td><td>-</td><td>-</td><td>-</td>
                <td style="font-weight: bold; color: #b38600;">+${cupBonusPoints}</td> 
                <td style="background-color: #fff2cc; color: #b38600;"><strong>${cupBonusPoints}</strong></td>
            </tr>`;
    rosterBody.insertAdjacentHTML('beforeend', cupBonusRow);

    // --- 5. Update Sidebar Grand Total (Now incorporating cup bonus points!) ---
    const grandTotal = (rosterTotal + bracketTotal + cupBonusPoints).toFixed(1);
    const totalEl = document.getElementById('display-total');
    if (totalEl) {
      totalEl.textContent = grandTotal;
    }
}

function makeTableSortable() {
    const table = document.querySelector('table');
    if (!table) return;
    const headers = table.querySelectorAll('th');
    const tbody = table.querySelector('tbody');

    headers.forEach((header, index) => {
        if (header.textContent.trim() === "" || header.textContent.includes("—")) return;

        header.style.cursor = 'pointer';
        header.title = "Click to sort";

        header.addEventListener('click', () => {
            const rows = Array.from(tbody.querySelectorAll('tr:not([style*="border-top"])'));
            const isAscending = header.classList.contains('sort-asc');
            
            headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

            rows.sort((a, b) => {
                let cellA = a.children[index].textContent.trim();
                let cellB = b.children[index].textContent.trim();
                const valA = isNaN(cellA) ? cellA.toLowerCase() : parseFloat(cellA);
                const valB = isNaN(cellB) ? cellB.toLowerCase() : parseFloat(cellB);
                if (valA < valB) return isAscending ? 1 : -1;
                if (valA > valB) return isAscending ? -1 : 1;
                return 0;
            });

            header.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
            rows.forEach(row => tbody.appendChild(row));
            const summaryRow = tbody.querySelector('tr[style*="border-top"]');
            if (summaryRow) tbody.appendChild(summaryRow);
        });
    });
}

init();