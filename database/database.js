const sqlite3 = require("sqlite3").verbose()
const path = require("path")
const fs = require("fs")

class Database {
  constructor() {
    this.db = null
    this.init()
  }

  init() {
    const dbPath = path.join(__dirname, "recruitment.db")
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("❌ Erro ao conectar com o banco de dados:", err)
      } else {
        console.log("✅ Conectado ao banco de dados SQLite")
        this.runMigrations()
      }
    })
  }

  runMigrations() {
    const scriptsPath = path.join(__dirname, "../scripts")
    if (!fs.existsSync(scriptsPath)) return

    const sqlFiles = fs
      .readdirSync(scriptsPath)
      .filter((file) => file.endsWith(".sql"))
      .sort()

    sqlFiles.forEach((file) => {
      const filePath = path.join(scriptsPath, file)
      const sql = fs.readFileSync(filePath, "utf8")
      this.db.exec(sql, (err) => {
        if (err) {
          console.error(`❌ Erro ao executar ${file}:`, err)
        } else {
          console.log(`✅ Executado: ${file}`)
        }
      })
    })
  }

  // ===== MÉTODOS PARA PROCESSOS SELETIVOS =====
  async createProcess(name, description, startedBy, settings = {}) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO selection_processes 
        (name, description, started_by, settings)
        VALUES (?, ?, ?, ?)
      `
      this.db.run(sql, [name, description, startedBy, JSON.stringify(settings)], function (err) {
        if (err) reject(err)
        else resolve(this.lastID)
      })
    })
  }

  async getActiveProcess() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM selection_processes WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`
      this.db.get(sql, [], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async endProcess(processId, endedBy) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE selection_processes 
        SET status = 'completed', ended_at = CURRENT_TIMESTAMP, ended_by = ?
        WHERE id = ?
      `
      this.db.run(sql, [endedBy, processId], function (err) {
        if (err) reject(err)
        else resolve(this.changes)
      })
    })
  }

  async getAllProcesses(limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM selection_processes 
        ORDER BY started_at DESC 
        LIMIT ?
      `
      this.db.all(sql, [limit], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  // ===== MÉTODOS PARA PARTICIPANTES =====
  async addParticipant(processId, userId, username) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO process_participants 
        (process_id, user_id, username)
        VALUES (?, ?, ?)
      `
      this.db.run(sql, [processId, userId, username], function (err) {
        if (err) reject(err)
        else resolve(this.lastID)
      })
    })
  }

  async getProcessParticipants(processId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM process_participants 
        WHERE process_id = ?
        ORDER BY joined_at DESC
      `
      this.db.all(sql, [processId], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  async updateParticipantStatus(participantId, status, phase = null, score = null, notes = null) {
    return new Promise((resolve, reject) => {
      let sql = `UPDATE process_participants SET status = ?`
      const params = [status]

      if (phase !== null) {
        sql += `, phase = ?`
        params.push(phase)
      }
      if (score !== null) {
        sql += `, score = ?`
        params.push(score)
      }
      if (notes !== null) {
        sql += `, notes = ?`
        params.push(notes)
      }

      sql += ` WHERE id = ?`
      params.push(participantId)

      this.db.run(sql, params, function (err) {
        if (err) reject(err)
        else resolve(this.changes)
      })
    })
  }

  // ===== MÉTODOS PARA ENTREVISTAS =====
  async createInterview(processId, participantId, interviewerId, interviewerName) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO interviews 
        (process_id, participant_id, interviewer_id, interviewer_name)
        VALUES (?, ?, ?, ?)
      `
      this.db.run(sql, [processId, participantId, interviewerId, interviewerName], function (err) {
        if (err) reject(err)
        else resolve(this.lastID)
      })
    })
  }

  async startInterview(interviewId) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE interviews 
        SET status = 'in_progress', started_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `
      this.db.run(sql, [interviewId], function (err) {
        if (err) reject(err)
        else resolve(this.changes)
      })
    })
  }

  async endInterview(interviewId, result, score, comments, feedback) {
    return new Promise((resolve, reject) => {
      const endTime = new Date()
      // Primeiro, pegar o tempo de início
      this.db.get("SELECT started_at FROM interviews WHERE id = ?", [interviewId], (err, row) => {
        if (err) {
          reject(err)
          return
        }

        const startTime = new Date(row.started_at)
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60))

        const sql = `
          UPDATE interviews 
          SET status = 'completed', ended_at = CURRENT_TIMESTAMP,
              duration_minutes = ?, result = ?, score = ?, comments = ?, feedback = ?
          WHERE id = ?
        `

        this.db.run(sql, [durationMinutes, result, score, comments, feedback, interviewId], function (err) {
          if (err) reject(err)
          else resolve({ changes: this.changes, duration: durationMinutes })
        })
      })
    })
  }

  async getInterview(interviewId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT i.*, p.username as participant_name, p.user_id as participant_user_id
        FROM interviews i
        JOIN process_participants p ON i.participant_id = p.id
        WHERE i.id = ?
      `
      this.db.get(sql, [interviewId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async getProcessInterviews(processId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT i.*, p.username as participant_name, p.user_id as participant_user_id
        FROM interviews i
        JOIN process_participants p ON i.participant_id = p.id
        WHERE i.process_id = ?
        ORDER BY i.started_at DESC
      `
      this.db.all(sql, [processId], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  // ===== MÉTODOS PARA RELATÓRIOS =====
  async getProcessStats(processId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_participants,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'interviewing' THEN 1 END) as interviewing,
          AVG(score) as average_score
        FROM process_participants 
        WHERE process_id = ?
      `
      this.db.get(sql, [processId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async getInterviewStats(processId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_interviews,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN result = 'approved' THEN 1 END) as approved_interviews,
          COUNT(CASE WHEN result = 'rejected' THEN 1 END) as rejected_interviews,
          AVG(duration_minutes) as avg_duration,
          AVG(score) as avg_interview_score
        FROM interviews 
        WHERE process_id = ?
      `
      this.db.get(sql, [processId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  // ===== MÉTODOS PARA CONVITES =====
  async createInvite(userId, username, messageId, sentBy, expiresAt) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO recruitment_invites 
        (user_id, username, message_id, sent_by, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `
      this.db.run(sql, [userId, username, messageId, sentBy, expiresAt], function (err) {
        if (err) reject(err)
        else resolve(this.lastID)
      })
    })
  }

  // MÉTODO FALTANTE - Este era o problema principal!
  async getPendingInviteByUser(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM recruitment_invites 
        WHERE user_id = ? AND status = 'pending' 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        ORDER BY sent_at DESC 
        LIMIT 1
      `
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          console.error("❌ Erro ao buscar convite pendente:", err)
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  async updateInviteStatus(userId, messageId, status, inviteUrl = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE recruitment_invites 
        SET status = ?, responded_at = CURRENT_TIMESTAMP, invite_url = ?
        WHERE user_id = ? AND message_id = ?
      `
      this.db.run(sql, [status, inviteUrl, userId, messageId], function (err) {
        if (err) reject(err)
        else resolve(this.changes)
      })
    })
  }

  async updateInviteConfirmationMessage(userId, messageId, confirmationMessageId, confirmationChannelId) {
    return new Promise((resolve, reject) => {
      // Primeiro, verificar se as colunas existem
      this.db.all("PRAGMA table_info(recruitment_invites)", (err, columns) => {
        if (err) {
          reject(err)
          return
        }

        const hasConfirmationColumns = columns.some(
          (col) => col.name === "confirmation_message_id" || col.name === "confirmation_channel_id",
        )

        if (!hasConfirmationColumns) {
          // Adicionar as colunas se não existirem
          this.db.serialize(() => {
            this.db.run("ALTER TABLE recruitment_invites ADD COLUMN confirmation_message_id TEXT", (err) => {
              if (err && !err.message.includes("duplicate column")) {
                console.error("❌ Erro ao adicionar coluna confirmation_message_id:", err)
              }
            })

            this.db.run("ALTER TABLE recruitment_invites ADD COLUMN confirmation_channel_id TEXT", (err) => {
              if (err && !err.message.includes("duplicate column")) {
                console.error("❌ Erro ao adicionar coluna confirmation_channel_id:", err)
              }
            })
          })
        }

        // Executar o update
        const sql = `
          UPDATE recruitment_invites 
          SET confirmation_message_id = ?, confirmation_channel_id = ?
          WHERE user_id = ? AND message_id = ?
        `
        this.db.run(sql, [confirmationMessageId, confirmationChannelId, userId, messageId], function (err) {
          if (err) reject(err)
          else resolve(this.changes)
        })
      })
    })
  }

  async getInviteByConfirmationMessage(confirmationMessageId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM recruitment_invites 
        WHERE confirmation_message_id = ?
        ORDER BY sent_at DESC LIMIT 1
      `
      this.db.get(sql, [confirmationMessageId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async getInviteStatus(userId, messageId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM recruitment_invites 
        WHERE user_id = ? AND message_id = ?
        ORDER BY sent_at DESC LIMIT 1
      `
      this.db.get(sql, [userId, messageId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  // ===== MÉTODOS PARA TICKETS =====
  async createTicket(userId, username, discordName, reason, threadId) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO support_tickets 
        (user_id, username, discord_name, reason, thread_id, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `
      this.db.run(sql, [userId, username, discordName, reason, threadId], function (err) {
        if (err) reject(err)
        else resolve(this.lastID)
      })
    })
  }

  async closeTicket(threadId, closedBy) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE support_tickets 
        SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?
        WHERE thread_id = ?
      `
      this.db.run(sql, [closedBy, threadId], function (err) {
        if (err) reject(err)
        else resolve(this.changes)
      })
    })
  }

  async getTicketByThread(threadId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM support_tickets WHERE thread_id = ?`
      this.db.get(sql, [threadId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async getActiveTicketByUser(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM support_tickets 
        WHERE user_id = ? AND status = 'open'
        ORDER BY created_at DESC LIMIT 1
      `
      this.db.get(sql, [userId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  // ===== MÉTODOS PARA HISTÓRICO DE TICKETS =====
  async addTicketMessage(ticketId, authorId, authorName, content, messageType, attachments = null, embedData = null) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO ticket_messages 
        (ticket_id, author_id, author_name, content, message_type, attachments, embed_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      const attachmentsJson = attachments ? JSON.stringify(attachments) : null
      const embedJson = embedData ? JSON.stringify(embedData) : null

      this.db.run(
        sql,
        [ticketId, authorId, authorName, content, messageType, attachmentsJson, embedJson],
        function (err) {
          if (err) reject(err)
          else resolve(this.lastID)
        },
      )
    })
  }

  async getTicketMessages(ticketId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM ticket_messages 
        WHERE ticket_id = ?
        ORDER BY created_at ASC
      `
      this.db.all(sql, [ticketId], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  async saveTicketSummary(summary) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO ticket_summaries (
          ticket_id, user_id, user_name, reason, created_at, closed_at,
          total_messages, staff_responses, user_messages, resolution_time_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `

      this.db.run(
        query,
        [
          summary.ticket_id,
          summary.user_id,
          summary.user_name,
          summary.reason,
          summary.created_at,
          summary.closed_at,
          summary.total_messages,
          summary.staff_responses,
          summary.user_messages,
          summary.resolution_time_minutes,
        ],
        function (err) {
          if (err) {
            console.error("Erro ao salvar resumo do ticket:", err)
            reject(err)
          } else {
            resolve(this.lastID)
          }
        },
      )
    })
  }

  async getTicketSummary(ticketId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM ticket_summaries 
        WHERE ticket_id = ?
      `
      this.db.get(query, [ticketId], (err, row) => {
        if (err) {
          console.error("Erro ao buscar resumo do ticket:", err)
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  // ===== MÉTODOS PARA ESTATÍSTICAS =====
  async getRecruitmentStats(days = 30) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_invites,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
          COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
          COUNT(CASE WHEN status = 'entered' THEN 1 END) as entered
        FROM recruitment_invites 
        WHERE sent_at >= datetime('now', '-${days} days')
      `
      this.db.get(sql, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async getTicketStats(days = 30) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
          AVG(
            CASE WHEN closed_at IS NOT NULL 
            THEN (julianday(closed_at) - julianday(created_at)) * 24 
            END
          ) as avg_resolution_hours
        FROM support_tickets 
        WHERE created_at >= datetime('now', '-${days} days')
      `
      this.db.get(sql, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  async getRecentInvites(limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM recruitment_invites 
        ORDER BY sent_at DESC 
        LIMIT ?
      `
      this.db.all(sql, [limit], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  async getRecentInvitesByUser(userId, limit = 5) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM recruitment_invites 
        WHERE user_id = ?
        ORDER BY sent_at DESC 
        LIMIT ?
      `
      this.db.all(sql, [userId, limit], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  // ===== MÉTODOS UTILITÁRIOS =====
  async expireOldInvites() {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE recruitment_invites 
        SET status = 'expired' 
        WHERE status = 'pending' 
        AND expires_at IS NOT NULL 
        AND expires_at <= datetime('now')
      `
      this.db.run(sql, [], function (err) {
        if (err) reject(err)
        else resolve(this.changes)
      })
    })
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error("❌ Erro ao fechar banco de dados:", err)
        } else {
          console.log("✅ Banco de dados fechado")
        }
      })
    }
  }
}

module.exports = new Database()
