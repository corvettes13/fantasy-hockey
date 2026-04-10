export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();

    // 1. THE PATH PROXY (Crucial for CSS/Images/Shared files)
    // If the browser asks for /fantasy-hockey/css/style.css, 
    // we internally look for /css/style.css
    let internalPath = url.pathname;
    if (internalPath.startsWith("/fantasy-hockey/")) {
      internalPath = internalPath.replace("/fantasy-hockey/", "/");
    }

    // 2. DATA ROUTES (KV)
    if (internalPath === "/get-roster") {
      const data = await env.PLAYOFF_DATA.get(userEmail);
      return new Response(data || "{}", { headers: { "Content-Type": "application/json" } });
    }

    if (internalPath === "/submit-roster" && request.method === "POST") {
      const body = await request.text();
      await env.PLAYOFF_DATA.put(userEmail, body);
      return new Response("Saved", { status: 200 });
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

    // 5. FINAL ASSET DELIVERY
    // We create a new Request with the "internalPath" so Cloudflare finds the file
    const newUrl = new URL(url.origin);
    newUrl.pathname = internalPath;
    newUrl.search = url.search; // Keep ?team=2 intact

    return env.ASSETS.fetch(new Request(newUrl, request));
  }
};