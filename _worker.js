export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();

    // 1. DUAL-COMPATIBILITY REWRITE
    let internalPath = url.pathname;
    if (internalPath.startsWith("/fantasy-hockey/")) {
      internalPath = internalPath.replace("/fantasy-hockey/", "/");
    }

    // 2. THE EXCEPTION LIST (The "Unlock")
    // This allows the submission page and KV routes to bypass the home-page redirect
    const exceptions = ["/submission.html", "/get-roster", "/submit-roster"];
    if (exceptions.includes(internalPath) || internalPath.includes("/css/")) {
       
       // Handle KV GET Route
       if (internalPath === "/get-roster") {
          const data = await env.PLAYOFF_DATA.get(userEmail);
          return new Response(data || "{}", { headers: { "Content-Type": "application/json" } });
       }

       // Handle KV POST Route
       if (internalPath === "/submit-roster" && request.method === "POST") {
          const body = await request.text();
          await env.PLAYOFF_DATA.put(userEmail, body);
          return new Response("Saved", { status: 200 });
       }

       // Handle regular asset fetching (like submission.html)
       const assetUrl = new URL(url.origin);
       assetUrl.pathname = internalPath;
       return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    // 3. THE REDIRECT LOGIC
    const teamMapping = { "pfajman1@gmail.com": 1, "corvettes13@hotmail.com": 2 };
    const userTeamNumber = teamMapping[userEmail];

    if ((internalPath === "/" || internalPath === "/index.html") && userTeamNumber) {
      return Response.redirect(`${url.origin}/fantasy-hockey/teams/team.html?team=${userTeamNumber}`, 302);
    }

    // 4. THE GATEKEEPER
    if (internalPath.includes("/teams/team.html")) {
      const requestedTeam = url.searchParams.get("team");
      if (userEmail !== "pfajman1@gmail.com" && requestedTeam && parseInt(requestedTeam) !== userTeamNumber) {
        return new Response("Access Denied: You can only manage your own team.", { status: 403 });
      }
    }

    // 5. ASSET DELIVERY
    const newUrl = new URL(url.origin);
    newUrl.pathname = internalPath;
    newUrl.search = url.search;

    return env.ASSETS.fetch(new Request(newUrl, request));
  } // <--- The fetch function NOW ends here, after everything is done.
};