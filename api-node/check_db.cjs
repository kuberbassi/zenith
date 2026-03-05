const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();
        const subjects = db.collection('subjects');
        const all = await subjects.find({}).limit(10).toArray();
        console.log('Sample Subjects:', JSON.stringify(all, null, 2));
        const stats = await subjects.aggregate([
            { $group: { _id: '$semester', count: { $sum: 1 } } }
        ]).toArray();
        console.log('Semester Stats:', stats);
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
        process.exit(0);
    }
}
run();
