export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();
    
    // We use the full path exactly as it comes from the browser
    const path = url.pathname;

    // 1. DATA ROUTES (KV)
    // These are virtual paths, they don't exist as files
    if (path.includes("/get-roster")) {
      const data = await env.PLAYOFF_DATA.get(userEmail);
      return new Response(data || "{}", { headers: { "Content-Type": "application/json" } });
    }

    if (path.includes("/submit-roster") && request.method === "POST") {
      const body = await request.text();
      await env.PLAYOFF_DATA.put(userEmail, body);
      return new Response("Saved", { status: 200 });
    }

    // 2. THE REDIRECT LOGIC
    const teamMapping = { "pfajman1@gmail.com": 1, "corvettes13@hotmail.com": 2 };
    const userTeamNumber = teamMapping[userEmail];

    // Only redirect if they hit the absolute root or the main index
    if ((path === "/" || path === "/fantasy-hockey/" || path === "/fantasy-hockey/index.html") && userTeamNumber) {
      return Response.redirect(`${url.origin}/fantasy-hockey/teams/team.html?team=${userTeamNumber}`, 302);
    }

    // 3. THE GATEKEEPER
    if (path.includes("/teams/team.html")) {
      const requestedTeam = url.searchParams.get("team");
      if (userEmail !== "pfajman1@gmail.com" && requestedTeam && parseInt(requestedTeam) !== userTeamNumber) {
        return new Response("Access Denied: You can only manage your own team.", { status: 403 });
      }
    }

    // 4. ASSET DELIVERY
    // No rewriting. Just tell Cloudflare to find the file exactly where the URL says it is.
    return env.ASSETS.fetch(request);
  }
};