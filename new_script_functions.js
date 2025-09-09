// 新的 API 函数
async function apiGetUserStats(userId = currentUser || FIXED_USER_ID) {
	const res = await fetch(`${API_BASE}/api/stats/overview?userId=${encodeURIComponent(userId)}`);
	if (!res.ok) throw new Error('get stats failed');
	return res.json();
}

// 简化的更新分数函数
function updateScore(isPositive = null) {
	// 直接从 API 获取用户统计
	apiGetUserStats().then(stats => {
		// 更新显示
		const todayScoreElement = document.getElementById('todayScore');
		const totalScoreElement = document.getElementById('totalScore');
		const currentTotalScoreElement = document.getElementById('currentTotalScore');
		
		if (todayScoreElement) todayScoreElement.textContent = stats.todayScore || 0;
		if (totalScoreElement) totalScoreElement.textContent = stats.totalScore || 0;
		if (currentTotalScoreElement) currentTotalScoreElement.textContent = stats.totalScore || 0;
		
		// 添加分数变化动画
		if (isPositive !== null && todayScoreElement && totalScoreElement) {
			const animationClass = isPositive ? 'score-up' : 'score-down';
			todayScoreElement.classList.add(animationClass);
			totalScoreElement.classList.add(animationClass);
			
			setTimeout(() => {
				todayScoreElement.classList.remove(animationClass);
				totalScoreElement.classList.remove(animationClass);
			}, 600);
		}
		
		console.log('分数更新:', { todayScore: stats.todayScore, totalScore: stats.totalScore });
	}).catch(console.error);
}

// 简化的设置总得分函数
function setTotalScore() {
	const input = document.getElementById('totalScoreInput');
	const newScore = parseInt(input.value);
	
	if (isNaN(newScore)) {
		showEncouragementMessage('info', '请输入有效的数字！');
		return;
	}
	
	// 直接发送调整记录，后端会更新用户的总得分
	const now = new Date();
	const record = {
		userId: currentUser || FIXED_USER_ID,
		behaviorName: '手动调整总分',
		score: newScore,
		timestamp: now.toISOString(),
		date: getBeijingDateString(),
		category: 'adjust',
		itemIndex: null
	};
	
	apiAddRecord(record)
		.then(() => refreshAllViews())
		.then(() => {
			input.value = '';
			showEncouragementMessage('positive', `总得分已设置为${newScore}分！`);
		})
		.catch((e) => showEncouragementMessage('info', `设置失败：${e.message}`));
}

// 简化的今日奖励检查
function updateRewardCard() {
	const rewardCard = document.getElementById('rewardCard');
	const rewardStatus = document.getElementById('rewardStatus');
	if (!rewardCard || !rewardStatus) return;
	
	// 移除所有状态类
	rewardCard.classList.remove('available', 'unavailable');
	
	// 从 API 获取今日得分
	apiGetUserStats().then(stats => {
		const todayScore = stats.todayScore || 0;
		
		if (todayScore >= 5) {
			rewardCard.classList.add('available');
			rewardStatus.textContent = '🎉 可以看电视啦！';
		} else {
			rewardCard.classList.add('unavailable');
			const needed = 5 - todayScore;
			rewardStatus.textContent = `还需要${needed}分才能看电视`;
		}
	}).catch(console.error);
}
