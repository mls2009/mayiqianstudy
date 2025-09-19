// 新的行为配置结构
const behaviorConfig = {
    positive: {
        eating: {
            name: "乖乖吃饭",
            emoji: "🍽️",
            color: "#34C759",
            items: [
                {name: "不离开座位", emoji: "🪑", score: 1, dailyLimit: null},
                {name: "自己吃饭", emoji: "🥄", score: 1, dailyLimit: null},
                {name: "饭都吃完", emoji: "🍚", score: 1, dailyLimit: null}
            ]
        },
        studying: {
            name: "好好学习",
            emoji: "📚",
            color: "#007AFF",
            items: [
                {name: "英语学习", emoji: "🔤", score: 1, dailyLimit: 2},
                {name: "数学学习", emoji: "🔢", score: 1, dailyLimit: 2},
                {name: "识字学习", emoji: "📖", score: 1, dailyLimit: 1},
                {name: "书写学习", emoji: "✏️", score: 1, dailyLimit: 1}
            ]
        },
        sleeping: {
            name: "按时睡觉",
            emoji: "😴",
            color: "#5856D6",
            items: [
                {name: "晚上9点半前睡觉", emoji: "🌙", score: 2, dailyLimit: 1},
                {name: "晚上10点前睡觉", emoji: "🌃", score: 1, dailyLimit: 1},
                {name: "午睡2个小时", emoji: "😴", score: 2, dailyLimit: 1},
                {name: "午睡1个小时", emoji: "💤", score: 1, dailyLimit: 1}
            ]
        },
        exercise: {
            name: "多做运动",
            emoji: "🏃",
            color: "#FF9500",
            items: [
                {name: "跳绳", emoji: "🪢", score: 1, dailyLimit: 2},
                {name: "摸高", emoji: "🤸", score: 1, dailyLimit: 2}
            ]
        }
    },
    negative: [
        {name: "欺负兄弟", emoji: "😠", score: -1, color: "#FF3B30"},
        {name: "晚上10点还不睡", emoji: "🌙", score: -1, color: "#FF3B30"},
        {name: "乱发脾气", emoji: "😡", score: -1, color: "#FF3B30"},
        {name: "吃饭离开座位", emoji: "🚶", score: -1, color: "#FF3B30"}
    ]
};

// 默认行为配置（保留兼容）
const defaultBehaviors = [
    { id: 1, name: '按时吃饭', score: 1, type: 'positive' },
    { id: 2, name: '主动刷牙', score: 1, type: 'positive' },
    { id: 3, name: '帮助家务', score: 2, type: 'positive' },
    { id: 4, name: '认真学习', score: 2, type: 'positive' },
    { id: 5, name: '欺负弟弟', score: -2, type: 'negative' },
    { id: 6, name: '不听话', score: -1, type: 'negative' },
    { id: 7, name: '乱发脾气', score: -1, type: 'negative' },
    { id: 8, name: '不按时睡觉', score: -1, type: 'negative' }
];

// 鼓励文案配置
const encouragementMessages = {
    positive: [
        "太棒了！马亦谦真是个好孩子！🌟",
        "哇！你做得真好！继续加油！✨",
        "真厉害！爸爸妈妈为你骄傲！🎉",
        "好样的！你是最棒的小朋友！⭐",
        "太优秀了！你真是个小天使！👼",
        "做得很好！你越来越棒了！🚀",
        "真不错！你是爸妈的小骄傲！💖",
        "太赞了！你真是个懂事的孩子！🌈"
    ],
    negative: [
        "没关系，下次会做得更好的！💪",
        "每个人都会犯错，重要的是要改正哦！🤗",
        "相信你下次一定能做得更棒！🌟",
        "没事的，我们一起努力变得更好！💝",
        "小朋友要学会控制自己哦！🎯",
        "下次记得要做个好孩子哦！🌸",
        "爸爸妈妈相信你会改正的！🤝",
        "每一次都是学习的机会！📚"
    ]
};

// 应用状态
let behaviors = [];
let records = [];
let currentTab = 'home';
let currentPeriod = 'week';
let totalScore = 0;
let currentUser = '马亦谦';
let statsFilterType = null; // null | 'positive' | 'negative'
let lastRenderedDate = null; // 用于跨天检测

// ---- API integration start ----
const API_BASE = 'https://api.mayiqian.top';
const FIXED_USER_ID = 'default';
const USE_API = true;
let cachedRecords = [];

// 通用：带超时的 fetch，避免移动端网络挂起导致加载态不消失
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
	return await Promise.race([
		fetch(url, options),
		new Promise((_, reject) => setTimeout(() => reject(new Error('网络超时，请稍后重试')), timeoutMs))
	]);
}

async function apiAddRecord(record) {
	const res = await fetchWithTimeout(`${API_BASE}/api/records`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(record)
	});
	if (!res.ok) throw new Error('add record failed');
	return res.json();
}

