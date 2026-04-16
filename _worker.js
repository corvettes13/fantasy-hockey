export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userEmailHeader = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();

    // 1. THE PATH PROXY (Fixes CSS/JS/Shared 404s)
    let internalPath = url.pathname;
    if (internalPath.startsWith("/fantasy-hockey/")) {
      internalPath = internalPath.replace("/fantasy-hockey/", "/");
    }

    // 2. DATA ROUTES (KV)
    
    // GET Route for Playoff Pool
    if (internalPath === "/playoff-get") {
      // Note: This still uses the Header email for loading. 
      // If you turn off Cloudflare Access, we'll need to update how this loads.
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

        // Use the email from the FORM as the storage key (sanitized)
        const storageKey = formData.email.toLowerCase().replace(/[^a-z0-9@._-]/gi, '');
        
        formData.submittedAt = new Date().toISOString();
        
        // Remove the password before storing in KV for security
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

    // Original roster routes (for the main fantasy site)
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

    // 5. ASSET DELIVERY
    const newUrl = new URL(url.origin);
    newUrl.pathname = internalPath;
    newUrl.search = url.search;
    return env.ASSETS.fetch(new Request(newUrl, request));
  }
};