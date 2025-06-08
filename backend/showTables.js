const mysql = require('mysql2');

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'photo'
});

// 查看所有表
conn.query('SHOW TABLES', (err, results) => {
    if (err) {
        console.error('Error listing tables:', err);
    } else {
        console.log('Tables in database:');
        console.log(results);
    }

    // 检查file_uploads表结构
    conn.query('DESCRIBE file_uploads', (err, results) => {
        if (err) {
            console.error('Error describing file_uploads table:', err);
        } else {
            console.log('\nfile_uploads table structure:');
            console.log(results);
        }

        // 检查file_chunks表结构
        conn.query('DESCRIBE file_chunks', (err, results) => {
            if (err) {
                console.error('Error describing file_chunks table:', err);
            } else {
                console.log('\nfile_chunks table structure:');
                console.log(results);
            }

            conn.end();
        });
    });
}); 