// 配置
const API_BASE = 'https://score-api.malisi2009.workers.dev';
const FIXED_USER_ID = 'default';
const USE_API = true;

// 全局变量
let currentUser = localStorage.getItem('currentUser') || '马亦谦';
let currentTab = 'home';
let cachedRecords = [];

// 行为配置
const behaviorConfig = {
    positive: {
        eating: {
            name: '饮食',
            items: [
                { name: '多吃蔬菜', score: 1, dailyLimit: 3 },
                { name: '多吃水果', score: 1, dailyLimit: 3 },
                { name: '多喝水', score: 1, dailyLimit: 5 },
                { name: '少吃零食', score: 2, dailyLimit: 2 }
            ]
        },
        studying: {
            name: '学习',
            items: [
                { name: '完成作业', score: 2, dailyLimit: 3 },
                { name: '阅读课外书', score: 1, dailyLimit: 2 },
                { name: '练字', score: 1, dailyLimit: 2 },
                { name: '复习功课', score: 1, dailyLimit: 2 }
            ]
        },
        sleeping: {
            name: '作息',
            items: [
                { name: '早睡早起', score: 2, dailyLimit: 1 },
                { name: '午休', score: 1, dailyLimit: 1 },
                { name: '按时睡觉', score: 1, dailyLimit: 1 }
            ]
        },
        exercise: {
            name: '运动',
            items: [
                { name: '跳绳', score: 2, dailyLimit: 2 },
                { name: '跑步', score: 2, dailyLimit: 1 },
                { name: '做操', score: 1, dailyLimit: 2 },
                { name: '户外活动', score: 1, dailyLimit: 2 }
            ]
        }
    },
    negative: [
        { name: '发脾气', score: -2 },
        { name: '不听话', score: -1 },
        { name: '浪费食物', score: -1 },
        { name: '不整理房间', score: -1 },
        { name: '看电视超时', score: -2 }
    ]
};

// 鼓励消息
const encouragementMessages = {
    positive: ['太棒了！', '继续加油！', '做得很好！', '真不错！', '继续保持！'],
    negative: ['下次要改正哦', '要努力改进', '加油改正', '下次会更好'],
    info: ['知道了', '好的', '明白']
};

// API 函数
async function apiAddRecord(record) {
    const res = await fetch(`${API_BASE}/api/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error('add record failed');
    return res.json();
}

async function apiGetRecords(userId = currentUser || FIXED_USER_ID, period = 'all') {
    const res = await fetch(`${API_BASE}/api/records?userId=${encodeURIComponent(userId)}&period=${period}`);
    if (!res.ok) throw new Error('get records failed');
    const data = await res.json();
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

async function apiGetUserStats(userId = currentUser || FIXED_USER_ID) {
    const res = await fetch(`${API_BASE}/api/stats/overview?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error('get stats failed');
    return res.json();
}

async function apiClearAll(userId) {
    const res = await fetch(`${API_BASE}/api/records/clear`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });
    if (!res.ok) throw new Error('clear failed');
}

async function apiResetToday(userId, date) {
    const res = await fetch(`${API_BASE}/api/records/reset-today`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date })
    });
    if (!res.ok) throw new Error('reset failed');
}

// 工具函数
function getBeijingDateString() {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return beijingTime.toDateString();
}

function getAllRecords() {
    return cachedRecords;
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
            rewardStatus.textContent = '�� 可以看电视啦！';
        } else {
            rewardCard.classList.add('unavailable');
            const needed = 5 - todayScore;
            rewardStatus.textContent = `还需要${needed}分才能看电视`;
        }
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

// 其他必要的函数（保持原有逻辑）
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
    
    // 动画效果
    setTimeout(() => {
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 2000);
}

function refreshAllViews() {
    return Promise.all([
        loadRecordsFromAPI(),
        updateScore(),
        updateRewardCard()
    ]);
}

async function loadRecordsFromAPI() {
    try {
        cachedRecords = await apiGetRecords(currentUser || FIXED_USER_ID, 'all');
    } catch (e) {
        console.error('loadRecordsFromAPI失败:', e);
    }
}

// 其他必要的函数...
// （这里需要包含所有其他原有函数，但使用简化的逻辑）

// 初始化
function initializeApp() {
    loadRecordsFromAPI().then(() => {
        renderRecords();
        updateScore();
        updateRewardCard();
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initializeApp);
