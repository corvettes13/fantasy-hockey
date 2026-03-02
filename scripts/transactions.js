let allGroupedTransactions = []; 
let currentTypeFilter = 'all';
let currentTeamFilter = 'all';
let currentPage = 0;
const pageSize = 25;
let filteredData = []; 

let globalPlayerLookup = {};
let globalTeamLookup = {};

async function loadTransactions() {
    try {
        const [txRes, playersRes, teamsRes] = await Promise.all([
            fetch("/fantasy-hockey/data/transactions.json"),
            fetch("/fantasy-hockey/data/players.json"),
            fetch("/fantasy-hockey/data/league_teams.json")
        ]);

        const tx = await txRes.json();
        const playersData = await playersRes.json();
        const teamsData = await teamsRes.json();

        // 1. Prepare Metadata
        tx.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        playersData.players.forEach(p => globalPlayerLookup[p.player_id] = p);

        const teamSelect = document.getElementById('team-filter');
        teamsData.forEach(t => {
            const key = t.team_info.team_key;
            const name = t.team_info.name;
            globalTeamLookup[key] = { name: name, logo: t.team_info.logo_url };

            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = name;
            teamSelect.appendChild(opt);
        });

        // 2. Group Data
        allGroupedTransactions = groupTransactions(tx);
        
        // 3. Attach Listeners
        setupEventListeners();

        // 4. Initial Render
        applyFilters();

    } catch (err) {
        console.error("Error loading transaction data:", err);
    }
}

function setupEventListeners() {
    // Nav Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentTypeFilter = e.target.dataset.filter;
            applyFilters();
        });
    });

    // Team Dropdown
    document.getElementById('team-filter').addEventListener('change', (e) => {
        currentTeamFilter = e.target.value;
        applyFilters();
    });
    
    // Pagination
    document.getElementById('next-btn').addEventListener('click', () => {
        if ((currentPage + 1) * pageSize < filteredData.length) {
            currentPage++;
            renderCurrentPage();
        }
    });

    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            renderCurrentPage();
        }
    });
}

function applyFilters() {
    currentPage = 0; 
    filteredData = []; 

    allGroupedTransactions.forEach(group => {
        // Clone the group
        let newGroup = { ...group, items: [...group.items] };

        // 1. Team Filtering
        // For trades, we check if the selected team is involved in any part of the deal
        if (currentTeamFilter !== 'all') {
            const teamInvolved = newGroup.items.some(item => item.team_key === currentTeamFilter);
            // Also check the display key (in case it's an add/drop pair)
            if (!teamInvolved && newGroup.team_display_key !== currentTeamFilter) {
                return; 
            }
        }

        // 2. Type Filtering
        if (currentTypeFilter === 'add') {
            newGroup.items = newGroup.items.filter(item => item.acq_type === 'add');
            if (newGroup.items.length === 0) return;
        } 
        else if (currentTypeFilter === 'drop') {
            newGroup.items = newGroup.items.filter(item => item.acq_type === 'drop');
            if (newGroup.items.length === 0) return;
        } 
        else if (currentTypeFilter === 'trade') {
            // Check if this group is a trade. If not, discard it.
            const isActuallyATrade = newGroup.items.some(item => item.acq_type === 'trade');
            if (!isActuallyATrade) return;
        }

        filteredData.push(newGroup);
    });

    renderCurrentPage();
}

function renderCurrentPage() {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    const pageData = filteredData.slice(start, end);
    
    renderTransactions(pageData);
    updatePaginationUI();
}

