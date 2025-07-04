const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js")

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const COLORS = {
      PRIMARY: "#00D9FF",
      SUCCESS: "#00FF88",
      SECONDARY: "#5F27CD",
    }

    // Embed de boas-vindas profissional
    const welcomeEmbed = new EmbedBuilder()
      .setTitle("🌟 Bem-vindo ao Servidor!")
      .setDescription(
        `Olá, **${member.user.displayName}**! 👋\n\nÉ um prazer recebê-lo em nossa comunidade. Estamos aqui para ajudá-lo em sua jornada!`,
      )
      .addFields(
        {
          name: "🎯 Primeiros Passos",
          value: "• Explore os canais disponíveis\n• Leia as regras do servidor\n• Apresente-se para a comunidade",
          inline: false,
        },
        {
          name: "🆘 Precisa de Ajuda?",
          value:
            "Nossa equipe de suporte está sempre disponível para ajudá-lo. Clique no botão abaixo para abrir um ticket:",
          inline: false,
        },
        {
          name: "💡 Dica Importante",
          value: "Mantenha suas mensagens diretas (DMs) abertas para receber atualizações importantes!",
          inline: false,
        },
      )
      .setColor(COLORS.PRIMARY)
      .setFooter({
        text: "iCloud Bot • Sistema de Boas-vindas",
        iconURL: member.client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp()
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setImage("https://via.placeholder.com/400x150/00D9FF/FFFFFF?text=Bem-vindo!")

    // Botões de ação
    const supportButton = new ButtonBuilder()
      .setCustomId("suporte")
      .setLabel("🎧 Abrir Suporte")
      .setStyle(ButtonStyle.Primary)

    const infoButton = new ButtonBuilder()
      .setCustomId("server_info")
      .setLabel("ℹ️ Informações do Servidor")
      .setStyle(ButtonStyle.Secondary)

    const row = new ActionRowBuilder().addComponents(supportButton, infoButton)

    try {
      await member.send({
        embeds: [welcomeEmbed],
        components: [row],
      })

      console.log(`✅ Mensagem de boas-vindas enviada para ${member.user.tag}`)
    } catch (error) {
      console.error(`❌ Erro ao enviar boas-vindas para ${member.user.tag}:`, error.message)

      // Se não conseguir enviar DM, tenta enviar no canal geral (opcional)
      try {
        const guild = member.guild
        const systemChannel = guild.systemChannel

        if (systemChannel) {
          const publicWelcomeEmbed = new EmbedBuilder()
            .setTitle("👋 Novo Membro!")
            .setDescription(`Bem-vindo ao servidor, ${member}! 🎉`)
            .setColor(COLORS.SUCCESS)
            .setFooter({ text: "iCloud Bot • Sistema de Boas-vindas" })
            .setTimestamp()

          await systemChannel.send({ embeds: [publicWelcomeEmbed] })
          console.log(`✅ Mensagem pública de boas-vindas enviada para ${member.user.tag}`)
        }
      } catch (publicError) {
        console.error(`❌ Erro ao enviar boas-vindas públicas:`, publicError.message)
      }
    }
  },
}
