-- Adicionar coluna created_at na tabela support_tickets se não existir
-- ALTER TABLE support_tickets ADD COLUMN created_at TEXT DEFAULT (datetime('now'));

-- Criar tabela para mensagens dos tickets
CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL, -- 'user_message', 'staff_response', 'bot_message'
    created_at TEXT DEFAULT (datetime('now')),
    attachments TEXT, -- JSON com dados dos anexos
    embed_data TEXT, -- JSON com dados dos embeds
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
);

-- Criar tabela para resumos dos tickets
CREATE TABLE IF NOT EXISTS ticket_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    closed_at TEXT NOT NULL,
    total_messages INTEGER DEFAULT 0,
    staff_responses INTEGER DEFAULT 0,
    user_messages INTEGER DEFAULT 0,
    resolution_time_minutes INTEGER DEFAULT 0,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_summaries_ticket_id ON ticket_summaries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_summaries_closed_at ON ticket_summaries(closed_at);
