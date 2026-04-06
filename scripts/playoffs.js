async function initBracket() {
    try {
        const [standingsRes, matchupsRes] = await Promise.all([
            fetch('data/2025_standings.json'),
            fetch('data/2025_matchups.json')
        ]);
        const standingsData = await standingsRes.json();
        const matchupsData = await matchupsRes.json();

        // 1. Map Ranks for Seed Display
        const rankMap = {};
        standingsData.teams.forEach(t => rankMap[t.team_id] = t.rank);
        
        // 2. Setup Context
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        // Fix: Use standings current_week as fallback if date logic is unclear
        let liveWeek = standingsData.teams[0]?.current_week?.toString() || "21";

        // --- 1. QUARTERFINALS (WEEK 21) ---
        const week21 = matchupsData.weeks["21"];
        const qfOrder = [[1, 8], [4, 5], [2, 7], [3, 6]];
        
        // Safety: Ensure week21 and week21.matchups exist before mapping
        const qfMatchups = (week21 && week21.matchups) ? qfOrder.map(pair => {
            return week21.matchups.find(m => {
                const ids = m.teams.map(t => t.team.team_id);
                const t1Id = standingsData.teams.find(st => st.rank === pair[0])?.team_id;
                const t2Id = standingsData.teams.find(st => st.rank === pair[1])?.team_id;
                return ids.includes(t1Id) || ids.includes(t2Id);
            });
        }).filter(m => !!m) : [];

        // --- 2. SEMIFINALS (WEEK 22) - MANUAL RESEEDING ---
        const qfWinners = qfMatchups
            .map(m => getMatchupWinner(m))
            .filter(w => w !== null)
            .sort((a, b) => rankMap[a.team_id] - rankMap[b.team_id]);

        let sfHtml = '';
        let sfWinners = [];
        if (qfWinners.length === 4) {
            const sfPairs = [
                { t1: qfWinners[0], t2: qfWinners[3] },
                { t1: qfWinners[1], t2: qfWinners[2] }
            ];
            
            sfPairs.forEach(pair => {
                const liveMatchup = findLiveMatchup(pair.t1.team_id, pair.t2.team_id, matchupsData.weeks["22"]);
                const finalTeamA = liveMatchup ? liveMatchup.teams[0].team : pair.t1;
                const finalTeamB = liveMatchup ? liveMatchup.teams[1].team : pair.t2;
                
                sfHtml += renderManualCard(finalTeamA, finalTeamB, "22", liveWeek, rankMap);
                sfWinners.push(getWinnerFromTeams(finalTeamA, finalTeamB));
            });
        } else {
            sfHtml = '<div class="bracket-placeholder">Reseeding...</div>'.repeat(2);
        }

        // --- 3. FINALS (WEEK 23) ---
        let fHtml = '';
        const validSFWinners = sfWinners.filter(w => w !== null);
        if (validSFWinners.length === 2) {
            const liveMatchup = findLiveMatchup(validSFWinners[0].team_id, validSFWinners[1].team_id, matchupsData.weeks["23"]);
            const finalTeamA = liveMatchup ? liveMatchup.teams[0].team : validSFWinners[0];
            const finalTeamB = liveMatchup ? liveMatchup.teams[1].team : validSFWinners[1];
            
            fHtml = renderManualCard(finalTeamA, finalTeamB, "23", liveWeek, rankMap);
        } else {
            fHtml = '<div class="bracket-placeholder">TBD</div>';
        }

        // --- 4. RENDER ---
        const container = document.getElementById('bracket-container');
        if (container) {
            container.innerHTML = `
                <div class="bracket-round"><h3>Quarterfinals</h3>${qfMatchups.map(m => renderMatchupCard(m, "21", liveWeek, rankMap)).join('')}</div>
                <div class="bracket-round"><h3>Semifinals</h3>${sfHtml}</div>
                <div class="bracket-round"><h3>Finals</h3>${fHtml}</div>
            `;
        }
    } catch (error) {
        console.error("Bracket Error:", error);
    }
}

// --- LOGIC HELPERS ---
function getMatchupWinner(matchup) {
    if (!matchup || !matchup.teams) return null;
    const [t1, t2] = matchup.teams.map(t => t.team);
    return getWinnerFromTeams(t1, t2);
}

function getWinnerFromTeams(t1, t2) {
    if (!t1 || !t2) return null;
    const s1 = t1.team_points?.total ?? 0;
    const s2 = t2.team_points?.total ?? 0;
    if (s1 === 0 && s2 === 0) return null;
    return s1 > s2 ? t1 : t2;
}

function findLiveMatchup(id1, id2, weekData) {
    if (!weekData || !weekData.matchups) return null;
    return weekData.matchups.find(m => {
        const ids = m.teams.map(t => t.team.team_id);
        return ids.includes(id1) && ids.includes(id2);
    });
}

// --- RENDERING HELPERS ---
function renderMatchupCard(matchup, weekNum, liveWeek, rankMap) {
    if (!matchup || !matchup.teams) return '';
    return renderManualCard(matchup.teams[0].team, matchup.teams[1].team, weekNum, liveWeek, rankMap);
}

function renderManualCard(teamA, teamB, weekNum, liveWeek, rankMap) {
    const renderRow = (team) => {
        if (!team) return '';
        const score = team.team_points?.total ?? 0;
        const seed = rankMap[team.team_id] || '?';
        const proj = (weekNum === liveWeek) ? (team.new_projected_total ?? team.initial_projection ?? 0) : (team.initial_projection ?? 0);
        const projClass = score >= proj ? 'projected-up' : 'projected-down';
        const logo = team.team_logos?.team_logo?.url || 'css/default_logo.png';

        return `
            <div class="bracket-row">
                <img class="team-logo" src="${logo}">
                <div class="bracket-team-info">
                    <div class="bracket-team-name"><span class="bracket-seed">${seed}</span> ${team.name}</div>
                </div>
                <div class="bracket-score-box">
                    <div class="current-score">${score > 0 ? score.toFixed(1) : '—'}</div>
                    <div class="projected-score ${projClass}">${Number(proj).toFixed(1)}</div>
                </div>
            </div>`;
    };

    return `
        <div class="bracket-matchup-card" onclick="window.location.href='matchups.html?team1=${teamA.team_id}&team2=${teamB.team_id}&week=${weekNum}'">
            ${renderRow(teamA)}${renderRow(teamB)}
        </div>`;
}

// --- TAB SWITCHER ---
// Place this at the bottom of the script to ensure it's always active
document.addEventListener('DOMContentLoaded', () => {
    const tabMatchups = document.getElementById('tab-matchups');
    const tabBracket = document.getElementById('tab-bracket');
    const viewMatchups = document.getElementById('view-matchups');
    const viewBracket = document.getElementById('view-bracket');

    if (tabBracket && tabMatchups) {
        tabBracket.addEventListener('click', () => {
            tabBracket.classList.add('Selected');
            tabMatchups.classList.remove('Selected');
            viewMatchups.style.display = 'none';
            viewBracket.style.display = 'block';
            initBracket();
        });

        tabMatchups.addEventListener('click', () => {
            tabMatchups.classList.add('Selected');
            tabBracket.classList.remove('Selected');
            viewMatchups.style.display = 'block';
            viewBracket.style.display = 'none';
        });
    }
});