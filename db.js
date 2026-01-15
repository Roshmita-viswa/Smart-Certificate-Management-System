const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'db.json');

let db = {
  data: { users: [], certificates: [], requests: [], logs: [], _id: { users: 0, certificates: 0, requests: 0, logs: 0 } }
};

function read() {
  if (fs.existsSync(file)) {
    try {
      db.data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      db.data = { users: [], certificates: [], requests: [], logs: [], _id: { users: 0, certificates: 0, requests: 0, logs: 0 } };
    }
  }
}

function write() {
  fs.writeFileSync(file, JSON.stringify(db.data, null, 2));
}

function nextId(table) {
  db.data._id[table] = (db.data._id[table] || 0) + 1;
  return db.data._id[table];
}

read();

module.exports = { db, write, read, nextId };
