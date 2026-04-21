const WORKER_ENDPOINT = '/view-entry';
const PLAYERS_JSON = '/fantasy-hockey/data/players.json';
const TEAMS_JSON = '/fantasy-hockey/teams/nhl_teams.json';
const SKATER_STATS_JSON = '/fantasy-hockey/data/2026_playoff_skater_stats.json';
const GOALIE_STATS_JSON = '/fantasy-hockey/data/2026_playoff_goalie_stats.json';

async function init() {
    const params = new URLSearchParams(window.location.search);
    const entryId = params.get('id');
    
    if (!entryId) {
        document.getElementById('roster-body').innerHTML = '<tr><td colspan="7">No Entry ID found.</td></tr>';
        return;
    }

    try {
        const [entryRes, playersRes, nhlTeamsRes, skaterStatsRes, goalieStatsRes] = await Promise.all([
            fetch(`${WORKER_ENDPOINT}?id=${entryId}`),
            fetch(PLAYERS_JSON).then(res => res.json()),
            fetch(TEAMS_JSON).then(res => res.json()),
            fetch(SKATER_STATS_JSON).then(res => res.json()),
            fetch(GOALIE_STATS_JSON).then(res => res.json())
        ]);

        if (!entryRes.ok) throw new Error("Entry not found.");
        
        const entryData = await entryRes.json();
        const playerMap = Object.fromEntries(playersRes.players.map(p => [p.player_id, p]));
        const nhlTeamMap = Object.fromEntries(nhlTeamsRes.map(t => [t.team_abbreviation, t.logo_url]));

        // Combine Skaters and Goalies into one map indexed by Name
        // This is where we get the .fantasy_points object we created in Python
        const statsMap = {};
        [...skaterStatsRes, ...goalieStatsRes].forEach(p => {
            statsMap[p.Player] = p.fantasy_points;
        });
        
        renderEntry(entryData, playerMap, nhlTeamMap, statsMap);
        makeTableSortable();
    } catch (err) {
        console.error(err);
        document.getElementById('roster-body').innerHTML = `<tr><td colspan="7">Error loading data: ${err.message}</td></tr>`;
    }
}

function renderEntry(data, playerMap, nhlTeamMap, statsMap) {
    let rosterTotal = 0;
    // Sidebar & Header Info
    document.getElementById('page-title').textContent = `${data.managerName}'s Picks`;
    document.getElementById('display-manager').textContent = data.managerName;
    document.getElementById('display-id').textContent = data.entryId;
    document.getElementById('display-date').textContent = new Date(data.submittedAt).toLocaleDateString();

    // Stanley Cup Pick + Logo
    const cupWinnerAbbr = data.cupWinner;
    const cupLogoUrl = nhlTeamMap[cupWinnerAbbr];
    
    document.getElementById('display-cup').textContent = cupWinnerAbbr;
    if (cupLogoUrl) {
        document.getElementById('cup-logo-container').innerHTML = `
            <img src="${cupLogoUrl}" alt="${cupWinnerAbbr}" style="width: 60px; height: auto; display: block; margin: 0 auto;">
        `;
    }

    // 1. Render Player Rows
    const rosterBody = document.getElementById('roster-body');
    rosterBody.innerHTML = ''; 
    
    const allIds = [...data.roster.F, ...data.roster.D, ...data.roster.G];
    allIds.forEach(id => {
        const p = playerMap[id];
        
        // Find points in the statsMap using the player's full name
        const pts = statsMap[p?.full_name] || { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
        rosterTotal += pts.total;
        
        const logo = p ? (nhlTeamMap[p.team_abbr] || '') : '';
        const row = `
            <tr>
                <td class="player-cell">
                    <img src="${logo}" alt="logo" />
                    <div style="display:flex; flex-direction:column; text-align:left; line-height:1.1;">
                        <a href="${p?.url || '#'}" target="_blank" style="font-weight:bold; text-decoration:none; color:#0055a5; font-size:0.85rem;">
                            ${p?.full_name || 'Unknown'}
                        </a>
                        <span style="font-size:0.7rem; color:#666;">${p?.team_abbr || '---'} | ${p?.position || '---'}</span>
                    </div>
                </td>
                  <td>${pts.r1.toFixed(1)}</td>
                  <td>${pts.r2.toFixed(1)}</td>
                  <td>${pts.r3.toFixed(1)}</td>
                  <td>${pts.r4.toFixed(1)}</td>
                  <td style="color: #999;">—</td> 
                  <td><strong>${pts.total.toFixed(1)}</strong></td>
            </tr>`;
        rosterBody.insertAdjacentHTML('beforeend', row);
    });

    // 2. Add Matchup Points Summary Row
    const bracketTotal = 0;
    const matchupRow = `
        <tr style="background-color: #f9f9f9; border-top: 2px solid #ddd;">
            <td style="text-align: left; padding-left: 10px; font-weight: bold;">Matchup Picks Total</td>
            <td>-</td><td>-</td><td>-</td><td>-</td>
            <td style="font-weight: bold; color: #0055a5;">0</td> 
            <td style="background-color: #eaf0f6;"><strong>0</strong></td>
        </tr>`;
    rosterBody.insertAdjacentHTML('beforeend', matchupRow);

    // 3. Matchup Grid
    const grandTotal = (rosterTotal + bracketTotal).toFixed(1);
    
    const totalEl = document.getElementById('display-total');
    if (totalEl) {
        totalEl.textContent = grandTotal;
    }
    const matchupContainer = document.getElementById('matchup-container');
    matchupContainer.innerHTML = '';
    const labels = {
        r1w1: "COL vs LAK", r1w2: "DAL vs MIN", r1w3: "VGK vs UTA", r1w4: "EDM vs ANA",
        r1e1: "CAR vs OTT", r1e2: "BUF vs BOS", r1e3: "TBL vs MTL", r1e4: "PIT vs PHI"
    };

    Object.entries(data.bracket).forEach(([key, pick]) => {
        const item = document.createElement('div');
        item.className = 'matchup-item';
        item.innerHTML = `<strong>${labels[key] || key}:</strong><br>${pick}`;
        matchupContainer.appendChild(item);
    });
}

// Start the process
init();