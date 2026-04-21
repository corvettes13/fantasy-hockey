const WORKER_ALL_ENTRIES = '/list-entries'; 
const SKATER_STATS = '/fantasy-hockey/data/2026_playoff_skater_stats.json';
const GOALIE_STATS = '/fantasy-hockey/data/2026_playoff_goalie_stats.json';
const PLAYERS_JSON = '/fantasy-hockey/data/players.json';

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

        // Calculate data for each manager
        const standings = entriesRes.map(entry => {
            let r1 = 0, r2 = 0, r3 = 0, r4 = 0, totalRoster = 0;
            let activePlayersCount = 0;

            const allIds = [...entry.roster.F, ...entry.roster.D, ...entry.roster.G];
            
            allIds.forEach(id => {
                const pInfo = playerInfoMap[id];
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
                activePlayers: activePlayersCount,
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