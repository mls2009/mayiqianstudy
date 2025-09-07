function json(data, init = {}) {
	return new Response(JSON.stringify(data), {
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
			...init.headers
		},
		status: init.status || 200
	});
}

function ok(text = 'ok') {
	return new Response(text, {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}

function notFound() {
	return new Response('Not Found', {
		status: 404,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}

export default {
	async fetch(request, env) {
		try {
			const url = new URL(request.url);

			// CORS 预检（全局）
			if (request.method === 'OPTIONS') {
				return ok('');
			}

			if (url.pathname === "/api/health") {
				return ok("ok");
			}

			if (request.method === "POST" && url.pathname === "/api/records") {
				const body = await request.json();
				const id = crypto.randomUUID();
				const { userId = "default", behaviorName, score, timestamp, date, category = null, itemIndex = null } = body;

				// 确保用户存在，避免外键错误
				await env.DB.prepare(
					"INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)"
				).bind(userId, userId).run();

				await env.DB.prepare(
					"INSERT INTO records (id, user_id, behavior_name, score, timestamp, date, category, item_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
				).bind(id, userId, behaviorName, score, timestamp, date, category, itemIndex).run();

				return json({ id });
			}

			if (request.method === "GET" && url.pathname === "/api/records") {
				const userId = url.searchParams.get("userId") || "default";
				const { results } = await env.DB.prepare(
					"SELECT * FROM records WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500"
				).bind(userId).all();
				return json(results);
			}

			if (request.method === "POST" && url.pathname === "/api/records/clear") {
				const { userId = "default" } = await request.json();
				await env.DB.prepare("DELETE FROM records WHERE user_id = ?").bind(userId).run();
				return ok("cleared");
			}

			if (request.method === "POST" && url.pathname === "/api/records/reset-today") {
				const { userId = "default", date } = await request.json();
				await env.DB.prepare("DELETE FROM records WHERE user_id = ? AND date = ?").bind(userId, date).run();
				return ok("reset-today");
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
				return json({ days, avgScore, rewardDays, totalScore });
			}

			return notFound();
		} catch (err) {
			return json({ error: String(err && err.message || err) }, { status: 500 });
		}
	}
}; 