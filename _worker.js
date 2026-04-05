export default {
  async fetch(request, env) {
    const userEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
    const url = new URL(request.url);

    console.log(`Worker is running! User: ${userEmail}`);
    
    // 1. Let images and CSS load automatically
    if (url.pathname.includes(".")) {
      return env.ASSETS.fetch(request);
    }
   

    // 2. Map your 12 teams
    const teamMapping = {
      "pfajman1@gmail.com": 1,
      "corvettes13@hotmail.com": 2
      // ... add the others
    };

    const teamNumber = teamMapping[userEmail?.toLowerCase()];

    // 3. Redirect to their team page
    if (teamNumber) {
      // If they hit the main site, send them to their team file
      if (url.pathname === "/") {
        return Response.redirect(`${url.origin}/teams/team${teamNumber}.html`, 302);
      }
      return env.ASSETS.fetch(request);
    }

    return new Response("Access Denied: Team not assigned.", { status: 403 });
  }
};