async function apiGetRecords(userId = currentUser || FIXED_USER_ID, period = 'all') {
	const res = await fetchWithTimeout(`${API_BASE}/api/records?userId=${encodeURIComponent(userId)}&period=${period}`);
	if (!res.ok) throw new Error('get records failed');
	const data = await res.json();
	// 规范后端返回（D1 为下划线命名）为前端使用的 camelCase
	return (Array.isArray(data) ? data : []).map(r => ({
		id: r.id || r.record_id || undefined,
		userId: r.user_id || r.userId || (currentUser || FIXED_USER_ID),
		behaviorName: r.behavior_name || r.behaviorName || r.behavior || '未知行为',
		score: typeof r.score === 'number' ? r.score : Number(r.score || 0),
		timestamp: r.timestamp || r.created_at || r.time || new Date().toISOString(),
		date: r.date || (r.timestamp ? new Date(r.timestamp).toDateString() : undefined),
		category: r.category || undefined,
		itemIndex: r.item_index != null ? Number(r.item_index) : (r.itemIndex != null ? Number(r.itemIndex) : undefined)
	}));
}

async function apiGetStats(userId = FIXED_USER_ID, period = 'all') {
	const res = await fetchWithTimeout(`${API_BASE}/api/stats?userId=${encodeURIComponent(userId)}&period=${period}`);
	if (!res.ok) throw new Error('get stats failed');
	return res.json();
}

async function apiClearAll(userId) {
	const res = await fetchWithTimeout(`${API_BASE}/api/records/clear`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId })
	});
	if (!res.ok) throw new Error('clear failed');
}

async function apiResetToday(userId, date) {
	const res = await fetchWithTimeout(`${API_BASE}/api/records/reset-today`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ userId, date })
	});
	if (!res.ok) throw new Error('reset-today failed');
}
// ---- API integration end ----

// 简化的数据加载函数（已被 refreshAllViews 替代）
async function loadRecordsFromAPI() {
	try {
		cachedRecords = await apiGetRecords(currentUser || FIXED_USER_ID, "all");
		console.log("记录数据加载完成:", cachedRecords.length);
	} catch (e) {
		console.error("loadRecordsFromAPI失败:", e);
		// 保底：不抛出，保持旧数据
	}
}

async function refreshAllViews() {
	try {
		// 一次性获取所有需要的数据
		const [records, userStats] = await Promise.all([
			apiGetRecords(currentUser || FIXED_USER_ID, "all"),
			apiGetUserStats(currentUser || FIXED_USER_ID)
		]);
		
		// 更新缓存
		cachedRecords = records;
		
		// 更新所有界面元素
		updateScoreDisplay(userStats);
		updateRewardCardDisplay(userStats.todayScore || 0);
		renderRecords();
		
		if (currentTab === 'stats') {
			renderStats();
		}
		
		console.log("数据刷新完成:", { records: records.length, userStats });
	} catch (e) {
		console.error("refreshAllViews失败:", e);
		throw e; // 重新抛出错误供调用者处理
	}
}

function getAllRecords() {
	if (USE_API) return cachedRecords;
	// 本地回退：使用 localStorage 旧数据
	const lsUser = localStorage.getItem('currentUser') || '马亦谦';
	const userKey = `${lsUser}_records`;
	return JSON.parse(localStorage.getItem(userKey) || '[]');
}

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    bindEvents();
});

function initializeApp() {
    // 跨天检查
    checkAndResetDaily();

    // 更新用户显示
    updateUserDisplay();

    // 跨天检测与前台刷新
    lastRenderedDate = getBeijingDateString();
    if (!window.__dailyRefreshTimer) {
        window.__dailyRefreshTimer = setInterval(() => {
            const today = getBeijingDateString();
            if (today !== lastRenderedDate) {
                lastRenderedDate = today;
                refreshAllViews().catch(console.error);
            }
        }, 60 * 1000);
    }
    if (!window.__visibilityHooked) {
        window.__visibilityHooked = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const today = getBeijingDateString();
                if (today !== lastRenderedDate) {
                    lastRenderedDate = today;
                }
                refreshAllViews().catch(console.error);
            }
        });
    }

    // 首屏：优先 API，失败回退本地
    if (USE_API) {
        refreshAllViews()
            .catch((error) => {
                console.error('API首屏加载失败，回退本地数据:', error);
                loadData();
                renderRecords();
                updateScore();
                updateRewardCard();
            });
    } else {
        loadData();
        renderRecords();
        updateScore();
        updateRewardCard();
    }
}

// 检查并处理跨天逻辑
function checkAndResetDaily() {
    const currentBeijingDate = getBeijingDateString();
    const lastAccessDate = localStorage.getItem('lastAccessDate');
    
    if (lastAccessDate && lastAccessDate !== currentBeijingDate) {
        console.log('检测到跨天，从', lastAccessDate, '到', currentBeijingDate);
        // 这里不需要清空数据，只是更新显示
        // 因为今日得分是通过筛选当天记录计算的，会自动更新
    }
    
    // 更新最后访问日期
    localStorage.setItem('lastAccessDate', currentBeijingDate);
}

function loadData() {
    // 加载当前用户
    const savedUser = localStorage.getItem('currentUser');
    currentUser = savedUser || '马亦谦';
    
    // 从localStorage加载当前用户的数据
    const userKey = `user_${currentUser}`;
    const userData = localStorage.getItem(userKey);
    
    if (userData) {
        const data = JSON.parse(userData);
        behaviors = data.behaviors || defaultBehaviors;
        records = data.records || [];
        totalScore = data.totalScore || 0;
    } else {
        behaviors = defaultBehaviors;
        records = [];
        totalScore = 0;
    }
    
    // 更新界面显示
    updateUserDisplay();
}

function saveData() {
    // 保存当前用户
    localStorage.setItem('currentUser', currentUser);
    
    // 保存当前用户的数据
    const userKey = `user_${currentUser}`;
    const userData = {
        behaviors: behaviors,
        records: records,
        totalScore: totalScore
    };
    localStorage.setItem(userKey, JSON.stringify(userData));
}

