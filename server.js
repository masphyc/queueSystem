const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const path = require('path');

// 初始化Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 设定静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 解析JSON请求
app.use(express.json());

// 初始化PostgreSQL连接池
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// 创建表格（如果不存在）
const createTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS seats (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS queue (
                id SERIAL PRIMARY KEY,
                seat_id INTEGER REFERENCES seats(id),
                user_name TEXT NOT NULL
            );
        `);
        console.log('数据库表格已创建');

        // 初始化座位（AP左，AP右，CA）如果表为空
        const res = await pool.query("SELECT COUNT(*) FROM seats");
        if (parseInt(res.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO seats (name, status) VALUES
                ('AP左', 'free'),
                ('AP右', 'free'),
                ('CA', 'free')
            `);
            console.log('座位已初始化');
        }
    } catch (err) {
        console.error('数据库初始化错误:', err);
    }
};

// 调用创建表格函数
createTables();

// API 路由

// 获取所有座位
app.get('/api/seats', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM seats');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 占用座位
app.post('/api/occupy', async (req, res) => {
    const { seat_id, user_name } = req.body;
    try {
        const seat = await pool.query('SELECT status FROM seats WHERE id = $1', [seat_id]);
        if (seat.rows.length === 0) {
            return res.status(404).json({ error: '座位不存在' });
        }

        if (seat.rows[0].status === 'free') {
            // 占用座位
            await pool.query('UPDATE seats SET status = $1, name = $2 WHERE id = $3', ['occupied', user_name, seat_id]);
            io.emit('update');
            res.json({ success: true });
        } else {
            // 座位被占用，加入队列
            await pool.query('INSERT INTO queue (seat_id, user_name) VALUES ($1, $2)', [seat_id, user_name]);
            io.emit('update');
            res.json({ success: true, queued: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 监听端口
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器正在运行在端口 ${PORT}`);
});
