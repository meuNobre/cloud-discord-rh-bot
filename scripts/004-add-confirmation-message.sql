-- Versão segura que não falha se a coluna já existir
-- Primeiro, vamos tentar criar uma view para testar se as colunas existem

-- Se este SELECT funcionar, as colunas já existem
-- SELECT confirmation_message_id, confirmation_channel_id FROM recruitment_invites LIMIT 1;

-- Se der erro, significa que as colunas não existem, então podemos adicioná-las
-- Como SQLite não tem ADD COLUMN IF NOT EXISTS, vamos usar uma abordagem diferente

-- Criar índice (este comando é seguro pois usa IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_recruitment_confirmation ON recruitment_invites(confirmation_message_id);