// 已废弃：现在使用静态HTML而不是动态生成按钮
/*
function renderBehaviors() {
    const actionGrid = document.getElementById('actionGrid');
    actionGrid.innerHTML = '';
    
    behaviors.forEach(behavior => {
        const button = document.createElement('button');
        button.className = `action-btn ${behavior.type}`;
        button.onclick = () => addRecord(behavior);
        
        button.innerHTML = `
            <div class="action-title">${behavior.name}</div>
            <div class="action-score ${behavior.type}">
                ${behavior.score > 0 ? '+' : ''}${behavior.score}分
            </div>
        `;
        
        actionGrid.appendChild(button);
    });
}
*/

// 修复：确保注释正确关闭

function addRecord(behavior) {
    const now = new Date();
    const record = {
        id: Date.now(),
        behaviorId: behavior.id,
        behaviorName: behavior.name,
        score: behavior.score,
        timestamp: now.toISOString(),
        date: getBeijingDateString()
    };
    
    records.unshift(record);
    
    // 更新总得分
    totalScore += behavior.score;
    saveData();
    
    // 播放动画和显示鼓励文案
    playAnimation(behavior);
    
    // 更新界面
    renderRecords();
    updateScore(behavior.score > 0);
    updateRewardCard();
    
    // 触觉反馈（如果支持）
    if (navigator.vibrate) {
        navigator.vibrate(behavior.score > 0 ? [50, 50, 50] : [100]);
    }
}

function playAnimation(behavior) {
    // 找到被点击的按钮
    const buttons = document.querySelectorAll('.action-btn');
    let clickedButton = null;
    
    buttons.forEach(btn => {
        if (btn.querySelector('.action-title').textContent === behavior.name) {
            clickedButton = btn;
        }
    });
    
    if (clickedButton) {
        // 添加动画类
        const animationClass = behavior.type === 'positive' ? 'animate-positive' : 'animate-negative';
        clickedButton.classList.add(animationClass);
        
        // 移除动画类
        setTimeout(() => {
            clickedButton.classList.remove(animationClass);
        }, 600);
        
        // 如果是正面行为，添加星星特效
        if (behavior.type === 'positive') {
            createStarEffect(clickedButton);
        }
    }
    
    // 显示鼓励文案
    showEncouragementMessage(behavior.type);
}

function createStarEffect(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // 创建多个星星
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const star = document.createElement('div');
            star.className = 'star-effect';
            star.textContent = '⭐';
            
            // 随机位置
            const offsetX = (Math.random() - 0.5) * 100;
            const offsetY = (Math.random() - 0.5) * 50;
            
            star.style.left = (centerX + offsetX) + 'px';
            star.style.top = (centerY + offsetY) + 'px';
            
            document.body.appendChild(star);
            
            // 1秒后移除
            setTimeout(() => {
                if (star.parentNode) {
                    star.parentNode.removeChild(star);
                }
            }, 1000);
        }, i * 100);
    }
}

function showEncouragementMessage(type, customMessage = null) {
    let message;
    
    if (customMessage) {
        message = customMessage;
    } else {
        const messages = encouragementMessages[type];
        message = messages[Math.floor(Math.random() * messages.length)];
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // 2秒后开始淡出动画
    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        
        // 淡出动画完成后移除元素
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 2000);
}

