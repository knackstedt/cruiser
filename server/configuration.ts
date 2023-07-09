import Surreal from 'surrealdb.js';

const db = new Surreal('http://127.0.0.1:8000/rpc');
(async () => {
    await db.signin({
        user: 'root',
        pass: 'root',
    });
    await db.use({ ns: '@dotglitch', db: 'dotops' });
})();
