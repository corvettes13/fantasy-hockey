const WORKER_ENDPOINT = '/view-entry';
const PLAYERS_JSON = '/fantasy-hockey/data/players.json';
const TEAMS_JSON = '/fantasy-hockey/teams/nhl_teams.json';
const SKATER_STATS_JSON = '/fantasy-hockey/data/2026_playoff_skater_stats.json';
const GOALIE_STATS_JSON = '/fantasy-hockey/data/2026_playoff_goalie_stats.json';

function normalizeName(name) {
    if (!name) return "";
    // Normalizes accents/diacritics (e.g., Nečas -> Necas)
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
        const [entryRes, playersRes, nhlTeamsRes, skaterStatsRes, goalieStatsRes] = await Promise.all([
            fetch(`${WORKER_ENDPOINT}?id=${entryId}`),
            fetch(PLAYERS_JSON).then(res => res.json()),
            fetch(TEAMS_JSON).then(res => res.json()),
            fetch(SKATER_STATS_JSON).then(res => res.json()),
            fetch(GOALIE_STATS_JSON).then(res => res.json())
        ]);

        if (!entryRes.ok) throw new Error("Entry not found.");
        
        const entryData = await entryRes.json();
        // Map player IDs to their info
        const playerMap = Object.fromEntries(playersRes.players.map(p => [p.player_id, p]));
        // Map team abbreviations to logos
        const nhlTeamMap = Object.fromEntries(nhlTeamsRes.map(t => [t.team_abbreviation, t.logo_url]));

        // Create a single map for all stats
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

    // 1. Sidebar & Header Info
    document.getElementById('page-title').textContent = `${data.managerName}'s Picks`;
    document.getElementById('display-manager').textContent = data.managerName;
    document.getElementById('display-id').textContent = data.entryId;
    document.getElementById('display-date').textContent = new Date(data.submittedAt).toLocaleDateString();

    // 2. Stanley Cup Pick + Logo
    const cupWinnerAbbr = data.cupWinner;
    const cupLogoUrl = nhlTeamMap[cupWinnerAbbr];
    document.getElementById('display-cup').textContent = cupWinnerAbbr;
    if (cupLogoUrl) {
        document.getElementById('cup-logo-container').innerHTML = `
            <img src="${cupLogoUrl}" alt="${cupWinnerAbbr}" style="width: 60px; height: auto; display: block; margin: 0 auto;">
        `;
    }

    // 3. Render Player Rows
    const rosterBody = document.getElementById('roster-body');
    rosterBody.innerHTML = ''; 
    
    const allIds = [...data.roster.F, ...data.roster.D, ...data.roster.G];
        
        allIds.forEach(id => {
          const p = playerMap[id];
          const isGoalieTeam = typeof id === 'string' && id.startsWith('G_');
          
          // Normalize the name from playerMap before looking it up in statsMap
          const cleanPlayerName = p?.full_name ? normalizeName(p.full_name) : 'Unknown';
          
          const displayName = isGoalieTeam ? `${id.split('_')[1]} Goalies` : cleanPlayerName;
          const displayLink = isGoalieTeam ? '#' : (p?.url || '#');
          const teamAbbr = isGoalieTeam ? id.split('_')[1] : (p?.team_abbr || '---');
          
          // --- UPDATED STATS LOOKUP ---
          // We use the normalized cleanPlayerName to match the Python-generated stats
          const pts = statsMap[isGoalieTeam ? id : cleanPlayerName] || { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };

          rosterTotal += pts.total;
          const logo = nhlTeamMap[teamAbbr] || '';
          
          const row = `
            <tr>
              <td class="player-cell">
                  <img src="${logo}" alt="logo" style="width:28px; height:28px;" />
                  <div style="display:flex; flex-direction:column; text-align:left; line-height:1.1;">
                      <a href="${displayLink}" target="_blank" style="font-weight:bold; text-decoration:none; color:#0055a5; font-size:0.85rem;">
                          ${displayName}
                      </a>
                      <span style="font-size:0.7rem; color:#666;">${teamAbbr} | ${isGoalieTeam ? 'G' : (p?.position || '---')}</span>
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

    // 4. Add Matchup Points Summary Row
    const bracketTotal = 0;
    const matchupRow = `
        <tr style="background-color: #f9f9f9; border-top: 2px solid #ddd;">
            <td style="text-align: left; padding-left: 10px; font-weight: bold;">Matchup Picks Total</td>
            <td>-</td><td>-</td><td>-</td><td>-</td>
            <td style="font-weight: bold; color: #0055a5;">0</td> 
            <td style="background-color: #eaf0f6;"><strong>0</strong></td>
        </tr>`;
    rosterBody.insertAdjacentHTML('beforeend', matchupRow);

    // 5. Update Sidebar Grand Total
    const grandTotal = (rosterTotal + bracketTotal).toFixed(1);
    const totalEl = document.getElementById('display-total');
    if (totalEl) {
        totalEl.textContent = grandTotal;
    }

    // 6. Matchup Grid
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