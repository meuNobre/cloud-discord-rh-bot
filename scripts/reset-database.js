const Database = require("../database/database")

async function resetDatabase() {
  console.log("🔄 Iniciando reset completo do banco de dados...")

  const database = new Database()

  try {
    // Conectar ao banco
    await database.connect()
    console.log("✅ Conectado ao banco de dados")

    // Lista de todas as tabelas para dropar
    const tables = [
      "recruitment_invites",
      "recruitment_processes",
      "process_participants",
      "support_tickets",
      "ticket_messages",
      "ticket_history",
    ]

    // Dropar todas as tabelas
    for (const table of tables) {
      try {
        await database.db.run(`DROP TABLE IF EXISTS ${table}`)
        console.log(`🗑️ Tabela ${table} removida`)
      } catch (error) {
        console.log(`⚠️ Erro ao remover ${table}: ${error.message}`)
      }
    }

    console.log("✅ Todas as tabelas foram removidas")

    // Recriar estrutura básica
    await createBasicTables(database)

    console.log("🎉 Reset completo finalizado!")
    console.log("📊 Banco de dados limpo e pronto para uso")
  } catch (error) {
    console.error("❌ Erro durante reset:", error.message)
  } finally {
    database.close()
  }
}

async function createBasicTables(database) {
  console.log("🔧 Recriando estrutura básica...")

  // Tabela de tickets
  await database.db.run(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      reason TEXT,
      thread_id TEXT UNIQUE,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      closed_by TEXT
    )
  `)
  console.log("✅ Tabela support_tickets criada")

  // Tabela de processos
  await database.db.run(`
    CREATE TABLE IF NOT EXISTS recruitment_processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME
    )
  `)
  console.log("✅ Tabela recruitment_processes criada")

  // Tabela de convites
  await database.db.run(`
    CREATE TABLE IF NOT EXISTS recruitment_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      message_id TEXT,
      status TEXT DEFAULT 'pending',
      sent_by TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      invite_url TEXT,
      confirmation_message_id TEXT,
      confirmation_channel_id TEXT
    )
  `)
  console.log("✅ Tabela recruitment_invites criada")

  // Tabela de participantes
  await database.db.run(`
    CREATE TABLE IF NOT EXISTS process_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      process_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (process_id) REFERENCES recruitment_processes (id)
    )
  `)
  console.log("✅ Tabela process_participants criada")

  console.log("🎯 Estrutura básica recriada com sucesso!")
}

// Executar reset
resetDatabase()
