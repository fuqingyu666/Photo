import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

/**
 * 使用数据库模式初始化数据库
 */
async function initializeDatabase() {
    try {
        console.log('Initializing database...');

        // 创建带有数据库名称的连接
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '123456',
            port: 3306,
            database: 'photo'
        });

        console.log('Connection established to photo database');

        // 读取模式 SQL 文件
        const schemaPath = path.join(__dirname, '../config/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // 按分号拆分 SQL 语句
        const statements = schemaSql
            .split(';')
            .filter(statement => statement.trim().length > 0);

        console.log(`Found ${statements.length} SQL statements to execute`);

        // 执行每条语句
        for (const statement of statements) {
            try {
                await connection.query(statement);
                console.log('Executed SQL statement successfully');
            } catch (err) {
                console.error('Error executing statement:', statement);
                console.error('Error details:', err);
            }
        }

        // 验证表是否已创建
        const [rows] = await connection.query('SHOW TABLES');
        console.log('Tables in photo database:', rows);

        console.log('Database initialization complete');
        await connection.end();

        return true;
    } catch (error) {
        console.error('Error initializing database:', error);
        return false;
    }
}

// 如果此脚本直接执行则运行
if (require.main === module) {
    initializeDatabase()
        .then(success => {
            if (success) {
                console.log('Database setup completed successfully');
                process.exit(0);
            } else {
                console.error('Database setup failed');
                process.exit(1);
            }
        });
}

export default initializeDatabase; 