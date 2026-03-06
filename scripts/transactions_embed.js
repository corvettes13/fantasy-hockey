async function loadTransactionsWidget() {
    try {
        const [txRes, playersRes, teamsRes] = await Promise.all([
            fetch("data/transactions.json"),
            fetch("data/players.json"),
            fetch("data/league_teams.json")
        ]);

        const tx = await txRes.json();
        const playersData = await playersRes.json();
        const teamsData = await teamsRes.json();

        // 1. Prepare Metadata
        tx.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        
        const playerLookup = {};
        playersData.players.forEach(p => playerLookup[p.player_id] = p);

        const teamLookup = {};
        teamsData.forEach(t => {
            teamLookup[t.team_info.team_key] = { 
                name: t.team_info.name, 
                logo: t.team_info.logo_url 
            };
        });

        // 2. Filter logic: All of today, but at least the last 5 transactions
        // We filter out 'commish' types or transactions with no players for the widget
        const validTx = tx.filter(t => t.type !== 'commish' && t.players && t.players.length > 0);
        
        const todayStr = new Date().toISOString().split('T')[0];
        let displayList = validTx.filter(t => t.datetime.startsWith(todayStr));
        
        if (displayList.length < 5) {
            displayList = validTx.slice(0, 5);
        }

        renderWidget(displayList, playerLookup, teamLookup);
    } catch (err) {
        console.error("Error loading transactions widget:", err);
    }
}

function renderWidget(transactions, playerLookup, teamLookup) {
    const tbody = document.getElementById("transactions-widget-body");
    tbody.innerHTML = "";

    transactions.forEach((tx, groupIndex) => {
        const rowColorClass = groupIndex % 2 === 0 ? "row-even" : "row-odd";
        const formattedDate = formatYahooDate(tx.datetime);

        if (tx.type === 'trade') {
            const byTeam = {};
            tx.players.forEach(p => {
                if (!byTeam[p.team_key]) byTeam[p.team_key] = [];
                byTeam[p.team_key].push(p);
            });

            const teamKeys = Object.keys(byTeam);
            teamKeys.forEach((teamKey, index) => {
                const tr = document.createElement("tr");
                tr.className = rowColorClass;
                const teamData = teamLookup[teamKey] || { name: "Free Agent", logo: "" };
                let finalLogo = (!teamData.logo || teamKey === "free_agent") 
                    ? "https://s.yimg.com/cv/apiv2/default/nhl/nhl_1.png" 
                    : teamData.logo;

                const playerHtml = byTeam[teamKey].map(tp => {
                    const p = playerLookup[tp.player_id] || { full_name: "Unknown", team_abbr: "??", position: "???" };
                    return `<div class="player-entry-trade">
                                <a href="${p.url || '#'}" class="player-name-link">${p.full_name}</a>
                                <span class="player-pos-team">${p.team_abbr} - ${p.position}</span>
                            </div>`;
                }).join("");

                if (index === 0) {
                    tr.innerHTML = `<td rowspan="${teamKeys.length}" class="icon-col trade-icon-cell"><span class="f-icon icon-trade">🔄</span></td>`;
                }

                tr.innerHTML += `
                    <td class="player-info-col No-pstart">${playerHtml}</td>
                    <td class="trade-text-cell">Traded to</td>
                    <td class="team-time-col Ta-end">
                        <div class="yahoo-team-wrapper">
                            <div class="team-time-stack">
                                <a href="#" class="team-link">${teamData.name}</a>
                                <span class="timestamp-text">${formattedDate}</span>
                            </div>
                            <img src="${finalLogo}" class="team-logo-small">
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement("tr");
            tr.className = rowColorClass;

            // Identify the league team (not free_agent) to display the correct logo/name
            const mainAction = tx.players.find(p => p.team_key !== 'free_agent') || tx.players[0];
            const teamData = teamLookup[mainAction.team_key] || { name: "Free Agent", logo: "" };
            let finalLogo = (!teamData.logo || mainAction.team_key === "free_agent") 
                ? "https://s.yimg.com/cv/apiv2/default/nhl/nhl_1.png" 
                : teamData.logo;

            const iconsHtml = tx.players.map(p => {
                if (tx.type === "draft") return `<span class="f-icon icon-draft">🏆</span>`;
                const symbol = p.type === "add" ? "+" : "–";
                const cls = p.type === "add" ? "icon-add" : "icon-drop";
                return `<span class="f-icon ${cls}">${symbol}</span>`;
            }).join("");
            
            const playersHtml = tx.players.map(tp => {
                const p = playerLookup[tp.player_id] || { full_name: "Unknown", team_abbr: "??", position: "???" };
                let sub = "";
                if (tx.type === "draft") {
                    sub = `Drafted ($${tp.cost})`;
                } else if (tp.type === "drop") {
                    sub = "To Waivers";
                } else {
                    sub = tp.cost > 0 ? `$${tp.cost} Waiver` : "Waiver";
                }

                return `<div class="player-entry">
                    <a href="${p.url || '#'}" class="player-name-link">${p.full_name}</a>
                    <span class="player-pos-team">${p.team_abbr} - ${p.position}</span>
                    <h6 class="transaction-subtext">${sub}</h6>
                </div>`;
            }).join("");

            tr.innerHTML = `
                <td class="icon-col">${iconsHtml}</td>
                <td class="player-info-col" colspan="2">${playersHtml}</td>
                <td class="team-time-col Ta-end">
                    <div class="yahoo-team-wrapper">
                        <div class="team-time-stack">
                            <a href="#" class="team-link">${teamData.name}</a>
                            <span class="timestamp-text">${formattedDate}</span>
                        </div>
                        <img src="${finalLogo}" class="team-logo-small">
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function formatYahooDate(datetime) {
    const dateObj = new Date(datetime);
    return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ", " + 
           dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

document.addEventListener('DOMContentLoaded', loadTransactionsWidget);