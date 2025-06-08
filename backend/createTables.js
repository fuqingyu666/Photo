const mysql = require('mysql2');

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'photo'
});

// 向photos表添加is_private和is_shared字段
conn.query(`
ALTER TABLE photos
ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN is_shared TINYINT(1) NOT NULL DEFAULT 1
`, (err, results) => {
    if (err) {
        console.error('Error adding fields to photos table:', err);
    } else {
        console.log('Successfully added is_private and is_shared fields to photos table');
        console.log(results);
    }

    // 检查修改后的表结构
    conn.query('DESCRIBE photos', (err, results) => {
        if (err) {
            console.error('Error describing photos table:', err);
        } else {
            console.log('\nUpdated photos table structure:');
            console.log(results);
        }

        conn.end();
    });
}); 