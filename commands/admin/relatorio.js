const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
  SECONDARY: "#5F27CD",
  GOLD: "#FFD700",
}

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
    // Verificar se a interação ainda é válida
    if (interaction.replied || interaction.deferred) {
      console.log("❌ Interação já foi processada - relatorio")
      return
    }

    const tipo = interaction.options.getString("tipo")
    const dias = interaction.options.getInteger("dias") || 30
    const database = global.ticketSystem.database

    try {
      // Adicionar timeout para deferReply
      await Promise.race([
        interaction.deferReply({ ephemeral: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout no deferReply")), 3000)),
      ])

      if (tipo === "recruitment" || tipo === "complete") {
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
        if (!interaction.replied && interaction.deferred) {
          await interaction.followUp({ embeds: [recruitmentEmbed] })
        }
      }

      if (tipo === "support" || tipo === "complete") {
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
        if (!interaction.replied && interaction.deferred) {
          await interaction.followUp({ embeds: [supportEmbed] })
        }
      }
    } catch (error) {
      console.error("Erro ao gerar relatório:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro no Relatório")
        .setDescription("Ocorreu um erro ao gerar o relatório.")
        .setColor(COLORS.ERROR)
        .setTimestamp()

      // Tentar responder apenas se ainda não foi respondido
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
        } catch (replyError) {
          console.error("❌ Erro ao responder interação:", replyError.message)
        }
      } else if (interaction.deferred && !interaction.replied) {
        try {
          await interaction.followUp({ embeds: [errorEmbed] })
        } catch (followUpError) {
          console.error("❌ Erro ao fazer followUp:", followUpError.message)
        }
      }
    }
  },
}
