-- Tabela para processos seletivos
CREATE TABLE IF NOT EXISTS selection_processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    started_by TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    ended_by TEXT NULL,
    status TEXT DEFAULT 'active', -- active, completed, cancelled
    total_candidates INTEGER DEFAULT 0,
    approved_candidates INTEGER DEFAULT 0,
    rejected_candidates INTEGER DEFAULT 0,
    settings TEXT -- JSON com configurações do processo
);

-- Tabela para participantes do processo
CREATE TABLE IF NOT EXISTS process_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending', -- pending, interviewing, approved, rejected, withdrawn
    phase TEXT DEFAULT 'application', -- application, interview, evaluation, final
    score INTEGER DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (process_id) REFERENCES selection_processes (id)
);

-- Tabela para entrevistas
CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    interviewer_id TEXT NOT NULL,
    interviewer_name TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME NULL,
    duration_minutes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    result TEXT DEFAULT 'pending', -- pending, approved, rejected
    score INTEGER DEFAULT 0,
    comments TEXT,
    feedback TEXT,
    evaluation_channel_id TEXT,
    evaluation_message_id TEXT,
    FOREIGN KEY (process_id) REFERENCES selection_processes (id),
    FOREIGN KEY (participant_id) REFERENCES process_participants (id)
);

-- Tabela para fases do processo
CREATE TABLE IF NOT EXISTS process_phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (process_id) REFERENCES selection_processes (id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_process_participants_process_id ON process_participants(process_id);
CREATE INDEX IF NOT EXISTS idx_process_participants_user_id ON process_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_process_id ON interviews(process_id);
CREATE INDEX IF NOT EXISTS idx_interviews_participant_id ON interviews(participant_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interviewer_id ON interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_process_phases_process_id ON process_phases(process_id);
