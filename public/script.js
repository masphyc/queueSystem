let userName = '';  // 存储用户名
let isAdmin = false;  // 判断用户是否是管理员

document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('username');
    if (savedName) {
        userName = savedName;
        isAdmin = (userName === 'Hadrian');  // 检查是否为管理员
        document.getElementById('displayName').innerText = userName;
        document.getElementById('login').style.display = 'none';
        document.getElementById('main').style.display = 'block';
        loadSeats();  // 加载座位信息
        loadQueue();  // 加载排队信息
    }
});

document.getElementById('enter').addEventListener('click', () => {
    const nameInput = document.getElementById('username').value.trim();

    if (nameInput === '') {
        alert('请输入名字');
        return;
    }

    userName = nameInput;
    isAdmin = (userName === 'Hadrian');
    localStorage.setItem('username', userName);  // 将用户名存储到 localStorage
    document.getElementById('displayName').innerText = userName;
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').style.display = 'block';

    loadSeats();
    loadQueue();
});

// 退出当前用户名并清除 localStorage
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('username');  // 移除用户名
    userName = '';
    isAdmin = false;
    document.getElementById('main').style.display = 'none';
    document.getElementById('login').style.display = 'block';  // 显示登录界面
});

// 连接Socket.io
const socket = io();

// 监听座位更新事件
socket.on('update', () => {
    loadSeats();  // 实时加载座位
    loadQueue();  // 实时加载队列
});

// 加载座位信息
function loadSeats() {
    fetch('/api/seats')
        .then(response => response.json())
        .then(data => {
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
            renderQueue(data);
        })
        .catch(error => {
            console.error('加载队列时出错:', error);
        });
}

// 渲染座位
function renderSeats(seats) {
    const seatsDiv = document.getElementById('seats');
    let allOccupiedOrClosed = true;  // 用来判断是否显示排队按钮

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

            const startTime = seat.startTime;
            const timeDisplay = document.createElement('p');

            // 检查 startTime 是否有效，如果无效则显示 0
            if (!startTime || isNaN(startTime)) {
                timeDisplay.innerText = "占用时长: 0小时 0分钟 0秒";
            } else {
                updateTimer(timeDisplay, startTime);  // 初始化显示
                setInterval(() => updateTimer(timeDisplay, startTime), 1000);  // 每秒更新
            }

            seatDiv.appendChild(timeDisplay);

            // 如果当前用户是占用者，显示释放按钮
            if (seat.occupiedBy === userName) {
                const releaseButton = document.createElement('button');
                releaseButton.innerText = '释放';
                releaseButton.addEventListener('click', () => {
                    releaseSeat();  // 释放座位逻辑
                });
                seatDiv.appendChild(releaseButton);
            }
        }

        // 如果是管理员，并且不是自己占用，显示关闭按钮
        if (isAdmin && seat.occupiedBy !== userName) {
            const closeButton = document.createElement('button');
            closeButton.innerText = seat.isClosed ? '打开座位' : '关闭座位';
            closeButton.addEventListener('click', () => {
                seat.isClosed ? openSeat(seat.id) : closeSeat(seat.id);
            });
            seatDiv.appendChild(closeButton);
        }

        // 如果座位是空闲状态并且没有被关闭，显示占用按钮
        if (seat.status === 'free' && !seat.isClosed) {
            const actionButton = document.createElement('button');
            actionButton.innerText = '占用';
            actionButton.addEventListener('click', () => {
                occupySeat(seat.id);
            });
            seatDiv.appendChild(actionButton);
        }

        // 如果座位被关闭，设置为灰色，并且禁用按钮
        if (seat.isClosed) {
            seatDiv.classList.add('closed');
            seatDiv.style.backgroundColor = 'lightgray';
        }

        // 管理员自己占用的座位显示为红色
        if (seat.occupiedBy === userName && isAdmin) {
            seatDiv.style.backgroundColor = 'red';
        }

        seatsDiv.appendChild(seatDiv);

        if (seat.status === 'free' && !seat.isClosed) {
            allOccupiedOrClosed = false;  // 有空闲座位
        }
    });

    // 显示排队按钮
    if (allOccupiedOrClosed) {
        const queueButton = document.createElement('button');
        queueButton.innerText = '加入排队';
        queueButton.addEventListener('click', () => {
            joinQueue();  // 加入队列逻辑
        });
        seatsDiv.appendChild(queueButton);
    }
}

// 更新计时器
function updateTimer(element, startTime) {
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
