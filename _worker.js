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
      // If Cloudflare Access is OFF, this header is empty. 
      // For now, we fetch based on the header, but we may want to change this to a query param later.
      const data = await env.PLAYOFF_DATA.get(userEmailHeader);
      return new Response(data || "{}", {
        headers: { "Content-Type": "application/json" }
      });
    }

    // SUBMIT Route for Playoff Pool (The Password Bouncer)
    if (internalPath === "/playoff-submit" && request.method === "POST") {
      try {
        const formData = await request.json();

        // CHECK THE LEAGUE PASSWORD
        if (formData.password !== "Broomball2026") {
          return new Response("Unauthorized: Incorrect League Password", { status: 401 });
        }

        // Use the email from the FORM as the storage key
        const storageKey = formData.email.toLowerCase().replace(/[^a-z0-9@._-]/gi, '');
        formData.submittedAt = new Date().toISOString();
        
        // Security: Remove password before saving to database
        delete formData.password;

        await env.PLAYOFF_DATA.put(storageKey, JSON.stringify(formData));

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response("Save Failed", { status: 500 });
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

    // 5. ASSET DELIVERY (Final Fallback)
    const newUrl = new URL(url.origin);
    newUrl.pathname = internalPath;
    newUrl.search = url.search;
    return env.ASSETS.fetch(new Request(newUrl, request));
  }
};