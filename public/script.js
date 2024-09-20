let userName = '';  // 存储用户名
let isAdmin = false;  // 判断用户是否是管理员

document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('username');
    if (savedName) {
        userName = savedName;
        isAdmin = (userName === 'Hadrian');
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
    localStorage.setItem('username', userName);
    document.getElementById('displayName').innerText = userName;
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').style.display = 'block';

    loadSeats();
    loadQueue();
});

// 退出当前用户名并清除 localStorage
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('username');
    userName = '';
    isAdmin = false;
    document.getElementById('main').style.display = 'none';
    document.getElementById('login').style.display = 'block';
});

// 连接Socket.io
const socket = io();

// 监听座位和队列更新事件
socket.on('update', () => {
    loadSeats();
    loadQueue();
});

socket.on('queue_update', () => {
    loadQueue();
});

socket.on('user_notified', ({ user_name, seatName }) => {
    if (userName === user_name) {
        alert(`您已成功占用座位：${seatName}`);
    }
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
    seatsDiv.innerHTML = '';

    seats.forEach(seat => {
        const seatDiv = document.createElement('div');
        seatDiv.classList.add('seat');
        seatDiv.classList.add(seat.status === 'free' ? 'free' : 'occupied');

        const seatName = document.createElement('h3');
        seatName.innerText = seat.name;
        seatDiv.appendChild(seatName);

        if (seat.occupiedBy) {
            const occupiedByText = document.createElement('p');
            occupiedByText.innerText = `当前占用者: ${seat.occupiedBy}`;
            seatDiv.appendChild(occupiedByText);

            const startTime = seat.startTime;
            const timeDisplay = document.createElement('p');

            if (!startTime || isNaN(startTime)) {
                timeDisplay.innerText = "占座中...";
            } else {
                updateTimer(timeDisplay, startTime);
                setInterval(() => updateTimer(timeDisplay, startTime), 1000);
            }

            seatDiv.appendChild(timeDisplay);

            if (seat.occupiedBy === userName) {
                const releaseButton = document.createElement('button');
                releaseButton.innerText = '释放';
                releaseButton.addEventListener('click', () => {
                    releaseSeat();
                });
                seatDiv.appendChild(releaseButton);
            }
        }

        if (isAdmin && seat.occupiedBy !== userName) {
            const closeButton = document.createElement('button');
            closeButton.innerText = seat.isClosed ? '打开座位' : '关闭座位';
            closeButton.addEventListener('click', () => {
                seat.isClosed ? openSeat(seat.id) : closeSeat(seat.id);
            });
            seatDiv.appendChild(closeButton);
        }

        if (seat.status === 'free' && !seat.isClosed) {
            const actionButton = document.createElement('button');
            actionButton.innerText = '占用';
            actionButton.addEventListener('click', () => {
                occupySeat(seat.id);
            });
            seatDiv.appendChild(actionButton);
        }

        if (seat.isClosed) {
            seatDiv.classList.add('closed');
            seatDiv.style.backgroundColor = 'lightgray';
        }

        // 管理员自己占用的座位显示为红色
        if (seat.occupiedBy === userName && isAdmin) {
            seatDiv.style.backgroundColor = 'red';
        }

        seatsDiv.appendChild(seatDiv);
    });
}

// 更新计时器
function updateTimer(element, startTime) {
    const now = Date.now();
    const elapsed = now - startTime;

    if (elapsed < 0 || isNaN(elapsed)) {
        element.innerText = "占座中...";
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
    queueDiv.innerHTML = '';

    if (queue.length === 0) {
        queueDiv.innerText = '当前没有人在排队';
    } else {
        const queueList = document.createElement('ul');
        queueList.classList.add('queue-list');

        queue.forEach(user => {
            const queueItem = document.createElement('li');
            queueItem.classList.add('queue-item');

            const userNameSpan = document.createElement('span');
            userNameSpan.innerText = user.user_name;
            queueItem.appendChild(userNameSpan);

            const cancelButton = document.createElement('button');
            cancelButton.innerText = '取消排队';
            cancelButton.addEventListener('click', () => {
                cancelQueue(user.user_name);
            });
            queueItem.appendChild(cancelButton);

            queueList.appendChild(queueItem);
        });

        queueDiv.appendChild(queueList);
    }
}

// 加入队列
function joinQueue() {
    fetch('/api/join-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('您已成功加入队列');
            loadQueue();
        } else {
            alert('加入队列失败：' + data.error);
        }
    })
    .catch(error => {
        console.error('加入队列时出错:', error);
    });
}

// 占用座位
function occupySeat(seat_id) {
    fetch('/api/occupy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName, seat_id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(`成功占用座位：${data.seatName}`);
            loadSeats();
        } else if (data.queued) {
            alert('座位已满，您已加入队列');
            loadQueue();
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
            loadSeats();
        } else {
            alert('释放座位失败: ' + data.error);
        }
    })
    .catch(error => {
        console.error('释放座位时出错:', error);
    });
}

// 取消排队
function cancelQueue(user_name) {
    fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('排队已取消');
            loadQueue();
        } else {
            alert('取消排队失败：' + data.error);
        }
    })
    .catch(error => {
        console.error('取消排队时出错:', error);
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
            loadSeats();
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
            loadSeats();
        } else {
            alert('打开座位失败: ' + data.error);
        }
    })
    .catch(error => {
        console.error('打开座位时出错:', error);
    });
}
