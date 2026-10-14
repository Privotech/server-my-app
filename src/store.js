const fs = require('fs/promises');
const path = require('path');
const dataFile = path.join(__dirname, '..', 'data', 'db.json');
let writes = Promise.resolve();

async function read() {
  try { return JSON.parse(await fs.readFile(dataFile, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { users: [], accounts: [], transactions: [], support: [], cards: [] };
  }
}

function update(mutator) {
  const task = writes.then(async () => {
    const data = await read();
    const result = await mutator(data);
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    const tempFile = `${dataFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempFile, dataFile);
    return result;
  });
  writes = task.catch(() => {});
  return task;
}

module.exports = { read, update };