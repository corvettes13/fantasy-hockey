export default {
  async fetch(request, env, ctx) {
    // 1. Get the email from the Cloudflare Access header
    const userEmail = request.headers.get("Cf-Access-Authenticated-User-Email");

    if (!userEmail) {
      return new Response("Unauthorized: Please log in via Cloudflare Access.", { status: 401 });
    }

    // 2. Map emails to team numbers (1-12)
    const teamMapping = {
      "pfajman1@gmail.com": 1,
      "player2@example.com": 2,
      "player3@example.com": 3,
      // ... add the rest of your 12 managers here
    };

    const teamNumber = teamMapping[userEmail.toLowerCase()];

    // 3. Handle cases where an email isn't assigned to a team
    if (!teamNumber) {
      return new Response(`Hello ${userEmail}, you aren't assigned to a team yet. Contact the commish!`, { status: 403 });
    }

    // 4. Direct them to their team
    // Option A: Internal logic (Show them the page directly)
    return new Response(`Welcome Manager! You are viewing Team #${teamNumber}.`, {
      headers: { "content-type": "text/html" },
    });

    /* Option B: Redirect to a specific URL path
    return Response.redirect(`${new URL(request.url).origin}/team/${teamNumber}`, 302);
    */
  },
};