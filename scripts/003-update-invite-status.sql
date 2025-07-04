-- Atualizar possíveis valores de status para incluir 'entered'
-- Este script é executado automaticamente pelo sistema de migração

-- Não há alteração estrutural necessária, apenas documentação dos novos status:
-- pending: Convite enviado, aguardando resposta
-- accepted: Usuário aceitou o convite
-- entered: Usuário confirmou que entrou no servidor
-- declined: Usuário recusou o convite
-- expired: Convite expirou

-- Criar índice para melhor performance nas consultas de status
CREATE INDEX IF NOT EXISTS idx_recruitment_status_user ON recruitment_invites(status, user_id);
