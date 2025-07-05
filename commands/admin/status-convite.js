const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
  SECONDARY: "#5F27CD",
  GOLD: "#FFD700",
}

// Cache para evitar processamento duplicado
const processedInteractions = new Set()

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status-convite")
    .setDescription("🔍 Verifica o status de um convite específico")
    .addUserOption((option) =>
      option.setName("usuario").setDescription("👤 Usuário para verificar o status").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("message-id").setDescription("🆔 ID da mensagem do convite (opcional)").setRequired(false),
    ),

  async execute(interaction) {
    // Verificações de segurança mais rigorosas
    const interactionId = `${interaction.id}_${interaction.user.id}_${Date.now()}`
    const interactionAge = Date.now() - interaction.createdTimestamp

    console.log(`🔍 [STATUS-CONVITE] Iniciando comando:`)
    console.log(`   👤 Usuário: ${interaction.user.tag}`)
    console.log(`   🆔 ID: ${interaction.id}`)
    console.log(`   ⏰ Idade: ${interactionAge}ms`)
    console.log(`   ✅ Replied: ${interaction.replied}`)
    console.log(`   ⏳ Deferred: ${interaction.deferred}`)

    // Verificar se a interação é muito antiga (mais rigoroso)
    if (interactionAge > 2000) {
      console.warn(`⚠️ [STATUS-CONVITE] Interação muito antiga (${interactionAge}ms), ignorando`)
      return
    }

    // Verificar se já foi processada
    if (processedInteractions.has(interactionId)) {
      console.warn(`⚠️ [STATUS-CONVITE] Interação já processada, ignorando`)
      return
    }

    // Verificar estado da interação
    if (interaction.replied || interaction.deferred) {
      console.warn(`⚠️ [STATUS-CONVITE] Interação já foi respondida/deferida, ignorando`)
      return
    }

    // Marcar como processada
    processedInteractions.add(interactionId)

    // Limpar cache antigo
    if (processedInteractions.size > 100) {
      const entries = Array.from(processedInteractions)
      entries.slice(0, 50).forEach((id) => processedInteractions.delete(id))
    }

    const usuario = interaction.options.getUser("usuario")
    const messageId = interaction.options.getString("message-id")
    const database = global.ticketSystem.database

    try {
      console.log(`🔄 [STATUS-CONVITE] Tentando deferReply...`)

      // Usar Promise.race com timeout mais agressivo
      const deferPromise = interaction.deferReply({ ephemeral: true })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout no deferReply")), 1500),
      )

      await Promise.race([deferPromise, timeoutPromise])
      console.log(`✅ [STATUS-CONVITE] DeferReply bem-sucedido`)

      // Verificar novamente se ainda pode responder
      if (interaction.replied && !interaction.deferred) {
        console.warn(`⚠️ [STATUS-CONVITE] Estado inconsistente após deferReply`)
        return
      }

      let invite

      if (messageId) {
        console.log(`🔍 [STATUS-CONVITE] Buscando convite por message ID: ${messageId}`)
        invite = await database.getInviteStatus(usuario.id, messageId)
      } else {
        console.log(`🔍 [STATUS-CONVITE] Buscando convite mais recente para: ${usuario.tag}`)
        const recentInvites = await database.getRecentInvitesByUser(usuario.id, 1)
        invite = recentInvites[0]
      }

      if (!invite) {
        console.log(`❌ [STATUS-CONVITE] Convite não encontrado`)

        const notFoundEmbed = new EmbedBuilder()
          .setTitle("❌ Convite Não Encontrado")
          .setDescription(`Nenhum convite encontrado para **${usuario.tag}**`)
          .setColor(COLORS.ERROR)
          .addFields({
            name: "💡 Dica",
            value: "Verifique se o usuário recebeu algum convite ou se o ID da mensagem está correto",
            inline: false,
          })
          .setFooter({ text: "Hylex • Sistema de Verificação" })
          .setTimestamp()

        // Verificar se ainda pode responder
        if (interaction.deferred && !interaction.replied) {
          console.log(`📤 [STATUS-CONVITE] Enviando resposta de não encontrado...`)
          await interaction.followUp({ embeds: [notFoundEmbed] })
        }
        return
      }

      console.log(`✅ [STATUS-CONVITE] Convite encontrado: ${invite.status}`)

      // Mapear status para emojis e textos
      const statusMap = {
        pending: { emoji: "🟡", text: "Aguardando resposta", color: COLORS.WARNING },
        accepted: { emoji: "✅", text: "Aceito", color: COLORS.SUCCESS },
        declined: { emoji: "❌", text: "Recusado", color: COLORS.ERROR },
        expired: { emoji: "⏰", text: "Expirado", color: COLORS.SECONDARY },
      }

      const currentStatus = statusMap[invite.status] || {
        emoji: "❓",
        text: "Status desconhecido",
        color: COLORS.ERROR,
      }

      // Calcular tempo desde o envio
      const sentTime = new Date(invite.sent_at)
      const now = new Date()
      const timeDiff = Math.floor((now - sentTime) / (1000 * 60 * 60)) // horas

      const statusEmbed = new EmbedBuilder()
        .setTitle("🔍 Status do Convite")
        .setDescription(`Informações detalhadas do convite para **${usuario.tag}**`)
        .setColor(currentStatus.color)
        .addFields(
          {
            name: "👤 Candidato",
            value: `${invite.username}`,
            inline: true,
          },
          {
            name: "📊 Status Atual",
            value: `${currentStatus.emoji} ${currentStatus.text}`,
            inline: true,
          },
          {
            name: "🆔 ID da Mensagem",
            value: `\`${invite.message_id}\``,
            inline: true,
          },
          {
            name: "📅 Enviado em",
            value: `<t:${Math.floor(sentTime.getTime() / 1000)}:F>`,
            inline: true,
          },
          {
            name: "⏰ Tempo Decorrido",
            value: `${timeDiff} horas`,
            inline: true,
          },
          {
            name: "👨‍💼 Enviado por",
            value: `<@${invite.sent_by}>`,
            inline: true,
          },
        )
        .setFooter({ text: "Hylex • Sistema de Verificação" })
        .setTimestamp()
        .setThumbnail(usuario.displayAvatarURL({ dynamic: true }))

      // Adicionar informações extras baseadas no status
      if (invite.status === "accepted" && invite.invite_url) {
        statusEmbed.addFields({
          name: "🔗 Link do Convite",
          value: `[Clique aqui](${invite.invite_url})`,
          inline: true,
        })
      }

      if (invite.responded_at) {
        const respondedTime = new Date(invite.responded_at)
        statusEmbed.addFields({
          name: "📝 Respondido em",
          value: `<t:${Math.floor(respondedTime.getTime() / 1000)}:F>`,
          inline: true,
        })
      }

      if (invite.expires_at) {
        const expiresTime = new Date(invite.expires_at)
        const isExpired = now > expiresTime
        statusEmbed.addFields({
          name: "⏳ Expira em",
          value: `<t:${Math.floor(expiresTime.getTime() / 1000)}:R> ${isExpired ? "(Expirado)" : ""}`,
          inline: true,
        })
      }

      // Verificar se ainda pode responder
      if (interaction.deferred && !interaction.replied) {
        console.log(`📤 [STATUS-CONVITE] Enviando status do convite...`)
        await interaction.followUp({ embeds: [statusEmbed] })
      }

      console.log(`✅ [STATUS-CONVITE] Comando concluído com sucesso`)
    } catch (error) {
      console.error(`❌ [STATUS-CONVITE] Erro ao verificar status:`, error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro na Verificação")
        .setDescription("Ocorreu um erro ao verificar o status do convite.")
        .setColor(COLORS.ERROR)
        .addFields({
          name: "🔧 Detalhes",
          value: `\`${error.message}\``,
          inline: false,
        })
        .setTimestamp()

      // Tentar responder de forma mais defensiva
      try {
        if (!interaction.replied && !interaction.deferred) {
          console.log(`📤 [STATUS-CONVITE] Tentando reply direto com erro...`)
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
        } else if (interaction.deferred && !interaction.replied) {
          console.log(`📤 [STATUS-CONVITE] Tentando followUp com erro...`)
          await interaction.followUp({ embeds: [errorEmbed] })
        } else {
          console.warn(
            `⚠️ [STATUS-CONVITE] Não pode responder erro - estado: replied=${interaction.replied}, deferred=${interaction.deferred}`,
          )
        }
      } catch (replyError) {
        console.error(`❌ [STATUS-CONVITE] Erro ao responder com erro:`, replyError.message)
      }
    } finally {
      // Remover do cache após um tempo
      setTimeout(() => {
        processedInteractions.delete(interactionId)
      }, 30000) // 30 segundos
    }
  },
}
