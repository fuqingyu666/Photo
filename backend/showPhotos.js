const mysql = require('mysql2');

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'photo'
});

// 查看photos表结构
conn.query('DESCRIBE photos', (err, results) => {
    if (err) {
        console.error('Error describing photos table:', err);
    } else {
        console.log('Photos table structure:');
        console.log(results);
    }

    // 查询photos表中是否有isPrivate和isShared字段
    const fields = results.map(row => row.Field);
    console.log('\nFields in photos table:', fields);
    console.log('Has isPrivate field:', fields.includes('is_private'));
    console.log('Has isShared field:', fields.includes('is_shared'));

    conn.end();
}); 