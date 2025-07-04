const { EmbedBuilder } = require("discord.js")

// Cores do tema
const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
  SECONDARY: "#5F27CD",
}

// Função auxiliar para verificar se a interação ainda é válida
function isInteractionValid(interaction) {
  const interactionAge = Date.now() - interaction.createdTimestamp
  const maxAge = 2500 // 2.5 segundos para dar margem

  if (interactionAge > maxAge) {
    console.warn(`⚠️ Interação expirada (${interactionAge}ms): ${interaction.customId || "unknown"}`)
    return false
  }

  return true
}

// Função auxiliar para responder interações de forma segura
async function safeInteractionReply(interaction, content) {
  try {
    // Verificar se a interação ainda é válida
    if (!isInteractionValid(interaction)) {
      return null
    }

    // Verificar se já foi respondida
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(content)
    } else {
      return await interaction.reply(content)
    }
  } catch (error) {
    console.error("❌ Erro ao responder interação:", error.message)

    // Se for erro de interação desconhecida, não tente novamente
    if (error.code === 10062) {
      console.warn("⚠️ Interação desconhecida - provavelmente expirou")
      return null
    }

    // Para outros erros, tente followUp se possível
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.followUp(content)
      }
    } catch (followUpError) {
      console.error("❌ Erro no followUp:", followUpError.message)
    }

    return null
  }
}

// Função auxiliar para atualizar interações de forma segura
async function safeInteractionUpdate(interaction, content) {
  try {
    // Verificar se a interação ainda é válida
    if (!isInteractionValid(interaction)) {
      return null
    }

    if (!interaction.replied && !interaction.deferred) {
      return await interaction.update(content)
    } else {
      return await interaction.editReply(content)
    }
  } catch (error) {
    console.error("❌ Erro ao atualizar interação:", error.message)

    if (error.code === 10062) {
      console.warn("⚠️ Interação desconhecida - provavelmente expirou")
      return null
    }

    return null
  }
}

// Função auxiliar para mostrar modal de forma segura
async function safeShowModal(interaction, modal) {
  try {
    console.log(`🔍 [DEBUG] safeShowModal chamado:`)
    console.log(`   👤 Usuário: ${interaction.user.tag}`)
    console.log(`   ⏰ Idade da interação: ${Date.now() - interaction.createdTimestamp}ms`)
    console.log(`   ✅ Replied: ${interaction.replied}`)
    console.log(`   ⏳ Deferred: ${interaction.deferred}`)

    // Verificar se a interação ainda é válida
    if (!isInteractionValid(interaction)) {
      console.warn("⚠️ Interação inválida para modal")
      return null
    }

    if (!interaction.replied && !interaction.deferred) {
      console.log("📝 [DEBUG] Mostrando modal...")
      const result = await interaction.showModal(modal)
      console.log("✅ [DEBUG] Modal mostrado com sucesso")
      return result
    } else {
      console.warn("⚠️ Tentativa de mostrar modal em interação já respondida")
      return null
    }
  } catch (error) {
    console.error("❌ Erro ao mostrar modal:", error.message)
    console.error("❌ Stack trace:", error.stack)

    if (error.code === 10062) {
      console.warn("⚠️ Interação desconhecida - provavelmente expirou")
      return null
    }

    return null
  }
}

// Função para verificar se um thread está acessível
async function isThreadAccessible(thread) {
  try {
    if (!thread) return false

    // Verificar se o thread ainda existe
    await thread.fetch()

    // Verificar se não está arquivado
    if (thread.archived) {
      console.warn(`⚠️ Thread ${thread.id} está arquivado`)
      return false
    }

    return true
  } catch (error) {
    console.error(`❌ Erro ao verificar thread:`, error.message)
    return false
  }
}

// Função para limpar tickets inativos
async function cleanupInactiveTickets(activeTickets, threadUsers, guild) {
  const ticketsToRemove = []

  for (const [userId, threadId] of activeTickets.entries()) {
    try {
      const thread = await guild.channels.fetch(threadId)

      if (!thread || thread.archived) {
        ticketsToRemove.push({ userId, threadId })
      }
    } catch (error) {
      // Thread não existe mais
      ticketsToRemove.push({ userId, threadId })
    }
  }

  // Remover tickets inativos
  for (const { userId, threadId } of ticketsToRemove) {
    activeTickets.delete(userId)
    threadUsers.delete(threadId)
    console.log(`🧹 Ticket inativo removido: User ${userId} -> Thread ${threadId}`)
  }

  if (ticketsToRemove.length > 0) {
    console.log(`🧹 Limpeza concluída: ${ticketsToRemove.length} tickets inativos removidos`)
  }
}

// Função para criar embed de erro padrão
function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.ERROR)
    .setFooter({ text: "iCloud Bot • Sistema de Erros" })
    .setTimestamp()
}

// Função para criar embed de aviso padrão
function createWarningEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.WARNING)
    .setFooter({ text: "iCloud Bot • Sistema de Avisos" })
    .setTimestamp()
}

module.exports = {
  safeInteractionReply,
  safeInteractionUpdate,
  safeShowModal,
  isInteractionValid,
  isThreadAccessible,
  cleanupInactiveTickets,
  createErrorEmbed,
  createWarningEmbed,
  COLORS,
}
