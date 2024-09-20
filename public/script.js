const socket = io();

// 用户名字
let userName = '';

// 登录部分逻辑
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
    loadSeats(); // 加载座位信息
});

// 加载座位和队列信息
function loadSeats() {
    fetch('/api/seats')
        .then(response => response.json())
        .then(data => {
            const seatsDiv = document.getElementById('seats');
            seatsDiv.innerHTML = ''; // 清空座位区域
            data.forEach(seat => {
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
                    actionButton.innerText = '加入队列';
                    actionButton.addEventListener('click', () => joinQueue(seat.id));
                }

                seatDiv.appendChild(actionButton);
                seatsDiv.appendChild(seatDiv);
            });
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
            alert('成功占用座位');
        } else if (data.queued) {
            alert('座位已被占用，已加入队列');
        }
        loadSeats(); // 重新加载座位信息
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
        if (data.queued) {
            alert('已加入队列');
        }
        loadSeats(); // 重新加载座位信息
    });
}
