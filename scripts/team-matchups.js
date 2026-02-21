const params = new URLSearchParams(window.location.search);
const team1Id = params.get('team1');
const team2Id = params.get('team2');
const weekNum = params.get('week') || "1";

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
        const [teams, standings, matchups, playersMetaRaw] = await Promise.all([
            fetch('/fantasy-hockey/data/league_teams.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/2025_standings.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/2025_matchups.json').then(r => r.json()),
            fetch('/fantasy-hockey/data/players.json').then(r => r.json())
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

        // 3. Load Team Logs (Now that we have the IDs)
        const [log1, log2] = await Promise.all([
            fetch(`/fantasy-hockey/data/team_logs/team_${team1Id}_log.json`).then(r => r.json()),
            fetch(`/fantasy-hockey/data/team_logs/team_${team2Id}_log.json`).then(r => r.json())
        ]);

        // 4. Render Hero Section
        renderTeamHero(1, team1Id, teams, standings);
        renderTeamHero(2, team2Id, teams, standings);

        // 5. Aggregate Stats and Render Rosters (Pass everything needed)
        renderRosterFromLogs(1, log1, dateRange, playersMeta);
        renderRosterFromLogs(2, log2, dateRange, playersMeta);

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

function renderRosterFromLogs(index, teamLog, range, playersMeta) {
    const tbody = document.getElementById(`team${index}-body`);
    const scoreEl = document.getElementById(`team${index}-score`);
    if (!tbody || !teamLog.log) return;

    const playerAggregator = {};
    let totalTeamPoints = 0;

    Object.keys(teamLog.log).forEach(date => {
        if (date >= range.start && date <= range.end) {
            const dayPlayers = teamLog.log[date].players;
            dayPlayers.forEach(p => {
                const id = String(p.player_id);
                if (!playerAggregator[id]) {
                    playerAggregator[id] = {
                        id: id,
                        name: p.player_name,
                        points: 0
                    };
                }
                const points = calculatePointsFromLog(p.stats, p.position_status === 'G');
                playerAggregator[id].points += points;

                if (p.position_status !== 'BN' && p.position_status !== 'IR+') {
                    totalTeamPoints += points;
                }
            });
        }
    });

    tbody.innerHTML = '';
    Object.values(playerAggregator)
        .sort((a, b) => b.points - a.points)
        .forEach(p => {
            const meta = playersMeta[p.id] || {};
            const headshot = meta.headshot_url || 'https://s.yimg.com/it/i/fifa/nopic_60x60.png';
            
            // Format eligible positions (e.g., "C,LW,RW")
            const positions = (meta.eligible_positions || [])
                .filter(pos => pos !== 'Util' && pos !== 'BN')
                .join(',');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="player-cell-matchup">
                    <div class="player-container">
                        <img src="${headshot}" class="player-img" alt="${p.name}">
                        <div class="player-info-text">
                            <div class="player-name-link">${p.name}</div>
                            <div class="player-subtext">${meta.team_abbr || ''} - ${positions}</div>
                        </div>
                    </div>
                </td>
                <td class="points-cell">${p.points.toFixed(1)}</td>
            `;
            tbody.appendChild(row);
        });

    if (scoreEl) scoreEl.textContent = totalTeamPoints.toFixed(1);
}

function calculatePointsFromLog(s, isGoalie) {
    if (!s || Object.keys(s).length === 0) return 0;
    
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