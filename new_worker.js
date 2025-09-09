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
					"INSERT OR IGNORE INTO users (id, name, total_score, today_score, last_reset_date) VALUES (?, ?, 0, 0, ?)"
				).bind(userId, userId, date).run();

				// 插入记录
				await env.DB.prepare(
					"INSERT INTO records (id, user_id, behavior_name, score, timestamp, date, category, item_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
				).bind(id, userId, behaviorName, score, timestamp, date, category, itemIndex).run();

				// 更新用户得分
				if (category === 'adjust') {
					// 手动调整总得分
					await env.DB.prepare(
						"UPDATE users SET total_score = ? WHERE id = ?"
					).bind(score, userId).run();
				} else {
					// 正常行为记录
					await env.DB.prepare(
						"UPDATE users SET total_score = total_score + ?, today_score = today_score + ? WHERE id = ?"
					).bind(score, score, userId).run();
				}

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
				await env.DB.prepare("UPDATE users SET total_score = 0, today_score = 0 WHERE id = ?").bind(userId).run();
				return ok("cleared");
			}

			if (request.method === "POST" && url.pathname === "/api/records/reset-today") {
				const { userId = "default", date } = await request.json();
				await env.DB.prepare("DELETE FROM records WHERE user_id = ? AND date = ?").bind(userId, date).run();
				await env.DB.prepare("UPDATE users SET today_score = 0 WHERE id = ?").bind(userId).run();
				return ok("reset-today");
			}

			if (request.method === "GET" && url.pathname === "/api/stats/overview") {
				const userId = url.searchParams.get("userId") || "default";
				const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
				if (!user) {
					return json({ days: 0, avgScore: 0, rewardDays: 0, totalScore: 0 });
				}
				
				// 计算统计信息
				const { results } = await env.DB.prepare(
					"SELECT date, SUM(score) AS day_score FROM records WHERE user_id = ? AND category != 'adjust' GROUP BY date"
				).bind(userId).all();
				
				const days = results.length;
				const avgScore = days ? Math.round((user.total_score / days) * 10) / 10 : 0;
				const rewardDays = results.filter(r => (r.day_score || 0) >= 5).length;
				
				return json({ 
					days, 
					avgScore, 
					rewardDays, 
					totalScore: user.total_score,
					todayScore: user.today_score
				});
			}

			return notFound();
		} catch (err) {
			return json({ error: String(err && err.message || err) }, { status: 500 });
		}
	}
};
