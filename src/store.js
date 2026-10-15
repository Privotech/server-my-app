const { MongoClient } = require('mongodb');

const stateId = 'react-bank-state';
const emptyState = { users: [], accounts: [], transactions: [], support: [], cards: [] };
let stateCollection;
let writes = Promise.resolve();

async function connect(uri) {
  if (!uri) throw new Error('Set MONGODB_URI in the environment');

  const client = new MongoClient(uri);
  await client.connect();
  stateCollection = client.db().collection('appState');
  await stateCollection.updateOne(
    { _id: stateId },
    { $setOnInsert: { ...emptyState, revision: 0 } },
    { upsert: true }
  );
}

async function read() {
  if (!stateCollection) throw new Error('MongoDB store has not been connected');

  const state = await stateCollection.findOne({ _id: stateId });
  if (!state) throw new Error('MongoDB application state is missing');
  return Object.fromEntries(
    Object.keys(emptyState).map((key) => [key, state[key] || []])
  );
}

function update(mutator) {
  if (!stateCollection) return Promise.reject(new Error('MongoDB store has not been connected'));

  const task = writes.then(async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const state = await stateCollection.findOne({ _id: stateId });
      if (!state) throw new Error('MongoDB application state is missing');

      const data = Object.fromEntries(
        Object.keys(emptyState).map((key) => [key, state[key] || []])
      );
      const result = await mutator(data);
      const saved = await stateCollection.updateOne(
        { _id: stateId, revision: state.revision },
        { $set: { ...data, revision: state.revision + 1 } }
      );

      if (saved.matchedCount === 1) return result;
    }

    throw new Error('Could not save application state after concurrent updates');
  });

  writes = task.catch(() => {});
  return task;
}

module.exports = { connect, read, update };
