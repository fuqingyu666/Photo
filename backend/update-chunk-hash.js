const mysql = require('mysql2');

// 创建数据库连接
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'photo'
});

// 连接数据库
connection.connect(err => {
    if (err) {
        console.error('连接数据库失败:', err);
        return;
    }
    console.log('成功连接到数据库');

    // 修改chunk_hash字段长度
    const alterQuery = `
        ALTER TABLE file_chunks 
        MODIFY chunk_hash VARCHAR(50) NOT NULL;
    `;

    connection.query(alterQuery, (err, results) => {
        if (err) {
            console.error('修改字段失败:', err);
        } else {
            console.log('成功修改chunk_hash字段长度为VARCHAR(50)');
            console.log('结果:', results);
        }

        // 查询修改后的表结构
        connection.query('DESCRIBE file_chunks', (err, results) => {
            if (err) {
                console.error('查询表结构失败:', err);
            } else {
                console.log('file_chunks表结构:');
                results.forEach(field => {
                    console.log(`${field.Field}: ${field.Type}`);
                });
            }

            // 关闭连接
            connection.end();
        });
    });
}); 