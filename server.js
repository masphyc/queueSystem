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

// 解析JSON请求
app.use(express.json());

// 初始化SQLite数据库
const db = new sqlite3.Database('./queue.db');

// 创建表格（如果不存在）
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS seats (
        id INTEGER PRIMARY KEY,
        name TEXT,
        status TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seat_id INTEGER,
        user_name TEXT
    )`);

    // 初始化座位（AP左，AP右，CA）如果表为空
    db.get("SELECT COUNT(*) as count FROM seats", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO seats (name, status) VALUES (?, ?)");
            stmt.run("AP左", "free");
            stmt.run("AP右", "free");
            stmt.run("CA", "free");
            stmt.finalize();
        }
    });
});

// API路由示例
app.get('/api/seats', (req, res) => {
    db.all("SELECT * FROM seats", (err, rows) => {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        res.json(rows);
    });
});

app.get('/api/queue/:seat_id', (req, res) => {
    const seatId = req.params.seat_id;
    db.all("SELECT * FROM queue WHERE seat_id = ? ORDER BY id ASC", [seatId], (err, rows) => {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        res.json(rows);
    });
});

// 监听端口
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器正在运行在端口 ${PORT}`);
});

// 占用座位
app.post('/api/occupy', (req, res) => {
    const { seat_id, user_name } = req.body;
    // 检查座位是否空闲
    db.get("SELECT status FROM seats WHERE id = ?", [seat_id], (err, row) => {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        if (row.status === 'free') {
            // 占用座位
            db.run("UPDATE seats SET status = ?, name = ? WHERE id = ?", ['occupied', user_name, seat_id], function(err) {
                if (err) {
                    res.status(500).json({error: err.message});
                    return;
                }
                io.emit('update');
                res.json({success: true});
            });
        } else {
            // 座位被占用，加入队列
            db.run("INSERT INTO queue (seat_id, user_name) VALUES (?, ?)", [seat_id, user_name], function(err) {
                if (err) {
                    res.status(500).json({error: err.message});
                    return;
                }
                io.emit('update');
                res.json({success: true, queued: true});
            });
        }
    });
});

// 释放座位
app.post('/api/release', (req, res) => {
    const { seat_id } = req.body;
    // 查找队列中的下一个用户
    db.get("SELECT * FROM queue WHERE seat_id = ? ORDER BY id ASC", [seat_id], (err, row) => {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        if (row) {
            // 有人排队，自动占用座位给下一个用户
            db.run("UPDATE seats SET status = ?, name = ? WHERE id = ?", ['occupied', row.user_name, seat_id], function(err) {
                if (err) {
                    res.status(500).json({error: err.message});
                    return;
                }
                // 移除队列中的第一个用户
                db.run("DELETE FROM queue WHERE id = ?", [row.id], function(err) {
                    if (err) {
                        res.status(500).json({error: err.message});
                        return;
                    }
                    io.emit('update');
                    res.json({success: true, nextUser: row.user_name});
                });
            });
        } else {
            // 没有排队的人，直接释放座位
            db.run("UPDATE seats SET status = ?, name = NULL WHERE id = ?", ['free', seat_id], function(err) {
                if (err) {
                    res.status(500).json({error: err.message});
                    return;
                }
                io.emit('update');
                res.json({success: true});
            });
        }
    });
});

// 取消排队
app.post('/api/cancel', (req, res) => {
    const { seat_id, user_name } = req.body;
    db.run("DELETE FROM queue WHERE seat_id = ? AND user_name = ?", [seat_id, user_name], function(err) {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        io.emit('update');
        res.json({success: true});
    });
});
