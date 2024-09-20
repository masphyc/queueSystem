const socket = io();

// 用户名字
let userName = '';

// 座位数据
let seats = [];

// 登录部分
document.getElementById('enter').addEventListener('click', () => {
    const nameInput = document.getElementById('username').value.trim();
    if (nameInput === '') {
        alert('请输入名字');
        return;
    }
    userName = nameInput;
    document.getElementById('displayName').innerText = userName;
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').style.display = 'block';
    loadSeats();
});

// 加载座位和队列信息
function loadSeats() {
    fetch('/api/seats')
        .then(response => response.json())
        .then(data => {
            seats = data;
            renderSeats();
        });
}

// 渲染座位
function renderSeats() {
    const seatsDiv = document.getElementById('seats');
    seatsDiv.innerHTML = '';
    seats.forEach(seat => {
        const seatDiv = document.createElement('div');
        seatDiv.classList.add('seat');
        seatDiv.classList.add(seat.status === 'free' ? 'free' : 'occupied');

        const seatName = document.createElement('h3');
        seatName.innerText = seat.name;
        seatDiv.appendChild(seatName);

        const seatStatus = document.createElement('p');
        seatStatus.innerText = seat.status === 'free' ? '空闲' : `被 ${seat.name} 占用`;
        seatDiv.appendChild(seatStatus);

        const actionButton = document.createElement('button');

        if (seat.status === 'free') {
            actionButton.innerText = '占用';
            actionButton.addEventListener('click', () => occupySeat(seat.id));
        } else {
            if (seat.name === userName) {
                // 当前用户占用了该座位，可以释放
                actionButton.innerText = '释放';
                actionButton.addEventListener('click', () => releaseSeat(seat.id));
            } else {
                actionButton.innerText = '加入队列';
                actionButton.addEventListener('click', () => joinQueue(seat.id));
            }
        }

        seatDiv.appendChild(actionButton);

        // 显示队列
        fetch(`/api/queue/${seat.id}`)
            .then(response => response.json())
            .then(queue => {
                if (queue.length > 0) {
                    const queueList = document.createElement('ul');
                    queue.forEach((q, index) => {
                        const listItem = document.createElement('li');
                        listItem.innerText = `${index + 1}. ${q.user_name}`;
                        // 如果是当前用户且在队列中，添加取消按钮
                        if (q.user_name === userName) {
                            const cancelBtn = document.createElement('button');
                            cancelBtn.innerText = '取消';
                            cancelBtn.style.marginLeft = '10px';
                            cancelBtn.addEventListener('click', () => cancelQueue(seat.id));
                            listItem.appendChild(cancelBtn);
                        }
                        queueList.appendChild(listItem);
                    });
                    seatDiv.appendChild(queueList);
                }
            });

        seatsDiv.appendChild(seatDiv);
    });
}

// 占用座位
function occupySeat(seat_id) {
    fetch('/api/occupy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id, user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.queued) {
                alert('座位已被占用，已加入队列');
            } else {
                alert('成功占用座位');
            }
        }
    });
}

// 加入队列
function joinQueue(seat_id) {
    fetch('/api/occupy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id, user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.queued) {
                alert('已加入队列');
            }
        }
    });
}

// 取消排队
function cancelQueue(seat_id) {
    fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id, user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('已取消排队');
        }
    });
}

// 释放座位（仅当前占用者可以释放）
function releaseSeat(seat_id) {
    fetch('/api/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' 
