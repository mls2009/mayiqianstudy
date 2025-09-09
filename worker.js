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

// 获取北京时间的日期字符串（与前端格式一致）
function getBeijingDateString() {
	const now = new Date();
	// 本地时间 + (8小时 + 本地到UTC的偏移分钟) → 北京时间
	const minutesToAdd = (8 * 60) + now.getTimezoneOffset();
	const beijingTime = new Date(now.getTime() + minutesToAdd * 60 * 1000);
	return beijingTime.toDateString();
}

export default {
	async fetch(request, env) {
		try {
			const url = new URL(request.url);

			// Simple retry helper for transient D1 errors (e.g., object reset)
			async function withRetry(fn, retries = 2, delayMs = 80) {
				let lastErr;
				for (let i = 0; i <= retries; i++) {
					try { return await fn(); }
					catch (e) {
						lastErr = e;
						const msg = String(e && e.message || e);
						// Retry on known transient signals
						if (i < retries && (msg.includes('D1_ERROR') || msg.includes('reset') || msg.includes('Internal error'))) {
							await new Promise(r => setTimeout(r, delayMs));
							continue;
						}
						break;
					}
				}
				throw lastErr;
			}

			// CORS 预检（全局）
			if (request.method === 'OPTIONS') {
				return ok('');
			}

			if (url.pathname === "/api/health") {
				return ok("ok");
			}

			if (url.pathname === "/api/health/db") {
				try {
					const row = await withRetry(() => env.DB.prepare("SELECT 1 AS ok").first());
					return json({ ok: true, db: row?.ok === 1 });
				} catch (e) {
					return json({ ok: false, error: String(e && e.message || e) }, { status: 500 });
				}
			}

			if (request.method === "POST" && url.pathname === "/api/records") {
				const body = await request.json();
				const id = crypto.randomUUID();
				const { userId = "default", behaviorName, score, timestamp, date, category = null, itemIndex = null } = body;

				// 确保用户存在，避免外键错误
				await withRetry(() => env.DB.prepare(
					"INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)"
				).bind(userId, userId).run());

				await withRetry(() => env.DB.prepare(
					"INSERT INTO records (id, user_id, behavior_name, score, timestamp, date, category, item_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
				).bind(id, userId, behaviorName, score, timestamp, date, category, itemIndex).run());

				return json({ id });
			}

			if (request.method === "GET" && url.pathname === "/api/records") {
				const userId = url.searchParams.get("userId") || "default";
				const { results } = await withRetry(() => env.DB.prepare(
					"SELECT * FROM records WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500"
				).bind(userId).all());
				return json(results);
			}

			if (request.method === "POST" && url.pathname === "/api/records/clear") {
				const { userId = "default" } = await request.json();
				await withRetry(() => env.DB.prepare("DELETE FROM records WHERE user_id = ?").bind(userId).run());
				return ok("cleared");
			}

			if (request.method === "POST" && url.pathname === "/api/records/reset-today") {
				const { userId = "default", date } = await request.json();
				console.log("重置今日 - 用户ID:", userId, "日期:", date);
				await withRetry(() => env.DB.prepare("DELETE FROM records WHERE user_id = ? AND date = ?").bind(userId, date).run());
				return ok("reset-today");
			}

			if (request.method === "GET" && url.pathname === "/api/stats/overview") {
				const userId = url.searchParams.get("userId") || "default";
				
				// 确保用户存在
				await withRetry(() => env.DB.prepare(
					"INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)"
				).bind(userId, userId).run());
				
				// 计算统计信息
				const { results } = await withRetry(() => env.DB.prepare(
					"SELECT date, SUM(score) AS day_score FROM records WHERE user_id = ? AND category != 'adjust' GROUP BY date"
				).bind(userId).all());
				
				const days = results.length;
				const totalScore = results.reduce((sum, r) => sum + (r.day_score || 0), 0);
				const avgScore = days ? Math.round((totalScore / days) * 10) / 10 : 0;
				const rewardDays = results.filter(r => (r.day_score || 0) >= 5).length;
				
				// 计算今日得分（使用与前端一致的日期格式）
				const today = getBeijingDateString();
				const todayRecords = await withRetry(() => env.DB.prepare(
					"SELECT SUM(score) AS today_score FROM records WHERE user_id = ? AND date = ? AND category != 'adjust'"
				).bind(userId, today).first());
				const todayScore = todayRecords?.today_score || 0;
				
				return json({ 
					days, 
					avgScore, 
					rewardDays, 
					totalScore,
					todayScore
				});
			}

			return notFound();
		} catch (err) {
			return json({ error: String(err && err.message || err) }, { status: 500 });
		}
	}
};
