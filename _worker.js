export default {
  async fetch(request, env) {
    const userEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();
    const url = new URL(request.url);

    // 1. PASS-THROUGH: Let all static assets (CSS, JS, Images) load freely
    if (url.pathname.includes(".") && !url.pathname.endsWith(".html")) {
      return env.ASSETS.fetch(request);
    }

    // 2. THE MAP: Your source of truth
    const teamMapping = {
      "pfajman1@gmail.com": 1,
      "corvettes13@hotmail.com": 2,
    };

    const userTeamNumber = teamMapping[userEmail];

    // 3. EXPLORATION MODE: Let them see the index/home page without a redirect
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return env.ASSETS.fetch(request);
    }

    // 4. THE GATEKEEPER: Only lock down team-specific pages
    // Example: if they go to /team1.html, check if they are user #1
    const teamPageMatch = url.pathname.match(/\/teams\/team(\d+)\.html/);
    if (teamPageMatch) {
      const requestedTeamNumber = parseInt(teamPageMatch[1]);

      if (userTeamNumber === requestedTeamNumber) {
        return env.ASSETS.fetch(request); // Allow
      } else {
        return new Response("Access Denied: This isn't your team!", { status: 403 });
      }
    }

    // 5. DEFAULT: Fallback to showing whatever page they requested
    return env.ASSETS.fetch(request);
  }
};