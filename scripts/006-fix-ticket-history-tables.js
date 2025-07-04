const path = require("path")
const sqlite3 = require("sqlite3").verbose()

const dbPath = path.join(__dirname, "../database/recruitment.db")
const db = new sqlite3.Database(dbPath)

function columnExists(table, column) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) return reject(err)
      resolve(rows.some((col) => col.name === column))
    })
  })
}

async function runMigration() {
  try {
    const hasCreatedAt = await columnExists("support_tickets", "created_at")

    if (!hasCreatedAt) {
      await new Promise((resolve, reject) => {
        db.run(
          "ALTER TABLE support_tickets ADD COLUMN created_at TEXT DEFAULT (datetime('now'))",
          (err) => {
            if (err) return reject(err)
            console.log("✅ Coluna 'created_at' adicionada à tabela support_tickets")
            resolve()
          }
        )
      })
    } else {
      console.log("ℹ️ Coluna 'created_at' já existe na tabela support_tickets")
    }

    db.close()
  } catch (err) {
    console.error("❌ Erro durante a migração condicional:", err)
    db.close()
  }
}

runMigration()
