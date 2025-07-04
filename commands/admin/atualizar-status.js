const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
  SECONDARY: "#5F27CD",
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("atualizar-status")
    .setDescription("🔄 Atualiza manualmente o status de um convite")
    .addUserOption((option) => option.setName("usuario").setDescription("👤 Usuário do convite").setRequired(true))
    .addStringOption((option) =>
      option.setName("message-id").setDescription("🆔 ID da mensagem do convite").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("📊 Novo status")
        .setRequired(true)
        .addChoices(
          { name: "🟡 Pendente", value: "pending" },
          { name: "✅ Aceito", value: "accepted" },
          { name: "❌ Recusado", value: "declined" },
          { name: "⏰ Expirado", value: "expired" },
        ),
    ),

  async execute(interaction) {
    const usuario = interaction.options.getUser("usuario")
    const messageId = interaction.options.getString("message-id")
    const newStatus = interaction.options.getString("status")
    const database = global.ticketSystem.database

    await interaction.deferReply({ ephemeral: true })

    try {
      // Verifica se o convite existe
      const existingInvite = await database.getInviteStatus(usuario.id, messageId)

      if (!existingInvite) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle("❌ Convite Não Encontrado")
          .setDescription(`Nenhum convite encontrado para **${usuario.tag}** com ID \`${messageId}\``)
          .setColor(COLORS.ERROR)
          .setTimestamp()

        await interaction.followUp({ embeds: [notFoundEmbed] })
        return
      }

      // Atualiza o status
      const updated = await database.updateInviteStatus(usuario.id, messageId, newStatus)

      if (updated > 0) {
        const statusMap = {
          pending: "🟡 Pendente",
          accepted: "✅ Aceito",
          declined: "❌ Recusado",
          expired: "⏰ Expirado",
        }

        const successEmbed = new EmbedBuilder()
          .setTitle("✅ Status Atualizado")
          .setDescription(`Status do convite atualizado com sucesso!`)
          .setColor(COLORS.SUCCESS)
          .addFields(
            {
              name: "👤 Usuário",
              value: `${usuario.tag}`,
              inline: true,
            },
            {
              name: "📊 Status Anterior",
              value: statusMap[existingInvite.status] || existingInvite.status,
              inline: true,
            },
            {
              name: "📊 Novo Status",
              value: statusMap[newStatus],
              inline: true,
            },
            {
              name: "🆔 ID da Mensagem",
              value: `\`${messageId}\``,
              inline: true,
            },
            {
              name: "👨‍💼 Atualizado por",
              value: `${interaction.user.tag}`,
              inline: true,
            },
            {
              name: "⏰ Atualizado em",
              value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
              inline: true,
            },
          )
          .setFooter({ text: "Hylex • Sistema de Atualização" })
          .setTimestamp()
          .setThumbnail(usuario.displayAvatarURL({ dynamic: true }))

        await interaction.followUp({ embeds: [successEmbed] })
      } else {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Erro na Atualização")
          .setDescription("Não foi possível atualizar o status do convite.")
          .setColor(COLORS.ERROR)
          .setTimestamp()

        await interaction.followUp({ embeds: [errorEmbed] })
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro no Sistema")
        .setDescription("Ocorreu um erro ao atualizar o status.")
        .setColor(COLORS.ERROR)
        .setTimestamp()

      await interaction.followUp({ embeds: [errorEmbed] })
    }
  },
}
