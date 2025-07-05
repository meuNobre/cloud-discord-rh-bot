const { EmbedBuilder } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
}

class InviteValidator {
  static async validateBeforeSending(database, userId, username) {
    const validation = {
      canSend: false,
      reason: null,
      existingInvite: null,
    }

    try {
      // Verificar convites pendentes
      const existingInvite = await database.getPendingInviteByUser(userId)

      if (existingInvite) {
        validation.canSend = false
        validation.reason = "PENDING_INVITE"
        validation.existingInvite = existingInvite
        return validation
      }

      // Verificar se há processo ativo
      const activeProcess = await database.getActiveProcess()
      if (!activeProcess) {
        validation.canSend = false
        validation.reason = "NO_ACTIVE_PROCESS"
        return validation
      }

      // Verificar se já é participante
      const participants = await database.getProcessParticipants(activeProcess.id)
      const existingParticipant = participants.find((p) => p.user_id === userId)

      if (existingParticipant) {
        validation.canSend = false
        validation.reason = "ALREADY_PARTICIPANT"
        validation.existingParticipant = existingParticipant
        return validation
      }

      validation.canSend = true
      return validation
    } catch (error) {
      console.error("❌ Erro na validação de convite:", error)
      validation.canSend = false
      validation.reason = "VALIDATION_ERROR"
      validation.error = error
      return validation
    }
  }

  static createValidationErrorEmbed(validation, candidato) {
    switch (validation.reason) {
      case "PENDING_INVITE":
        return new EmbedBuilder()
          .setTitle("⚠️ Convite Já Existe")
          .setDescription(`${candidato.tag} já possui um convite pendente.`)
          .setColor(COLORS.WARNING)
          .addFields(
            {
              name: "📅 Enviado em",
              value: `<t:${Math.floor(new Date(validation.existingInvite.sent_at).getTime() / 1000)}:F>`,
              inline: true,
            },
            {
              name: "⏰ Status",
              value: validation.existingInvite.status || "pending",
              inline: true,
            },
          )
          .setFooter({ text: "Hylex • Sistema de Recrutamento" })
          .setTimestamp()

      case "NO_ACTIVE_PROCESS":
        return new EmbedBuilder()
          .setTitle("❌ Nenhum Processo Ativo")
          .setDescription("Não há processo seletivo ativo para enviar convites.")
          .setColor(COLORS.ERROR)
          .addFields({
            name: "💡 Dica",
            value: "Use `/iniciar-processo` para começar um novo processo seletivo",
            inline: false,
          })
          .setFooter({ text: "Hylex • Sistema de Processos" })
          .setTimestamp()

      case "ALREADY_PARTICIPANT":
        return new EmbedBuilder()
          .setTitle("⚠️ Já é Participante")
          .setDescription(`${candidato.tag} já está participando do processo ativo.`)
          .setColor(COLORS.WARNING)
          .addFields(
            {
              name: "📊 Status Atual",
              value: validation.existingParticipant.status,
              inline: true,
            },
            {
              name: "📅 Desde",
              value: `<t:${Math.floor(new Date(validation.existingParticipant.joined_at).getTime() / 1000)}:F>`,
              inline: true,
            },
          )
          .setFooter({ text: "Hylex • Sistema de Recrutamento" })
          .setTimestamp()

      case "VALIDATION_ERROR":
        return new EmbedBuilder()
          .setTitle("❌ Erro de Validação")
          .setDescription("Ocorreu um erro ao validar o convite.")
          .setColor(COLORS.ERROR)
          .addFields({
            name: "🔧 Detalhes",
            value: `\`\`\`${validation.error?.message || "Erro desconhecido"}\`\`\``,
            inline: false,
          })
          .setTimestamp()

      default:
        return new EmbedBuilder()
          .setTitle("❌ Erro Desconhecido")
          .setDescription("Erro desconhecido na validação.")
          .setColor(COLORS.ERROR)
          .setTimestamp()
    }
  }

  static async trackInviteStatus(database, userId, messageId, status, additionalData = {}) {
    try {
      console.log(`📊 [INVITE_TRACKER] Status: ${userId} -> ${status}`)

      // Atualizar status no banco
      await database.updateInviteStatus(userId, messageId, status, additionalData.inviteUrl)

      // Log detalhado
      console.log(`✅ [INVITE_TRACKER] Status atualizado: ${userId} -> ${status}`)

      return true
    } catch (error) {
      console.error(`❌ [INVITE_TRACKER] Erro ao atualizar status:`, error)
      return false
    }
  }
}

module.exports = InviteValidator