function renderTransactions(blocks) {
    const tbody = document.getElementById("transactions-body");
    tbody.innerHTML = "";

    blocks.forEach((block, groupIndex) => {
        const formattedDate = formatYahooDate(block.datetime);
        // Determine color class based on the block's position in the filtered list
        const rowColorClass = groupIndex % 2 === 0 ? "row-even" : "row-odd";

        if (block.type === 'trade') {
            const byTeam = {};
            block.items.forEach(item => {
                if (!byTeam[item.team_key]) byTeam[item.team_key] = [];
                byTeam[item.team_key].push(item);
            });

            const teamKeys = Object.keys(byTeam);
            teamKeys.forEach((teamKey, index) => {
                const tr = document.createElement("tr");
                tr.className = rowColorClass; // Apply alternating color to both trade rows

                const teamData = globalTeamLookup[teamKey] || { name: teamKey, logo: "" };
                let finalLogo = (teamKey === "Free Agent" || !teamData.logo) 
                    ? "https://s.yimg.com/cv/apiv2/default/nhl/nhl_1.png" 
                    : teamData.logo;

                const playerHtml = byTeam[teamKey].map(item => {
                    const p = globalPlayerLookup[item.player_id] || { full_name: "Unknown" };
                    return `<p class="player-entry-trade"><a href="${p.url || '#'}" class="player-name-link">${p.full_name}</a>
                            <span class="player-pos-team">${p.team_abbr} - ${p.position}</span></p>`;
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
            // Standard Add/Drop
            const tr = document.createElement("tr");
            tr.className = rowColorClass; // Apply alternating color

            const teamData = globalTeamLookup[block.team_display_key] || { name: block.team_display_key, logo: "" };
            let finalLogo = (block.team_display_key === "Free Agent" || !teamData.logo) 
                ? "https://s.yimg.com/cv/apiv2/default/nhl/nhl_1.png" 
                : teamData.logo;

            const iconsHtml = block.items.map(item => {
                const symbol = item.acq_type === "add" ? "+" : "–";
                const cls = item.acq_type === "add" ? "icon-add" : "icon-drop";
                return `<span class="f-icon ${cls}">${symbol}</span>`;
            }).join("");

            const playersHtml = block.items.map(item => {
                const p = globalPlayerLookup[item.player_id] || { full_name: "Unknown" };
                const sub = item.acq_type === "drop" ? "To Waivers" : (item.cost > 0 ? `$${item.cost} Waiver` : "Waiver");
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

function groupTransactions(tx) {
    const grouped = [];
    const usedIndices = new Set();

    for (let i = 0; i < tx.length; i++) {
        if (usedIndices.has(i)) continue;

        const current = tx[i];
        let group = {
            type: current.acq_type,
            datetime: current.datetime,
            items: [current],
            team_display_key: current.team_key
        };

        if (current.acq_type === 'trade') {
            group.type = 'trade'; // Ensure this is set
            for (let j = i + 1; j < tx.length; j++) {
                if (!usedIndices.has(j) && tx[j].datetime === current.datetime && tx[j].acq_type === 'trade') {
                    group.items.push(tx[j]);
                    usedIndices.add(j);
                }
            }
        } else if (current.acq_type === 'add' || current.acq_type === 'drop') {
            for (let j = i + 1; j < tx.length; j++) {
                if (!usedIndices.has(j) && tx[j].datetime === current.datetime) {
                    const isPair = (current.acq_type === 'add' && tx[j].acq_type === 'drop') || 
                                   (current.acq_type === 'drop' && tx[j].acq_type === 'add');
                    if (isPair) {
                        group.items.push(tx[j]);
                        usedIndices.add(j);
                        group.type = 'add_drop';
                        group.team_display_key = current.team_key === "Free Agent" ? tx[j].team_key : current.team_key;
                        break;
                    }
                }
            }
        }
        usedIndices.add(i);
        grouped.push(group);
    }
    return grouped;
}

function formatYahooDate(datetime) {
    const dateObj = new Date(datetime);
    return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
           ", " + 
           dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

function updatePaginationUI() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const info = document.getElementById('paging-info');

    prevBtn.classList.toggle('disabled', currentPage === 0);
    nextBtn.classList.toggle('disabled', (currentPage + 1) * pageSize >= filteredData.length);

    const startIdx = filteredData.length === 0 ? 0 : (currentPage * pageSize) + 1;
    const endIdx = Math.min((currentPage + 1) * pageSize, filteredData.length);
    info.textContent = `Showing ${startIdx}-${endIdx} of ${filteredData.length}`;
}

// Start the process
document.addEventListener('DOMContentLoaded', loadTransactions);