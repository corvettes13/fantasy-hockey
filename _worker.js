export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();

    // 1. DUAL-COMPATIBILITY REWRITE
    // If the path starts with /fantasy-hockey/, we strip it out internally
    let internalPath = url.pathname;
    if (internalPath.startsWith("/fantasy-hockey/")) {
      internalPath = internalPath.replace("/fantasy-hockey/", "/");
    }

    // 2. LOGIC: Identify the user
    const teamMapping = {
      "pfajman1@gmail.com": 1,
      "corvettes13@hotmail.com": 2,
    };
    const userTeamNumber = teamMapping[userEmail];

    // 3. PROTECTION: Prevent Team 2 from seeing Team 1's file
    // Even if they use the /fantasy-hockey/ prefix or the direct path
    const teamMatch = internalPath.match(/\/team(\d+)\.html/);
    if (teamMatch) {
      const requestedTeam = parseInt(teamMatch[1]);
      if (userTeamNumber !== requestedTeam && userEmail !== "pfajman1@gmail.com") {
        return new Response("Access Denied: This isn't your team!", { status: 403 });
      }
    }

    // 4. THE MAGIC: Fetch the asset using the "Clean" internal path
    // We create a new request object so Cloudflare looks for the file in the right spot
    const newRequest = new Request(`${url.origin}${internalPath}`, request);
    return env.ASSETS.fetch(newRequest);
  }
};