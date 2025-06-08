import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

/**
 * Initialize the database with schema
 */
async function initializeDatabase() {
    try {
        console.log('Initializing database...');

        // Create connection with database name
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '123456',
            port: 3306,
            database: 'photo'
        });

        console.log('Connection established to photo database');

        // Read schema SQL file
        const schemaPath = path.join(__dirname, '../config/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Split SQL statements by semicolon
        const statements = schemaSql
            .split(';')
            .filter(statement => statement.trim().length > 0);

        console.log(`Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        for (const statement of statements) {
            try {
                await connection.query(statement);
                console.log('Executed SQL statement successfully');
            } catch (err) {
                console.error('Error executing statement:', statement);
                console.error('Error details:', err);
            }
        }

        // Verify tables were created
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

// Run if this script is executed directly
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