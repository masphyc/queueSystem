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
        name TEXT,         -- 座位的名称，如 "AP左"
        status TEXT,       -- 座位状态 "free" 或 "occupied"
        occupiedBy TEXT    -- 占用者的名字
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seat_id INTEGER,
        user_name TEXT
    )`);

    // 初始化座位（AP左，AP右，CA）如果表为空
    db.get("SELECT COUNT(*) as count FROM seats", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO seats (name, status, occupiedBy) VALUES (?, 'free', NULL)");
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

// 占用座位或加入队列
app.post('/api/occupy', (req, res) => {
    const { seat_id, user_name } = req.body;

    // 检查用户是否已经占用其他座位
    db.get("SELECT * FROM seats WHERE occupiedBy = ?", [user_name], (err, currentSeat) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        let releasedSeatName = null;
        
        // 如果用户占用了其他座位，释放该座位
        if (currentSeat) {
            db.run("UPDATE seats SET status = 'free', occupiedBy = NULL WHERE id = ?", [currentSeat.id], function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                releasedSeatName = currentSeat.name;
            });
        }

        // 检查座位是否空闲
        db.get("SELECT status FROM seats WHERE id = ?", [seat_id], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (row.status === 'free') {
                // 占用座位
                db.run("UPDATE seats SET status = ?, occupiedBy = ? WHERE id = ?", ['occupied', user_name, seat_id], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    io.emit('update');  // 发送实时更新
                    res.json({ success: true, released: releasedSeatName, releasedSeatName: currentSeat ? currentSeat.name : null });
                });
            } else {
                // 座位已被占用，加入队列
                db.run("INSERT INTO queue (seat_id, user_name) VALUES (?, ?)", [seat_id, user_name], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    io.emit('update');  // 发送实时更新
                    res.json({ success: true, queued: true });
                });
            }
        });
    });
});

// 释放座位
app.post('/api/release', (req, res) => {
    const { seat_id, user_name } = req.body;

    // 检查用户是否占用了该座位
    db.get("SELECT * FROM seats WHERE id = ? AND occupiedBy = ?", [seat_id, user_name], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!row) {
            res.status(403).json({ error: '您未占用此座位，无法释放' });
            return;
        }

        // 释放座位
        db.run("UPDATE seats SET status = 'free', occupiedBy = NULL WHERE id = ?", [seat_id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            io.emit('update');  // 发送实时更新
            res.json({ success: true });
        });
    });
});

// 监听端口
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器正在运行在端口 ${PORT}`);
});
