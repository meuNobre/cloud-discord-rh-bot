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
    .setName("status-convite")
    .setDescription("🔍 Verifica o status de um convite específico")
    .addUserOption((option) =>
      option.setName("usuario").setDescription("👤 Usuário para verificar o status").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("message-id").setDescription("🆔 ID da mensagem do convite (opcional)").setRequired(false),
    ),

  async execute(interaction) {
    const usuario = interaction.options.getUser("usuario")
    const messageId = interaction.options.getString("message-id")
    const database = global.ticketSystem.database

    await interaction.deferReply({ ephemeral: true })

    try {
      let invite

      if (messageId) {
        // Busca convite específico por message ID
        invite = await database.getInviteStatus(usuario.id, messageId)
      } else {
        // Busca o convite mais recente do usuário
        const recentInvites = await database.getRecentInvitesByUser(usuario.id, 1)
        invite = recentInvites[0]
      }

      if (!invite) {
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

        await interaction.followUp({ embeds: [notFoundEmbed] })
        return
      }

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

      await interaction.followUp({ embeds: [statusEmbed] })
    } catch (error) {
      console.error("Erro ao verificar status:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro na Verificação")
        .setDescription("Ocorreu um erro ao verificar o status do convite.")
        .setColor(COLORS.ERROR)
        .setTimestamp()

      await interaction.followUp({ embeds: [errorEmbed] })
    }
  },
}
