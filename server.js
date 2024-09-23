const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 初始化Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 设定静态文件目录
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 初始化SQLite数据库
const db = new sqlite3.Database('./queue.db');

// 创建表格（如果不存在）
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS seats (
        id INTEGER PRIMARY KEY,
        name TEXT,
        status TEXT,
        occupiedBy TEXT,
        startTime INTEGER,
        isClosed INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT
    )`);

    db.get("SELECT COUNT(*) as count FROM seats", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO seats (name, status, occupiedBy, startTime, isClosed) VALUES (?, 'free', NULL, NULL, 0)");
            stmt.run("AP左");
            stmt.run("AP右");
            stmt.run("CA");
            stmt.finalize();
        }
    });
});

// 获取所有座位
app.get('/api/seats', (req, res) => {
    db.all("SELECT * FROM seats", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 获取队列
app.get('/api/queue', (req, res) => {
    db.all("SELECT * FROM queue ORDER BY id ASC", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 占用座位或加入队列
app.post('/api/occupy', (req, res) => {
    const { user_name, seat_id } = req.body;

    // 检查用户是否已经占用其他座位
    db.get("SELECT * FROM seats WHERE occupiedBy = ?", [user_name], (err, currentSeat) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (currentSeat) {
            res.status(400).json({ error: '您已占用了一个座位，请先释放当前座位' });
            return;
        }

        // 检查用户是否已经在队列中
        db.get("SELECT * FROM queue WHERE user_name = ?", [user_name], (err, inQueue) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (inQueue) {
                res.status(400).json({ error: '您已在队列中，无法占用座位' });
                return;
            }

            // 查找指定的座位是否空闲且未关闭
            db.get("SELECT * FROM seats WHERE id = ? AND status = 'free' AND isClosed = 0", [seat_id], (err, seat) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                if (seat) {
                    const startTime = Date.now();
                    // 占用指定的空闲座位
                    db.run("UPDATE seats SET status = 'occupied', occupiedBy = ?, startTime = ? WHERE id = ?", [user_name, startTime, seat.id], function(err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        io.emit('update');  // 发送实时更新
                        res.json({ success: true, seatName: seat.name });
                    });
                } else {
                    // 没有空闲的指定座位，将用户加入队列
                    db.run("INSERT INTO queue (user_name) VALUES (?)", [user_name], function(err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        io.emit('queue_update');  // 发送实时队列更新
                        res.json({ success: true, queued: true });
                    });
                }
            });
        });
    });
});

// 释放座位
app.post('/api/release', (req, res) => {
    const { user_name } = req.body;

    db.get("SELECT * FROM seats WHERE occupiedBy = ?", [user_name], (err, seat) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!seat) {
            res.status(400).json({ error: '您没有占用任何座位' });
            return;
        }

        // 释放座位
        db.run("UPDATE seats SET status = 'free', occupiedBy = NULL, startTime = NULL WHERE id = ?", [seat.id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            // 从队列中获取第一个用户并为其分配座位
            db.get("SELECT * FROM queue ORDER BY id ASC LIMIT 1", (err, nextUser) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                if (nextUser) {
                    const startTime = Date.now();
                    db.run("UPDATE seats SET status = 'occupied', occupiedBy = ?, startTime = ? WHERE id = ?", [nextUser.user_name, startTime, seat.id], function(err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        db.run("DELETE FROM queue WHERE id = ?", [nextUser.id], function(err) {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }
                            io.emit('update');  // 发送座位更新
                            io.emit('queue_update');  // 发送队列更新
                            io.emit('user_notified', { user_name: nextUser.user_name, seatName: seat.name });  // 通知用户
                            res.json({ success: true });
                        });
                    });
                } else {
                    io.emit('update');  // 发送座位更新
                    res.json({ success: true });
                }
            });
        });
    });
});

// 加入队列
app.post('/api/join-queue', (req, res) => {
    const { user_name } = req.body;

    if (!user_name) {
        return res.status(400).json({ success: false, error: '用户名不能为空' });
    }

    // 检查用户是否已经占用座位
    db.get("SELECT * FROM seats WHERE occupiedBy = ?", [user_name], (err, seat) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (seat) {
            return res.status(400).json({ success: false, error: '您已占用了一个座位，请先释放当前座位' });
        }

        // 检查用户是否已经在队列中
        db.get("SELECT * FROM queue WHERE user_name = ?", [user_name], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (row) {
                return res.status(400).json({ success: false, error: '您已在队列中' });
            }

            // 加入队列
            db.run("INSERT INTO queue (user_name) VALUES (?)", [user_name], function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                io.emit('queue_update');  // 实时更新队列
                res.json({ success: true });
            });
        });
    });
});

// 取消排队
app.post('/api/cancel', (req, res) => {
    const { user_name } = req.body;

    db.run("DELETE FROM queue WHERE user_name = ?", [user_name], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        io.emit('queue_update');  // 发送排队更新
        res.json({ success: true });
    });
});

// 关闭座位（仅限管理员）
app.post('/api/close-seat', (req, res) => {
    const { seat_id, user_name } = req.body;

    if (user_name !== 'Hadrian') {
        res.status(403).json({ error: '只有管理员可以关闭座位' });
        return;
    }

    db.run("UPDATE seats SET isClosed = 1, status = 'free' WHERE id = ?", [seat_id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        io.emit('update');  // 实时更新
        res.json({ success: true });
    });
});

// 打开座位（仅限管理员）
app.post('/api/open-seat', (req, res) => {
    const { seat_id, user_name } = req.body;

    if (user_name !== 'Hadrian') {
        res.status(403).json({ error: '只有管理员可以打开座位' });
        return;
    }

    db.run("UPDATE seats SET isClosed = 0 WHERE id = ?", [seat_id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        io.emit('update');  // 实时更新
        res.json({ success: true });
    });
});

// 监听端口
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器正在运行在端口 ${PORT}`);
});
