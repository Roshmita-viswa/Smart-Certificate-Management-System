const bcrypt = require('bcrypt');
const { db, write, nextId } = require('./db');

async function seed() {
  const saltRounds = 10;

  // 🔹 RESET DATABASE
  db.data.users = [];
  db.data.certificates = [];
  db.data.certificate_master = [];

  // 🔹 CREATE ADMIN & MANAGEMENT
  const baseUsers = [
    { name: 'Admin User', email: 'admin', password: 'adminpass', role: 'ADMIN' },
    { name: 'Management User', email: 'management', password: 'managepass', role: 'MANAGEMENT' }
  ];

  for (const u of baseUsers) {
    const hash = await bcrypt.hash(u.password, saltRounds);
    db.data.users.push({
      id: nextId('users'),
      name: u.name,
      email: u.email,
      password: hash,
      role: u.role,
      created_at: new Date().toISOString()
    });
  }

  // 🔹 CREATE 65 STUDENTS (24UAM101 → 24UAM165)
  for (let i = 101; i <= 165; i++) {
    const username = `24UAM${i}`;
    const hash = await bcrypt.hash('studentpass', saltRounds);

    db.data.users.push({
      id: nextId('users'),
      name: username,
      email: username,     // username = email field
      password: hash,
      role: 'STUDENT',
      created_at: new Date().toISOString()
    });
  }

  // 🔹 CERTIFICATE MASTER LIST
  const certificateTypes = [
    'Aadhar Xerox',
    'Birth Certificate',
    '10th TC',
    '12th TC',
    'PAN Card Xerox',
    'Voter ID Xerox',
    'Community Certificate'
  ];

  for (const title of certificateTypes) {
    db.data.certificate_master.push({
      id: nextId('certificate_master'),
      title,
      created_at: new Date().toISOString()
    });
  }

  // 🔹 ASSIGN ALL CERTIFICATES TO ALL STUDENTS
  const students = db.data.users.filter(u => u.role === 'STUDENT');

  for (const student of students) {
    for (const cert of db.data.certificate_master) {
      db.data.certificates.push({
        id: nextId('certificates'),
        user_id: student.id,
        certificate_id: cert.id,
        title: cert.title,
        present_in_office: 0,          // ❌ Not submitted
        status: 'not_present',
        submitted_at: null,
        created_at: new Date().toISOString()
      });
    }
  }

  write();
  console.log('✅ Database seeded successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