function renderRecords() {
    const recordsList = document.getElementById('recordsList');
    if (!recordsList) {
        console.log('recordsList元素未找到');
        return;
    }
    
    // 获取记录
    const allRecords = getAllRecords();
    
    const today = getBeijingDateString();
    const todayRecords = allRecords.filter(record => record.date === today && record.category !== "adjust");
    
    if (todayRecords.length === 0) {
        recordsList.innerHTML = `
            <div class="empty-state">
                <p>今天还没有记录哦～</p>
            </div>
        `;
        return;
    }
    
    recordsList.innerHTML = todayRecords.map(record => {
        const time = new Date(record.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const behaviorName = record.behaviorName || record.behavior || '未知行为';
        const score = record.score || 0;
        
        return `
            <div class="record-item">
                <div class="record-info">
                    <div class="record-title">${behaviorName}</div>
                    <div class="record-time">${time}</div>
                </div>
                <div class="record-score ${score > 0 ? 'positive' : 'negative'}">
                    ${score > 0 ? '+' : ''}${score}
                </div>
            </div>
        `;
    }).join('');
}

function updateScore(isPositive = null) {
    // 使用统一数据源
    const allRecords = getAllRecords();
    
    // 计算今日得分（统一使用北京时间字符串）
    const today = getBeijingDateString();
    const todayScore = allRecords
        .filter(record => record.date === today && record.category !== "adjust")
        .reduce((sum, record) => sum + (record.score || 0), 0);
    
    // 总得分改为聚合计算
    const totalScore = allRecords.reduce((sum, r) => sum + (r.score || 0), 0);
    
    // 更新显示
    const todayScoreElement = document.getElementById('todayScore');
    const totalScoreElement = document.getElementById('totalScore');
    const currentTotalScoreElement = document.getElementById('currentTotalScore');
    
    if (todayScoreElement) todayScoreElement.textContent = todayScore;
    if (totalScoreElement) totalScoreElement.textContent = totalScore;
    if (currentTotalScoreElement) currentTotalScoreElement.textContent = totalScore;
    
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
    
    console.log('分数更新:', { todayScore, totalScore });
}

function updateRewardCard() {
    // 使用统一数据源
    const allRecords = getAllRecords();
    
    // 计算今日得分（统一使用北京时间字符串）
    const today = getBeijingDateString();
    const todayScore = allRecords
        .filter(record => record.date === today && record.category !== "adjust")
        .reduce((sum, record) => sum + (record.score || 0), 0);
    
    const rewardCard = document.getElementById('rewardCard');
    const rewardStatus = document.getElementById('rewardStatus');
    
    if (!rewardCard || !rewardStatus) return;
    
    // 移除所有状态类
    rewardCard.classList.remove('available', 'unavailable');
    
    if (todayScore >= 5) {
        rewardCard.classList.add('available');
        rewardStatus.textContent = '🎉 可以看电视啦！';
    } else {
        rewardCard.classList.add('unavailable');
        const needed = 5 - todayScore;
        rewardStatus.textContent = `还需要${needed}分才能看电视`;
    }
}

function checkTodayReward() {
    const today = new Date().toDateString();
    const todayRecords = getAllRecords().filter(record => record.date === today && record.category !== "adjust");
    const todayScore = todayRecords.reduce((sum, record) => sum + record.score, 0);
    
    if (todayScore >= 5) {
        // 显示奖励弹窗
        showRewardModal();
    } else {
        // 显示还需要多少分的提示
        const needed = 5 - todayScore;
        showEncouragementMessage('info', `还需要${needed}分就能看电视了！加油！💪`);
    }
}

function showRewardModal() {
    const modal = document.getElementById('rewardModal');
    modal.classList.add('show');
}

function closeRewardModal() {
    const modal = document.getElementById('rewardModal');
    modal.classList.remove('show');
}

function bindEvents() {
    // 底部导航切换
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            switchTab(tab);
        });
    });
    
    // 时间周期切换
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPeriod = this.getAttribute('data-period');
            renderStats();
        });
    });
    
    // 自定义打分弹窗键盘事件
    document.addEventListener('keydown', function(e) {
        const customModal = document.getElementById('customModal');
        if (customModal && customModal.classList.contains('show')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitCustomScore();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeCustomModal();
            }
        }
    });
}

function switchTab(tab) {
    // 更新导航状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    // 隐藏所有页面
    document.querySelectorAll('.page-content').forEach(page => {
        page.style.display = 'none';
    });
    
    // 显示对应页面
    const pageMap = {
        'home': 'homePage',
        'stats': 'statsPage',
        'settings': 'settingsPage'
    };
    
    const targetPage = document.getElementById(pageMap[tab]);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    currentTab = tab;
    
    // 如果切换到统计页面，渲染统计数据
    if (tab === 'stats') {
        renderStats();
    }
}

// 统计相关函数
function renderStats() {
    console.log('renderStats被调用，当前周期:', currentPeriod);
    renderStatsOverview();
    renderBehaviorStats();
    renderDailyTrend();
    renderStatsRecords();
}

function renderStatsOverview() {
    // 使用统一数据源
    const allRecords = getAllRecords();
    
    console.log('统计数据 - 统一数据源记录数:', allRecords.length);
    
    const periodRecords = getRecordsByPeriod(currentPeriod, allRecords);
    console.log('筛选后记录数:', periodRecords.length, '周期:', currentPeriod);
    const days = getUniqueDays(periodRecords);
    const totalScoreAgg = periodRecords.reduce((sum, record) => sum + (record.score || 0), 0);
    const avgScore = days.length > 0 ? Math.round(totalScoreAgg / days.length * 10) / 10 : 0;
    const rewardDays = days.filter(day => {
        const dayRecords = periodRecords.filter(record => record.date === day);
        const dayScore = dayRecords.reduce((sum, record) => sum + (record.score || 0), 0);
        return dayScore >= 5;
    }).length;
    
    // 计算总共得分与总共失分
    const totalPositive = periodRecords.reduce((sum, r) => sum + Math.max(r.score || 0, 0), 0);
    const totalNegative = periodRecords.reduce((sum, r) => sum + Math.min(r.score || 0, 0), 0);
    
    const totalDaysEl = document.getElementById('totalDays');
    const avgScoreEl = document.getElementById('avgScore');
    const rewardDaysEl = document.getElementById('rewardDays');
    const totalPositiveEl = document.getElementById('totalPositiveScore');
    const totalNegativeEl = document.getElementById('totalNegativeScore');
    
    if (totalDaysEl) totalDaysEl.textContent = days.length;
    if (avgScoreEl) avgScoreEl.textContent = avgScore;
    if (rewardDaysEl) rewardDaysEl.textContent = rewardDays;
    if (totalPositiveEl) totalPositiveEl.textContent = totalPositive;
    if (totalNegativeEl) totalNegativeEl.textContent = totalNegative;
}

