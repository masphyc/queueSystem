let userName = '';  // 存储用户名

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

    loadSeats();  // 加载座位信息
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

        const actionButton = document.createElement('button');
        
        if (seat.status === 'free') {
            actionButton.innerText = '占用';
            actionButton.addEventListener('click', () => {
                console.log('占用:', seat.name);  // 调试用
                occupySeat(seat.id);
            });
        } else if (seat.name === userName) {
            // 如果用户已经占用了这个座位，显示释放按钮
            actionButton.innerText = '释放';
            actionButton.addEventListener('click', () => {
                console.log('释放:', seat.name);  // 调试用
                releaseSeat(seat.id);
            });
        } else {
            actionButton.innerText = '加入队列';
            actionButton.addEventListener('click', () => {
                console.log('加入队列:', seat.name);  // 调试用
                joinQueue(seat.id);
            });
        }

        seatDiv.appendChild(actionButton);
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
            if (data.released) {
                alert(`您已自动释放了座位 ${data.releasedSeatName}`);
            }
            if (data.queued) {
                alert('座位已被占用，已加入队列');
            } else {
                alert('成功占用座位');
            }
            loadSeats();  // 更新座位信息
        } else {
            alert('占用座位失败');
        }
    })
    .catch(error => {
        console.error('占用座位时出错:', error);
    });
}

// 释放座位
function releaseSeat(seat_id) {
    fetch('/api/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id, user_name: userName })
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

// 加入队列
function joinQueue(seat_id) {
    fetch('/api/occupy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id, user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.queued) {
            alert('已加入队列');
            loadSeats();  // 更新座位信息
        } else {
            alert('加入队列失败');
        }
    })
    .catch(error => {
        console.error('加入队列时出错:', error);
    });
}
