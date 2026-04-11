export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userEmail = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();

    // 1. THE PATH PROXY (Fixes CSS/JS/Shared 404s)
    let internalPath = url.pathname;
    if (internalPath.startsWith("/fantasy-hockey/")) {
      internalPath = internalPath.replace("/fantasy-hockey/", "/");
    }

    // 2. DATA ROUTES (KV)
    if (internalPath.includes("/get-roster")) {
      const data = await env.PLAYOFF_DATA.get(userEmail);
      return new Response(data || "{}", { headers: { "Content-Type": "application/json" } });
    }
    if (internalPath.includes("/submit-roster") && request.method === "POST") {
      const body = await request.text();
      await env.PLAYOFF_DATA.put(userEmail, body);
      return new Response("Saved", { status: 200 });
    }

    // 3. REFINED REDIRECT LOGIC
    const teamMapping = { "pfajman1@gmail.com": 1, "corvettes13@hotmail.com": 2 };
    const userTeamNumber = teamMapping[userEmail];

    // ONLY redirect if they hit the absolute root "/"
    // If they hit "/index.html" or "/fantasy-hockey/index.html", let them stay!
    if ((url.pathname === "/" || url.pathname === "/fantasy-hockey/") && userTeamNumber) {
      return Response.redirect(`${url.origin}/fantasy-hockey/teams/team.html?team=${userTeamNumber}`, 302);
    }

    // 4. THE GATEKEEPER (Security for team pages)
    if (internalPath.includes("/teams/team.html")) {
      const requestedTeam = url.searchParams.get("team");
      if (userEmail !== "pfajman1@gmail.com" && requestedTeam && parseInt(requestedTeam) !== userTeamNumber) {
        return new Response("Access Denied: You can only manage your own team.", { status: 403 });
      }
    
    // 5. ASSET DELIVERY
    const newUrl = new URL(url.origin);
    newUrl.pathname = internalPath;
    newUrl.search = url.search;
    return env.ASSETS.fetch(new Request(newUrl, request));
  }
  
  if (internalPath === "/playoff-submit" && request.method === "POST") {
      try {
          const formData = await request.json();
          // Tag the data with a timestamp so you know when they picked
          formData.submittedAt = new Date().toISOString();
          
          await env.PLAYOFF_DATA.put(userEmail, JSON.stringify(formData));
          return new Response(JSON.stringify({ success: true }), { 
              status: 200, 
              headers: { "Content-Type": "application/json" } 
          });
      } catch (err) {
          return new Response("Save Failed", { status: 500 });
      }
  }

  // THE LOAD ROUTE
  if (internalPath === "/playoff-get") {
      const data = await env.PLAYOFF_DATA.get(userEmail);
      return new Response(data || "{}", { 
          headers: { "Content-Type": "application/json" } 
    });
  }
};