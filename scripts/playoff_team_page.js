const WORKER_ENDPOINT = '/view-entry';
const PLAYERS_JSON = '/fantasy-hockey/data/players.json';
const TEAMS_JSON = '/fantasy-hockey/teams/nhl_teams.json';

async function init() {
    const params = new URLSearchParams(window.location.search);
    const entryId = params.get('id');
    
    if (!entryId) {
        document.getElementById('roster-body').innerHTML = '<tr><td colspan="6">No Entry ID found.</td></tr>';
        return;
    }

    try {
        const [entryRes, playersRes, nhlTeamsRes] = await Promise.all([
            fetch(`${WORKER_ENDPOINT}?id=${entryId}`),
            fetch(PLAYERS_JSON).then(res => res.json()),
            fetch(TEAMS_JSON).then(res => res.json())
        ]);

        if (!entryRes.ok) throw new Error("Entry not found.");
        
        const entryData = await entryRes.json();
        const playerMap = Object.fromEntries(playersRes.players.map(p => [p.player_id, p]));
        const nhlTeamMap = Object.fromEntries(nhlTeamsRes.map(t => [t.team_abbreviation, t.logo_url]));

        renderEntry(entryData, playerMap, nhlTeamMap);
    } catch (err) {
        console.error(err);
        document.getElementById('roster-body').innerHTML = `<tr><td colspan="6">Error: ${err.message}</td></tr>`;
    }
}

function renderEntry(data, playerMap, nhlTeamMap) {
    // Sidebar & Header Info
    document.getElementById('page-title').textContent = `${data.managerName}'s Picks`;
    document.getElementById('display-manager').textContent = data.managerName;
    document.getElementById('display-id').textContent = data.entryId;
    document.getElementById('display-date').textContent = new Date(data.submittedAt).toLocaleDateString();

    // Stanley Cup Pick + Logo
    const cupWinnerAbbr = data.cupWinner; // e.g., "COL" or "OTT"
    const cupLogoUrl = nhlTeamMap[cupWinnerAbbr];
    
    document.getElementById('display-cup').textContent = cupWinnerAbbr;
    if (cupLogoUrl) {
        document.getElementById('cup-logo-container').innerHTML = `
            <img src="${cupLogoUrl}" alt="${cupWinnerAbbr}" style="width: 60px; height: auto; display: block; margin: 0 auto;">
        `;
    }

    // Roster Table Rendering (Same as before)
    const rosterBody = document.getElementById('roster-body');
    rosterBody.innerHTML = ''; 
    const allIds = [...data.roster.F, ...data.roster.D, ...data.roster.G];

    allIds.forEach(id => {
        const p = playerMap[id];
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
                <td>-</td><td>-</td><td>-</td><td>-</td>
                <td><strong>0</strong></td>
            </tr>`;
        rosterBody.insertAdjacentHTML('beforeend', row);
    });

    // Matchup Grid Rendering (Same as before)
    const matchupContainer = document.getElementById('matchup-container');
    matchupContainer.innerHTML = ''; // Clear previous
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

init();