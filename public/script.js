document.getElementById('enter').addEventListener('click', () => {
    const nameInput = document.getElementById('username').value.trim();

    if (nameInput === '') {
        alert('请输入名字');
        return;
    }

    console.log('输入的名字:', nameInput); // 调试用，确保名字输入正确

    document.getElementById('displayName').innerText = nameInput;
    document.getElementById('login').style.display = 'none';
    document.getElementById('main').style.display = 'block';

    loadSeats();  // 加载座位信息
});

// 示例加载座位的函数
function loadSeats() {
    fetch('/api/seats')
        .then(response => response.json())
        .then(data => {
            console.log('座位数据:', data);  // 调试用，确保获取到座位数据
            renderSeats(data);
        })
        .catch(error => {
            console.error('加载座位时出错:', error);
        });
}

// 假设渲染座位的函数
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

        seatsDiv.appendChild(seatDiv);
    });
}
