export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Get the Cloudflare Access email if it exists
    const userEmailHeader = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();

    // 1. THE PATH PROXY
    let internalPath = url.pathname;
    
    // Strip the project name prefix if present
    if (internalPath.startsWith("/fantasy-hockey/")) {
      internalPath = internalPath.replace("/fantasy-hockey/", "/");
    }

    // 2. DATA ROUTES (KV)
    // GET Route for Playoff Pool
    if (internalPath === "/playoff-get") {
        // 1. Check Query Param first (sent by your JS), then fallback to Header
        const urlParams = new URL(request.url).searchParams;
        const emailQuery = urlParams.get("email");
        const targetEmail = (emailQuery || userEmailHeader).toLowerCase();

        if (!targetEmail) return new Response("{}", { status: 200 });

        const data = await env.PLAYOFF_DATA.get(targetEmail);
        return new Response(data || "{}", {
            headers: { "Content-Type": "application/json" }
        });
    }

    // Inside the /playoff-submit POST block in _worker.js
    if (internalPath === "/playoff-submit" && request.method === "POST") {
        try {
            const formData = await request.json();

            // 1. Password Check
            if (formData.password !== "Broomball2026") {
                return new Response("Unauthorized", { status: 401 });
            }

            const emailKey = formData.email.toLowerCase().replace(/[^a-z0-9@._-]/gi, '');
            
            // 2. ID Generation Logic
            // Check if this email already has a saved entry
            let existing = await env.PLAYOFF_DATA.get(emailKey);
            let entryId;

            if (existing) {
                const parsed = JSON.parse(existing);
                entryId = parsed.entryId; // Reuse their existing ID
            } else {
                // Generate a random 5-digit string
                entryId = Math.floor(10000 + Math.random() * 90000).toString();
            }

            formData.entryId = entryId;
            formData.submittedAt = new Date().toISOString();
            delete formData.password;

            const jsonString = JSON.stringify(formData);

            // 3. Dual-Storage
            // Store by email for the "Manager" to load/edit
            await env.PLAYOFF_DATA.put(emailKey, jsonString);
            await env.PLAYOFF_DATA.put(`id_${entryId}`, jsonString);

            return new Response(JSON.stringify({ 
                success: true, 
                entryId: entryId 
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        } catch (err) {
            return new Response("Save Failed", { status: 500 });
        }
    }
    
        // Route: /submit-supplement
    if (request.method === 'POST' && internalPath === '/submit-supplement') {
        try {
            const supplement = await request.json(); // { email, leaguePass, newPlayers, newMatchups }
            const email = supplement.email.toLowerCase();

            // 1. Password Check
            if (supplement.leaguePass !== env.LEAGUE_PASSWORD) {
                return new Response("Invalid League Password", { status: 401 });
            }

            // 2. Fetch existing entry
            const existingData = await env.PLAYOFF_DATA.get(email);
            if (!existingData) {
                return new Response("Existing roster not found for this email.", { status: 404 });
            }

            let entry = JSON.parse(existingData);

            // 3. Perform the Merge
            // Add new players to the existing roster arrays
            if (supplement.newPlayers && supplement.newPlayers.length > 0) {
                supplement.newPlayers.forEach(p => {
                    // p = { id: 123, pos: 'F' }
                    if (!entry.roster[p.pos].includes(p.id)) {
                        entry.roster[p.pos].push(p.id);
                    }
                });
            }

            // Add Round 2 matchups to the bracket object
            // This merges r2m1, r2m2, etc., into the existing r1w1, r1w2...
            entry.bracket = { ...entry.bracket, ...supplement.newMatchups };

            // 4. Update Metadata
            entry.updatedAt = new Date().toISOString();
            entry.round2Submitted = true;

            // 5. Atomic Write (Double-write for Email and ID)
            const updatedJson = JSON.stringify(entry);
            await env.PLAYOFF_DATA.put(email, updatedJson);
            await env.PLAYOFF_DATA.put(`id_${entry.entryId}`, updatedJson);

            return new Response(JSON.stringify({ success: true, entryId: entry.entryId }), {
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (err) {
            return new Response(err.message, { status: 500 });
        }
    }    

    // Original roster routes (Legacy/Main Site)
    if (internalPath.includes("/get-roster")) {
      const data = await env.PLAYOFF_DATA.get(userEmailHeader);
      return new Response(data || "{}", { headers: { "Content-Type": "application/json" } });
    }
    
    if (internalPath.includes("/submit-roster") && request.method === "POST") {
      const body = await request.text();
      await env.PLAYOFF_DATA.put(userEmailHeader, body);
      return new Response("Saved", { status: 200 });
    }

    // 3. REFINED REDIRECT LOGIC
    const teamMapping = { "pfajman1@gmail.com": 1, "corvettes13@hotmail.com": 2 };
    const userTeamNumber = teamMapping[userEmailHeader];

    if ((url.pathname === "/" || url.pathname === "/fantasy-hockey/") && userTeamNumber) {
      return Response.redirect(`${url.origin}/fantasy-hockey/teams/team.html?team=${userTeamNumber}`, 302);
    }

    // 4. THE GATEKEEPER (Security for team pages)
    if (internalPath.includes("/teams/team.html")) {
      const requestedTeam = url.searchParams.get("team");
      if (userEmailHeader !== "pfajman1@gmail.com" && requestedTeam && parseInt(requestedTeam) !== userTeamNumber) {
        return new Response("Access Denied: You can only manage your own team.", { status: 403 });
      }
    }
    
    // Inside your Worker's fetch handler
    if (internalPath === '/list-entries') {
      try {
        // 1. Get all keys in your KV namespace
        const list = await env.PLAYOFF_DATA.list();
        
        // 2. Filter to ONLY include keys starting with 'id_' 
        // This avoids duplicates from the email-based keys
        const idKeys = list.keys.filter(k => k.name.startsWith('id_'));
        
        // 3. Fetch the actual data for each filtered key
        const entries = await Promise.all(
          idKeys.map(async (key) => {
            const data = await env.PLAYOFF_DATA.get(key.name);
            return JSON.parse(data);
          })
        );

        // 4. Return the array to your standings page
        return new Response(JSON.stringify(entries), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // Crucial for your GitHub Pages fetch
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
    }

    // NEW: Public viewing route
    if (internalPath === "/view-entry") {
        const id = url.searchParams.get("id");
        if (!id) return new Response("Missing ID", { status: 400 });

        const data = await env.PLAYOFF_DATA.get(`id_${id}`);
        if (!data) return new Response("Entry not found", { status: 404 });

        return new Response(data, {
            headers: { "Content-Type": "application/json" }
        });
    }

    if (internalPath === "/view-entry") {
        const id = url.searchParams.get("id");
        if (!id) return new Response("Missing ID", { status: 400 });

        // Fetching the 'id_XXXXX' key you created in dual-storage
        const data = await env.PLAYOFF_DATA.get(`id_${id}`);
        
        if (!data) return new Response("Entry not found", { status: 404 });

        return new Response(data, {
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" // Allows the JS fetch to work
            }
        });
    }

    // 5. ASSET DELIVERY
    // Ensure that requests to /playoff_pool/ are routed to the static files
    // If you are using a single entry.html template, we need to make sure 
    // Cloudflare doesn't try to find a folder named '84831'
    
    const newUrl = new URL(url.origin);
    newUrl.pathname = internalPath;
    newUrl.search = url.search;
    return env.ASSETS.fetch(new Request(newUrl, request));
  }
};