function renderBehaviorStats() {
    // 使用统一数据源
    const allRecords = getAllRecords();
    
    const periodRecords = getRecordsByPeriod(currentPeriod, allRecords);
    const behaviorStats = {};
    
    // 统计每个行为的次数和总分
    periodRecords.forEach(record => {
        if (!behaviorStats[record.behaviorName]) {
            behaviorStats[record.behaviorName] = {
                count: 0,
                totalScore: 0,
                type: (record.score || 0) > 0 ? 'positive' : 'negative'
            };
        }
        behaviorStats[record.behaviorName].count++;
        behaviorStats[record.behaviorName].totalScore += (record.score || 0);
    });
    
    const behaviorList = document.getElementById('behaviorStatsList');
    
    if (Object.keys(behaviorStats).length === 0) {
        behaviorList.innerHTML = '<div class="empty-state"><p>暂无数据</p></div>';
        return;
    }
    
    behaviorList.innerHTML = Object.entries(behaviorStats)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, stats]) => `
            <div class="behavior-stat-item">
                <div class="behavior-stat-info">
                    <div class="behavior-stat-name">${name}</div>
                    <div class="behavior-stat-count">${stats.count}次</div>
                </div>
                <div class="behavior-stat-score ${stats.type}">
                    ${stats.totalScore > 0 ? '+' : ''}${stats.totalScore}
                </div>
            </div>
        `).join('');
}

function renderDailyTrend() {
    const trendChart = document.getElementById('trendChart');
    
    if (!trendChart) return;
    
    // 使用统一数据源
    const allRecords = getAllRecords();
    
    // 以北京时间为基准获取最近7天的日期字符串（包括今天）
    const last7Days = [];
    const nowBJ = getBeijingTime();
    // 规范到当天0点（北京时间）
    const base = new Date(nowBJ.getFullYear(), nowBJ.getMonth(), nowBJ.getDate());
    for (let i = 6; i >= 0; i--) {
        const d = new Date(base);
        d.setDate(base.getDate() - i);
        // 把该天视为北京时间当天的字符串
        last7Days.push(d.toDateString());
    }
    
    // 计算每天的得分
    const dailyScores = last7Days.map(day => {
        const dayRecords = allRecords.filter(record => record.date === day);
        return {
            date: day,
            score: dayRecords.reduce((sum, record) => sum + (record.score || 0), 0),
            hasData: dayRecords.length > 0
        };
    });
    
    // 找到最大绝对值用于缩放
    const maxScore = Math.max(...dailyScores.map(day => Math.abs(day.score)), 5);
    
    trendChart.innerHTML = dailyScores.map(dayData => {
        const date = new Date(dayData.date);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const barWidth = Math.abs(dayData.score) / maxScore * 100;
        
        return `
            <div class="trend-day">
                <div class="trend-date">${dateStr}</div>
                <div class="trend-bar-container">
                    ${dayData.hasData ? 
                        `<div class="trend-bar ${dayData.score >= 0 ? 'positive' : 'negative'}" 
                              style="width: ${Math.max(barWidth, 5)}%"></div>` :
                        `<div class="trend-bar empty" style="width: 5%"></div>`
                    }
                </div>
                <div class="trend-score ${dayData.score >= 0 ? 'positive' : (dayData.score < 0 ? 'negative' : 'empty')}">
                    ${dayData.hasData ? (dayData.score > 0 ? '+' : '') + dayData.score : '-'}
                </div>
            </div>
        `;
    }).join('');
}

function renderStatsRecords() {
    const listEl = document.getElementById('statsRecordsList');
    if (!listEl) return;
    
    // 统一数据源
    const allRecords = getAllRecords();
    const periodRecords = getRecordsByPeriod(currentPeriod, allRecords);
    
    // 根据筛选条件过滤
    const filtered = statsFilterType === 'positive'
        ? periodRecords.filter(r => (r.score || 0) > 0)
        : statsFilterType === 'negative'
            ? periodRecords.filter(r => (r.score || 0) < 0)
            : periodRecords;
    
    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>暂无记录</p></div>';
        return;
    }
    
    // 按时间倒序
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    listEl.innerHTML = filtered.map(record => {
        const time = new Date(record.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' });
        const behaviorName = record.behaviorName || record.behavior || '未知行为';
        const score = record.score || 0;
        return `
            <div class="record-item">
                <div class="record-info">
                    <div class="record-title">${behaviorName}</div>
                    <div class="record-time">${time}</div>
                </div>
                <div class="record-score ${score > 0 ? 'positive' : 'negative'}">${score > 0 ? '+' : ''}${score}</div>
            </div>
        `;
    }).join('');
}

function setStatsFilter(type) {
    // type: 'positive' | 'negative'
    statsFilterType = type;
    renderStatsRecords();
}

function openStatsRecordsModal(type) {
    setStatsFilter(type);
    const modal = document.getElementById('statsRecordsModal');
    const title = document.getElementById('statsRecordsTitle');
    if (title) {
        title.textContent = type === 'positive' ? '得分记录' : '失分记录';
    }
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
        lockBodyScroll();
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) setTimeout(() => modalContent.focus(), 0);
    }
}

function closeStatsRecordsModal() {
    const modal = document.getElementById('statsRecordsModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
        unlockBodyScroll();
    }
}

// 获取北京时间（修正：避免在东八区再次+8小时）
function getBeijingTime() {
    const now = new Date();
    // 本地时间 + (8小时 + 本地到UTC的偏移分钟) → 北京时间
    const minutesToAdd = (8 * 60) + now.getTimezoneOffset();
    return new Date(now.getTime() + minutesToAdd * 60 * 1000);
}

// 获取北京时间的日期字符串
function getBeijingDateString() {
    return getBeijingTime().toDateString();
}

