let userName = '';  // 存储用户名
let isAdmin = false;  // 判断用户是否是管理员

document.getElementById('enter').addEventListener('click', () => {
    const nameInput = document.getElementById('username').value.trim();

    if (nameInput === '') {
        alert('请输入名字');
        return;
    }

    userName = nameInput;
    isAdmin = (userName === 'Hadrian');  // 如果用户是 Hadrian，赋予管理员权限
    document.getElementById('displayName').innerText = userName;
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').style.display = 'block';

    loadSeats();  // 加载座位信息
    loadQueue();  // 加载排队信息
});

// 加载座位信息
function loadSeats() {
    fetch('/api/seats')
        .then(response => response.json())
        .then(data => {
            console.log('加载的座位数据:', data);  // 调试用
            renderSeats(data);
        })
        .catch(error => {
            console.error('加载座位时出错:', error);
        });
}

// 加载队列信息
function loadQueue() {
    fetch('/api/queue')
        .then(response => response.json())
        .then(data => {
            console.log('加载的队列数据:', data);  // 调试用
            renderQueue(data);
        })
        .catch(error => {
            console.error('加载队列时出错:', error);
        });
}

// 渲染座位
function renderSeats(seats) {
    const seatsDiv = document.getElementById('seats');
    seatsDiv.innerHTML = '';  // 清空之前的座位信息

    seats.forEach(seat => {
        const seatDiv = document.createElement('div');
        seatDiv.classList.add('seat');
        seatDiv.classList.add(seat.status === 'free' ? 'free' : 'occupied');

        const seatName = document.createElement('h3');
        seatName.innerText = seat.name;
        seatDiv.appendChild(seatName);

        // 显示当前占用者的名字
        if (seat.occupiedBy) {
            const occupiedByText = document.createElement('p');
            occupiedByText.innerText = `当前占用者: ${seat.occupiedBy}`;
            seatDiv.appendChild(occupiedByText);

            // 计时器显示占用时长
            const startTime = seat.startTime;  // 从后端传来的时间戳
            const timeDisplay = document.createElement('p');
            updateTimer(timeDisplay, startTime);  // 初始化显示
            setInterval(() => updateTimer(timeDisplay, startTime), 1000);  // 每秒更新
            seatDiv.appendChild(timeDisplay);
        }

        // 如果是管理员，提供关闭按钮
        if (isAdmin) {
            const closeButton = document.createElement('button');
            closeButton.innerText = seat.isClosed ? '打开座位' : '关闭座位';
            closeButton.addEventListener('click', () => {
                seat.isClosed ? openSeat(seat.id) : closeSeat(seat.id);
            });
            seatDiv.appendChild(closeButton);
        }

        const actionButton = document.createElement('button');
        
        if (seat.status === 'free') {
            actionButton.innerText = '占用';
            actionButton.addEventListener('click', () => {
                console.log('占用:', seat.name);  // 调试用
                occupySeat(seat.id);
            });
        } else if (seat.occupiedBy === userName) {
            // 如果用户已经占用了这个座位，显示释放按钮
            actionButton.innerText = '释放';
            actionButton.addEventListener('click', () => {
                console.log('释放:', seat.name);  // 调试用
                releaseSeat(seat.id);
            });
        }

        seatDiv.appendChild(actionButton);
        seatsDiv.appendChild(seatDiv);
    });
}

// 更新计时器
function updateTimer(element, startTime) {
    console.log("Start time from backend: ", startTime);  // 打印startTime值

    if (!startTime || isNaN(startTime)) {
        element.innerText = "计时出错，请刷新页面。";
        return;
    }

    const now = Date.now();  // 获取当前时间的时间戳
    const elapsed = now - startTime;  // 计算时间差

    if (elapsed < 0 || isNaN(elapsed)) {
        element.innerText = "计时出错，请刷新页面。";
        return;
    }

    const seconds = Math.floor((elapsed / 1000) % 60);
    const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
    const hours = Math.floor(elapsed / (1000 * 60 * 60));

    element.innerText = `占用时长: ${hours}小时 ${minutes}分钟 ${seconds}秒`;
}

// 渲染队列
function renderQueue(queue) {
    const queueDiv = document.getElementById('queue');
    queueDiv.innerHTML = '';  // 清空队列信息

    if (queue.length === 0) {
        queueDiv.innerText = '当前没有人在排队';
    } else {
        const queueList = document.createElement('ul');
        queue.forEach(user => {
            const userItem = document.createElement('li');
            userItem.innerText = user.user_name;
            queueList.appendChild(userItem);
        });
        queueDiv.appendChild(queueList);
    }
}

// 占用座位
function occupySeat(seat_id) {
    fetch('/api/occupy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`成功占用座位：${data.seatName}`);
            loadSeats();  // 更新座位信息
        } else if (data.queued) {
            alert('座位已满，您已加入队列');
            loadQueue();  // 更新队列信息
        } else {
            alert('占用座位失败：' + data.error);
        }
    })
    .catch(error => {
        console.error('占用座位时出错:', error);
    });
}

// 释放座位
function releaseSeat() {
    fetch('/api/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('座位已释放');
            loadSeats();  // 更新座位信息
        } else {
            alert('释放座位失败: ' + data.error);
        }
    })
    .catch(error => {
        console.error('释放座位时出错:', error);
    });
}

// 关闭座位（管理员权限）
function closeSeat(seat_id) {
    fetch('/api/close-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id, user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('座位已关闭');
            loadSeats();  // 更新座位信息
        } else {
            alert('关闭座位失败: ' + data.error);
        }
    })
    .catch(error => {
        console.error('关闭座位时出错:', error);
    });
}

// 打开座位（管理员权限）
function openSeat(seat_id) {
    fetch('/api/open-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id, user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('座位已打开');
            loadSeats();  // 更新座位信息
        } else {
            alert('打开座位失败: ' + data.error);
        }
    })
    .catch(error => {
        console.error('打开座位时出错:', error);
    });
}
