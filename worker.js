export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === "/api/health") {
			return new Response("ok");
		}

		if (request.method === "POST" && url.pathname === "/api/records") {
			const body = await request.json();
			const id = crypto.randomUUID();
			const { userId = "default", behaviorName, score, timestamp, date, category = null, itemIndex = null } = body;

			await env.DB.prepare(
				"INSERT INTO records (id, user_id, behavior_name, score, timestamp, date, category, item_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
			).bind(id, userId, behaviorName, score, timestamp, date, category, itemIndex).run();

			return Response.json({ id });
		}

		if (request.method === "GET" && url.pathname === "/api/records") {
			const userId = url.searchParams.get("userId") || "default";
			const { results } = await env.DB.prepare(
				"SELECT * FROM records WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500"
			).bind(userId).all();
			return Response.json(results);
		}

		if (request.method === "GET" && url.pathname === "/api/stats/overview") {
			const userId = url.searchParams.get("userId") || "default";
			const { results } = await env.DB.prepare(
				"SELECT date, SUM(score) AS day_score FROM records WHERE user_id = ? GROUP BY date"
			).bind(userId).all();
			const totalScore = results.reduce((s, r) => s + (r.day_score || 0), 0);
			const days = results.length;
			const avgScore = days ? Math.round((totalScore / days) * 10) / 10 : 0;
			const rewardDays = results.filter(r => (r.day_score || 0) >= 5).length;
			return Response.json({ days, avgScore, rewardDays, totalScore });
		}

		return new Response("Not Found", { status: 404 });
	}
}; 