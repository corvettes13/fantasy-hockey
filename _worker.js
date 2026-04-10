export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();
    
    // Add this near your other routes in the fetch function
    if (url.pathname === "/test-kv") {
      await env.PLAYOFF_DATA.put("test_key", "It Works!");
      const value = await env.PLAYOFF_DATA.get("test_key");
      return new Response(`KV Status: ${value}`);
    }

    // 1. DUAL-COMPATIBILITY REWRITE (Keep your GitHub links working)
    let internalPath = url.pathname;
    if (internalPath.startsWith("/fantasy-hockey/")) {
      internalPath = internalPath.replace("/fantasy-hockey/", "/");
    }

    // 2. THE TEAM MAP
    const teamMapping = {
      "pfajman1@gmail.com": 1,
      "corvettes13@hotmail.com": 2,
      // Add all 12 here
    };
    const userTeamNumber = teamMapping[userEmail];

    // 3. THE DEFAULT LOGIN REDIRECT
    // If they hit the root "/" and we know their team, send them there immediately.
    // We check for "/" or "/index.html"
    if ((internalPath === "/" || internalPath === "/index.html") && userTeamNumber) {
      // Direct them to their specific team page with the query param preserved
      return Response.redirect(`${url.origin}/fantasy-hockey/teams/team.html?team=${userTeamNumber}`, 302);
    }

    // 4. THE GATEKEEPER (Optional Security)
    // If you want to stop managers from snooping on other team IDs:
    if (internalPath.includes("/teams/team.html")) {
      const requestedTeam = url.searchParams.get("team");
      // Allow the Commissioner (you) to see everything, but lock others to their ID
      if (userEmail !== "pfajman1@gmail.com" && requestedTeam && parseInt(requestedTeam) !== userTeamNumber) {
        return new Response("Access Denied: You can only manage your own team.", { status: 403 });
      }
    }

    // 5. ASSET DELIVERY
    // Re-attach the query string and fetch the file
    const newUrl = new URL(url.origin);
    newUrl.pathname = internalPath;
    newUrl.search = url.search;

    return env.ASSETS.fetch(new Request(newUrl, request));
  }
  
  if (internalPath === "/get-roster") {
      const data = await env.LEAGUE_DATA.get(userEmail);
      return new Response(data || "{}", { 
          headers: { "Content-Type": "application/json" } 
      });
  }

  // ROUTE: SAVE DATA
  if (internalPath === "/submit-roster" && request.method === "POST") {
      const body = await request.text();
      // Use the email as the unique key to store their specific JSON
      await env.LEAGUE_DATA.put(userEmail, body);
      return new Response("Saved", { status: 200 });
  }
};