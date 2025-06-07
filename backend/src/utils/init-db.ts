import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import env from '../config/env';

/**
 * Initialize the database with schema
 */
async function initializeDatabase() {
    try {
        console.log('Initializing database...');

        // Create connection without database name
        const connection = await mysql.createConnection({
            host: env.DB_HOST,
            user: env.DB_USER,
            password: '', // Use empty password
            port: env.DB_PORT
        });

        // Read schema SQL file
        const schemaPath = path.join(__dirname, '../config/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Split SQL statements by semicolon
        const statements = schemaSql
            .split(';')
            .filter(statement => statement.trim().length > 0);

        // Execute each statement
        for (const statement of statements) {
            await connection.query(statement);
            console.log('Executed SQL statement');
        }

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