function getRecordsByPeriod(period, userRecords = null) {
    // 统一数据源
    if (!userRecords) {
        userRecords = getAllRecords();
    }
    
    const now = getBeijingTime();
    const today = now.toDateString();
    
    switch (period) {
        case 'week':
            // 获取本周一的日期（自然周）
            const currentDay = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
            const mondayOffset = currentDay === 0 ? 6 : currentDay - 1; // 周日需要特殊处理
            const monday = new Date(now);
            monday.setDate(now.getDate() - mondayOffset);
            monday.setHours(0, 0, 0, 0);
            
            return userRecords.filter(record => {
                const recordDate = new Date(record.date);
                recordDate.setHours(0, 0, 0, 0); // 确保时间比较准确
                return recordDate >= monday;
            });
        case 'month':
            // 获取本月1号的日期（自然月）
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            
            return userRecords.filter(record => {
                const recordDate = new Date(record.date);
                recordDate.setHours(0, 0, 0, 0); // 确保时间比较准确
                return recordDate >= firstDayOfMonth;
            });
        case 'all':
        default:
            return userRecords;
    }
}

function getUniqueDays(records) {
    const days = [...new Set(records.map(record => record.date))];
    return days.sort((a, b) => new Date(a) - new Date(b));
}

// 自定义打分弹窗功能
function showCustomScoreModal() {
    const modal = document.getElementById('customModal');
    modal.classList.add('show');
    
    // 清空输入框
    document.getElementById('customBehaviorInput').value = '';
    document.getElementById('customScoreInput').value = '';
    
    // 聚焦到行为描述输入框
    setTimeout(() => {
        document.getElementById('customBehaviorInput').focus();
    }, 100);
}

function closeCustomModal() {
    const modal = document.getElementById('customModal');
    modal.classList.remove('show');
}

function submitCustomScore() {
    const behaviorInput = document.getElementById('customBehaviorInput');
    const scoreInput = document.getElementById('customScoreInput');
    
    const behaviorName = behaviorInput.value.trim();
    const score = parseInt(scoreInput.value);
    
    // 验证输入
    if (!behaviorName) {
        showEncouragementMessage('info', '请输入行为描述！');
        return;
    }
    
    if (isNaN(score) || score === 0) {
        showEncouragementMessage('info', '请输入有效的分值！');
        return;
    }
    
    
    
    // 创建API记录格式
    const now = new Date();
    const record = {
        userId: currentUser || FIXED_USER_ID,
        behaviorName: behaviorName,
        score: score,
        timestamp: now.toISOString(),
        date: getBeijingDateString(),
        category: 'custom',
        itemIndex: null
    };
    
    // 使用API添加记录
    apiAddRecord(record)
        .then(() => {
            // 关闭弹窗
            closeCustomModal();
            
            // 刷新界面
            refreshAllViews();
            
            // 显示成功消息
            showEncouragementMessage('positive', `已添加${behaviorName} ${score > 0 ? '+' : ''}${score}分！`);
            
            // 触觉反馈
            if (navigator.vibrate) {
                navigator.vibrate(score > 0 ? [50, 50, 50] : [100]);
            }
        })
        .catch((error) => {
            console.error('添加自定义记录失败:', error);
            showEncouragementMessage('info', `添加失败：${error.message}`);
        });
}

// 设置页面功能
function setTotalScore() {
    const input = document.getElementById('totalScoreInput');
    const newScore = parseInt(input.value);
    
    if (isNaN(newScore)) {
        showEncouragementMessage('info', '请输入有效的数字！');
        return;
    }
    
    // 用“手动调整”记录把总分拉到目标值
    const all = getAllRecords();
    const currentTotal = all.reduce((s, r) => s + (r.score || 0), 0);
    const delta = newScore - currentTotal;
    if (delta === 0) {
        showEncouragementMessage('positive', `总得分已是${newScore}分！`);
        return;
    }
    const now = new Date();
    const record = {
        userId: currentUser || FIXED_USER_ID,
        behaviorName: '手动调整总分',
        score: delta,
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

// 确认弹窗相关变量
let confirmAction = null;

function showConfirmModal(title, message, action) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmAction = action;
    
    const modal = document.getElementById('confirmModal');
    modal.classList.add('show');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
    confirmAction = null;
}

function executeConfirmAction() {
    if (confirmAction) {
        confirmAction();
    }
    closeConfirmModal();
}

function clearAllData() {
    showConfirmModal(
        '清空所有记录',
        '确定要清空所有记录吗？此操作不可恢复！',
        function() {
            const uid = currentUser || FIXED_USER_ID;
            apiClearAll(uid)
                .then(() => refreshAllViews())
                .then(() => showEncouragementMessage('info', '所有记录已清空！'))
                .catch(e => showEncouragementMessage('info', `清空失败：${e.message}`));
        }
    );
}

function resetTodayScore() {
    const today = getBeijingDateString();
    const uid = currentUser || FIXED_USER_ID;
    apiResetToday(uid, today)
        .then(() => refreshAllViews())
        .then(() => showEncouragementMessage('info', '今日得分已重置！总得分保持不变。'))
        .catch(e => showEncouragementMessage('info', `重置失败：${e.message}`));
}

// 用户管理功能
function switchUser(userName) {
    console.log('切换用户到:', userName);
    if (userName === currentUser) {
        showEncouragementMessage('info', `当前已是${userName}！`);
        return;
    }
    currentUser = userName;
    localStorage.setItem('currentUser', currentUser);
    updateUserDisplay();
    refreshAllViews().then(() => {
        renderRecords();
        updateScore();
        updateRewardCard();
        if (currentTab === 'stats') renderStats();
        showEncouragementMessage('positive', `已切换到${userName}！`);
    }).catch(console.error);
}

function quickSwitchUser() {
    // 快速切换到另一个用户
    const otherUser = currentUser === '马亦谦' ? '马熠初' : '马亦谦';
    switchUser(otherUser);
}

function updateUserDisplay() {
    // 更新头部标题
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        headerTitle.textContent = `${currentUser}的表现`;
    }
    
    // 更新设置页面的当前用户显示
    const currentUserElement = document.getElementById('currentUser');
    if (currentUserElement) {
        currentUserElement.textContent = currentUser;
    }
    
    // 更新用户按钮状态
    document.querySelectorAll('.user-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === currentUser) {
            btn.classList.add('active');
        }
    });
}

