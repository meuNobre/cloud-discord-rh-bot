-- Tabela para armazenar convites enviados
CREATE TABLE IF NOT EXISTS recruitment_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    message_id TEXT NOT NULL,
    sent_by TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending', -- pending, accepted, declined, expired
    responded_at DATETIME NULL,
    invite_url TEXT NULL,
    expires_at DATETIME NULL
);

-- Tabela para histórico de tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    discord_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME NULL,
    closed_by TEXT NULL,
    status TEXT DEFAULT 'open' -- open, closed
);

-- Tabela para mensagens dos tickets (histórico completo)
CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    message_type TEXT NOT NULL, -- user_message, staff_response
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets (id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_recruitment_user_id ON recruitment_invites(user_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_status ON recruitment_invites(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_sent_at ON recruitment_invites(sent_at);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
