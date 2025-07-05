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
    .setName("relatorio")
    .setDescription("📊 Gera relatórios do sistema de recrutamento e suporte")
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Tipo de relatório")
        .setRequired(true)
        .addChoices(
          { name: "📈 Recrutamento", value: "recruitment" },
          { name: "🎧 Suporte", value: "support" },
          { name: "📋 Completo", value: "complete" },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("dias")
        .setDescription("Período em dias (padrão: 30)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(365),
    ),

  async execute(interaction) {
    // Verificações de segurança mais rigorosas
    const interactionId = `${interaction.id}_${interaction.user.id}_${Date.now()}`
    const interactionAge = Date.now() - interaction.createdTimestamp

    console.log(`🔍 [RELATORIO] Iniciando comando:`)
    console.log(`   👤 Usuário: ${interaction.user.tag}`)
    console.log(`   🆔 ID: ${interaction.id}`)
    console.log(`   ⏰ Idade: ${interactionAge}ms`)
    console.log(`   ✅ Replied: ${interaction.replied}`)
    console.log(`   ⏳ Deferred: ${interaction.deferred}`)

    // Verificar se a interação é muito antiga (mais rigoroso)
    if (interactionAge > 2000) {
      console.warn(`⚠️ [RELATORIO] Interação muito antiga (${interactionAge}ms), ignorando`)
      return
    }

    // Verificar se já foi processada
    if (processedInteractions.has(interactionId)) {
      console.warn(`⚠️ [RELATORIO] Interação já processada, ignorando`)
      return
    }

    // Verificar estado da interação
    if (interaction.replied || interaction.deferred) {
      console.warn(`⚠️ [RELATORIO] Interação já foi respondida/deferida, ignorando`)
      return
    }

    // Marcar como processada
    processedInteractions.add(interactionId)

    // Limpar cache antigo (manter apenas últimas 100 interações)
    if (processedInteractions.size > 100) {
      const entries = Array.from(processedInteractions)
      entries.slice(0, 50).forEach((id) => processedInteractions.delete(id))
    }

    const tipo = interaction.options.getString("tipo")
    const dias = interaction.options.getInteger("dias") || 30
    const database = global.ticketSystem.database

    try {
      console.log(`🔄 [RELATORIO] Tentando deferReply...`)

      // Usar Promise.race com timeout mais agressivo
      const deferPromise = interaction.deferReply({ ephemeral: true })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout no deferReply")), 1500),
      )

      await Promise.race([deferPromise, timeoutPromise])
      console.log(`✅ [RELATORIO] DeferReply bem-sucedido`)

      // Verificar novamente se ainda pode responder
      if (interaction.replied && !interaction.deferred) {
        console.warn(`⚠️ [RELATORIO] Estado inconsistente após deferReply`)
        return
      }

      if (tipo === "recruitment" || tipo === "complete") {
        console.log(`📊 [RELATORIO] Gerando relatório de recrutamento...`)

        const recruitmentStats = await database.getRecruitmentStats(dias)
        const recentInvites = await database.getRecentInvites(5)

        const recruitmentEmbed = new EmbedBuilder()
          .setTitle("📈 Relatório de Recrutamento")
          .setDescription(`Estatísticas dos últimos **${dias} dias**`)
          .setColor(COLORS.PRIMARY)
          .addFields({
            name: "📊 Estatísticas Gerais",
            value: `**Total de Convites:** ${recruitmentStats.total_invites}\n**Aceitos:** ${recruitmentStats.accepted} (${recruitmentStats.total_invites > 0 ? Math.round((recruitmentStats.accepted / recruitmentStats.total_invites) * 100) : 0}%)\n**Recusados:** ${recruitmentStats.declined} (${recruitmentStats.total_invites > 0 ? Math.round((recruitmentStats.declined / recruitmentStats.total_invites) * 100) : 0}%)\n**Pendentes:** ${recruitmentStats.pending}\n**Expirados:** ${recruitmentStats.expired}`,
            inline: false,
          })
          .setFooter({ text: "Hylex • Sistema de Relatórios" })
          .setTimestamp()

        if (recentInvites.length > 0) {
          const recentList = recentInvites
            .map((invite) => {
              const status = {
                pending: "🟡 Pendente",
                accepted: "✅ Aceito",
                declined: "❌ Recusado",
                expired: "⏰ Expirado",
              }
              return `**${invite.username}** - ${status[invite.status]} (<t:${Math.floor(new Date(invite.sent_at).getTime() / 1000)}:R>)`
            })
            .join("\n")

          recruitmentEmbed.addFields({
            name: "📋 Convites Recentes",
            value: recentList,
            inline: false,
          })
        }

        // Verificar se ainda pode responder antes de enviar
        if (interaction.deferred && !interaction.replied) {
          console.log(`📤 [RELATORIO] Enviando relatório de recrutamento...`)
          await interaction.followUp({ embeds: [recruitmentEmbed] })
        } else {
          console.warn(`⚠️ [RELATORIO] Não pode enviar relatório de recrutamento - estado inválido`)
        }
      }

      if (tipo === "support" || tipo === "complete") {
        console.log(`📊 [RELATORIO] Gerando relatório de suporte...`)

        const supportStats = await database.getTicketStats(dias)

        const supportEmbed = new EmbedBuilder()
          .setTitle("🎧 Relatório de Suporte")
          .setDescription(`Estatísticas dos últimos **${dias} dias**`)
          .setColor(COLORS.SECONDARY)
          .addFields(
            {
              name: "📊 Estatísticas de Tickets",
              value: `**Total de Tickets:** ${supportStats.total_tickets}\n**Tickets Abertos:** ${supportStats.open_tickets}\n**Tickets Fechados:** ${supportStats.closed_tickets}\n**Tempo Médio de Resolução:** ${supportStats.avg_resolution_hours ? Math.round(supportStats.avg_resolution_hours * 100) / 100 : 0} horas`,
              inline: false,
            },
            {
              name: "📈 Taxa de Resolução",
              value: `${supportStats.total_tickets > 0 ? Math.round((supportStats.closed_tickets / supportStats.total_tickets) * 100) : 0}%`,
              inline: true,
            },
            {
              name: "⚡ Tickets Ativos",
              value: `${global.ticketSystem.activeTickets.size}`,
              inline: true,
            },
          )
          .setFooter({ text: "Hylex • Sistema de Relatórios" })
          .setTimestamp()

        // Verificar se ainda pode responder antes de enviar
        if (interaction.deferred && !interaction.replied) {
          console.log(`📤 [RELATORIO] Enviando relatório de suporte...`)
          await interaction.followUp({ embeds: [supportEmbed] })
        } else {
          console.warn(`⚠️ [RELATORIO] Não pode enviar relatório de suporte - estado inválido`)
        }
      }

      console.log(`✅ [RELATORIO] Comando concluído com sucesso`)
    } catch (error) {
      console.error(`❌ [RELATORIO] Erro ao gerar relatório:`, error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro no Relatório")
        .setDescription("Ocorreu um erro ao gerar o relatório.")
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
          console.log(`📤 [RELATORIO] Tentando reply direto com erro...`)
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
        } else if (interaction.deferred && !interaction.replied) {
          console.log(`📤 [RELATORIO] Tentando followUp com erro...`)
          await interaction.followUp({ embeds: [errorEmbed] })
        } else {
          console.warn(
            `⚠️ [RELATORIO] Não pode responder erro - estado: replied=${interaction.replied}, deferred=${interaction.deferred}`,
          )
        }
      } catch (replyError) {
        console.error(`❌ [RELATORIO] Erro ao responder com erro:`, replyError.message)
      }
    } finally {
      // Remover do cache após um tempo
      setTimeout(() => {
        processedInteractions.delete(interactionId)
      }, 30000) // 30 segundos
    }
  },
}