// PWA相关
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('SW registered: ', registration);
            })
            .catch(function(registrationError) {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// 测试函数
function testFunction() {
    alert('按钮点击成功！');
}

// 打开行为选择弹窗（增强：锁定滚动并聚焦）
function openBehaviorModal(categoryKey) {
    console.log('openBehaviorModal被调用，categoryKey:', categoryKey);
    
    const category = behaviorConfig.positive[categoryKey];
    if (!category) return;
    
    const modal = document.getElementById('behaviorModal');
    const title = document.getElementById('behaviorModalTitle');
    const itemsContainer = document.getElementById('behaviorItems');
    
    // 检查元素是否存在
    if (!modal || !title || !itemsContainer) {
        console.error('弹窗元素未找到');
        return;
    }
    
    title.textContent = `${category.emoji} ${category.name}`;
    
    // 生成子项目按钮
    itemsContainer.innerHTML = '';
    category.items.forEach((item, index) => {
        const todayCount = getTodayItemCount(categoryKey, index);
        const isDisabled = item.dailyLimit && todayCount >= item.dailyLimit;
        
        const button = document.createElement('button');
        button.className = `behavior-item-btn ${isDisabled ? 'disabled' : ''}`;
        button.disabled = isDisabled;
        button.onclick = () => addPositiveBehavior(categoryKey, index);
        
        const limitText = item.dailyLimit 
            ? `今日 ${todayCount}/${item.dailyLimit} 次`
            : `今日 ${todayCount} 次`;
        
        button.innerHTML = `
            <div class="behavior-item-left">
                <span class="behavior-item-emoji">${item.emoji}</span>
                <div class="behavior-item-info">
                    <span class="behavior-item-name">${item.name}</span>
                    <span class="behavior-item-limit">${limitText}</span>
                </div>
            </div>
            <span class="behavior-item-score">+${item.score}</span>
        `;
        
        itemsContainer.appendChild(button);
    });
    
    // 显示弹窗并锁定页面滚动
    modal.classList.add('show');
    modal.style.display = 'flex';
    lockBodyScroll();
    
    // 聚焦弹窗以便无障碍和滚动限制（放入微任务确保节点已渲染）
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) setTimeout(() => modalContent.focus(), 0);
}

// 关闭行为选择弹窗
function closeBehaviorModal() {
    const modal = document.getElementById('behaviorModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
        unlockBodyScroll();
    }
}

// 点击弹窗背景关闭（支持两个弹窗）
document.addEventListener('click', function(e) {
    const behaviorOverlay = document.getElementById('behaviorModal');
    const statsOverlay = document.getElementById('statsRecordsModal');
    if (behaviorOverlay && e.target === behaviorOverlay) {
        closeBehaviorModal();
    }
    if (statsOverlay && e.target === statsOverlay) {
        closeStatsRecordsModal();
    }
});

// ESC键关闭弹窗（两个弹窗）
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeBehaviorModal();
        closeStatsRecordsModal();
    }
});

// 获取今日某个子项目的使用次数
function getTodayItemCount(categoryKey, itemIndex) {
    const records = getAllRecords();
    const today = getBeijingDateString();
    
    return records.filter(record => {
        return record.date === today && 
               record.category === categoryKey && 
               record.itemIndex === itemIndex;
    }).length;
}

// 添加正面行为记录
function addPositiveBehavior(categoryKey, itemIndex) {
    console.log('addPositiveBehavior被调用:', categoryKey, itemIndex);
    
    const category = behaviorConfig.positive[categoryKey];
    const item = category.items[itemIndex];
    
    if (!category || !item) {
        console.error('找不到行为配置:', categoryKey, itemIndex);
        return;
    }
    
    // 检查次数限制
    const todayCount = getTodayItemCount(categoryKey, itemIndex);
    if (item.dailyLimit && todayCount >= item.dailyLimit) {
        showEncouragementMessage('今日次数已达上限！', 'warning');
        return;
    }
    
    // 创建记录对象（统一使用北京时间字符串）
    const now = new Date();
    const record = {
        userId: currentUser || FIXED_USER_ID,
        behaviorName: `${category.name} - ${item.name}`,
        score: item.score,
        timestamp: now.toISOString(),
        date: getBeijingDateString(),
        category: categoryKey,
        itemIndex: itemIndex
    };
    
    // 写到服务端
    apiAddRecord(record)
        .then(() => refreshAllViews())
        .catch(console.error);
    
    // 添加动画效果到触发的按钮
    const categoryButtons = document.querySelectorAll('.action-btn.positive');
    const categoryKeys = ['eating', 'studying', 'sleeping', 'exercise'];
    const buttonIndex = categoryKeys.indexOf(categoryKey);
    
    if (categoryButtons[buttonIndex]) {
        categoryButtons[buttonIndex].classList.add('animate-positive');
        setTimeout(() => {
            categoryButtons[buttonIndex].classList.remove('animate-positive');
        }, 600);
    }
    
    // 震动反馈
    if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
    }
    
    // 关闭弹窗
    closeBehaviorModal();
    
    // 显示鼓励信息
    const messages = encouragementMessages.positive;
    const message = messages[Math.floor(Math.random() * messages.length)];
    showEncouragementMessage('positive', message);
    
    console.log('记录添加成功(服务端):', record);
}

