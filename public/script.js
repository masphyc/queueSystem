// 更新取消排队的按钮逻辑，确保 seat_id 和 user_name 被正确传递
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
        } else {
            alert('取消排队失败: ' + data.error);
        }
    });
}

// 修改释放座位的请求，确保释放者的名字被传递
function releaseSeat(seat_id) {
    fetch('/api/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat_id, user_name: userName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.nextUser) {
                alert(`座位已释放，${data.nextUser} 已占用该座位`);
            } else {
                alert('座位已释放');
            }
        } else {
            alert('释放座位失败: ' + data.error);
        }
    });
}
