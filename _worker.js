export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();

    // 1. DUAL-COMPATIBILITY REWRITE
    let internalPath = url.pathname;
    if (internalPath.startsWith("/fantasy-hockey/")) {
      internalPath = internalPath.replace("/fantasy-hockey/", "/");
    }

    // 2. TEAM PAGE LOGIC (Authorization)
    const teamMapping = {
      "pfajman1@gmail.com": 1,
      "corvettes13@hotmail.com": 2,
    };
    const userTeamNumber = teamMapping[userEmail];

    // Identify if they are requesting a team page
    const teamMatch = internalPath.match(/\/team(\d+)\.html/);
    if (teamMatch) {
      const requestedTeam = parseInt(teamMatch[1]);
      if (userTeamNumber !== requestedTeam && userEmail !== "pfajman1@gmail.com") {
        return new Response("Access Denied: This isn't your team!", { status: 403 });
      }
    }

    // 3. THE MAGIC: Preserve Query Parameters (?team=4)
    // We construct the new internal URL and make sure the search (query) is attached
    const newUrl = new URL(url.origin);
    newUrl.pathname = internalPath;
    newUrl.search = url.search; // This keeps ?team=4

    // 4. Return the asset
    return env.ASSETS.fetch(new Request(newUrl, request));
  }
};