// 添加负面行为记录
function addNegativeBehavior(index) {
    console.log('addNegativeBehavior被调用，index:', index);
    const behavior = behaviorConfig.negative[index];
    console.log('behavior:', behavior);
    if (!behavior) {
        console.log('behavior不存在');
        return;
    }
    
    // 创建记录对象（统一使用北京时间字符串）
    const now = new Date();
    const record = {
        userId: currentUser || FIXED_USER_ID,
        behaviorName: behavior.name,
        score: behavior.score,
        timestamp: now.toISOString(),
        date: getBeijingDateString(),
        category: 'negative',
        itemIndex: index
    };
    
    apiAddRecord(record)
        .then(() => refreshAllViews())
        .catch(console.error);
    
    // 添加动画效果
    const buttons = document.querySelectorAll('.action-btn.negative');
    if (buttons[index]) {
        buttons[index].classList.add('animate-negative');
        setTimeout(() => {
            buttons[index].classList.remove('animate-negative');
        }, 500);
    }
    
    // 震动反馈
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }
    
    // 显示提醒信息
    const messages = encouragementMessages.negative;
    const message = messages[Math.floor(Math.random() * messages.length)];
    showEncouragementMessage('negative', message);
    
    console.log('负面行为记录已添加(服务端):', record);
}


// 全局滚动锁定工具
let isBodyLocked = false;
function preventBodyScroll(e) {
    const modalOpen = document.getElementById('behaviorModal')?.classList.contains('show') ||
                      document.getElementById('statsRecordsModal')?.classList.contains('show');
    if (modalOpen) {
        const modalContent = e.target.closest('.modal-content');
        if (!modalContent) {
            e.preventDefault();
        }
    }
}
function lockBodyScroll() {
    if (isBodyLocked) return;
    isBodyLocked = true;
    document.body.classList.add('lock-scroll');
    document.documentElement.classList.add('lock-scroll');
    document.addEventListener('touchmove', preventBodyScroll, { passive: false });
}
function unlockBodyScroll() {
    if (!isBodyLocked) return;
    isBodyLocked = false;
    document.body.classList.remove('lock-scroll');
    document.documentElement.classList.remove('lock-scroll');
    document.removeEventListener('touchmove', preventBodyScroll, { passive: false });
}

// 加载状态管理函数
function showLoadingState() {
    const loadingEl = document.querySelector('.loading');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }
}

function hideLoadingState() {
    const loadingEl = document.querySelector('.loading');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// 优化的界面更新函数，避免重复API调用
function updateScoreDisplay(userStats, isPositive = null) {
    const todayScoreElement = document.getElementById("todayScore");
    const totalScoreElement = document.getElementById("totalScore");
    const currentTotalScoreElement = document.getElementById("currentTotalScore");
    
    if (todayScoreElement) todayScoreElement.textContent = userStats.todayScore || 0;
    if (totalScoreElement) totalScoreElement.textContent = userStats.totalScore || 0;
    if (currentTotalScoreElement) currentTotalScoreElement.textContent = userStats.totalScore || 0;
    
    // 添加分数变化动画
    if (isPositive !== null && todayScoreElement && totalScoreElement) {
        const animationClass = isPositive ? "score-up" : "score-down";
        todayScoreElement.classList.add(animationClass);
        totalScoreElement.classList.add(animationClass);
        
        setTimeout(() => {
            todayScoreElement.classList.remove(animationClass);
            totalScoreElement.classList.remove(animationClass);
        }, 600);
    }
}

function updateRewardCardDisplay(todayScore) {
    const rewardCard = document.getElementById("rewardCard");
    const rewardStatus = document.getElementById("rewardStatus");
    if (!rewardCard || !rewardStatus) return;
    
    // 移除所有状态类
    rewardCard.classList.remove("available", "unavailable");
    
    if (todayScore >= 5) {
        rewardCard.classList.add("available");
        rewardStatus.textContent = "🎉 可以看电视啦！";
    } else {
        rewardCard.classList.add("unavailable");
        const needed = 5 - todayScore;
        rewardStatus.textContent = `还需要${needed}分才能看电视`;
    }
}

// 在文件末尾添加新的 API 函数
async function apiGetUserStats(userId = currentUser || FIXED_USER_ID) {
    const res = await fetchWithTimeout(`${API_BASE}/api/stats/overview?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error("get stats failed");
    return res.json();
}

// 兼容性函数：保持向后兼容，但使用优化的实现
function updateScore(isPositive = null) {
    // 单独调用时，需要获取用户统计数据
    apiGetUserStats().then(stats => {
        updateScoreDisplay(stats, isPositive);
    }).catch(console.error);
}

function updateRewardCard() {
    // 单独调用时，需要获取用户统计数据
    apiGetUserStats().then(stats => {
        updateRewardCardDisplay(stats.todayScore || 0);
    }).catch(console.error);
}
