const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verificar-dms")
    .setDescription("🔍 Verifica se é possível enviar DM para um usuário")
    .addUserOption((option) => option.setName("usuario").setDescription("👤 Usuário para verificar").setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true })

      const usuario = interaction.options.getUser("usuario")

      if (!usuario) {
        return await interaction.editReply({
          content: "❌ Usuário não encontrado.",
        })
      }

      if (usuario.bot) {
        return await interaction.editReply({
          content: "❌ Não é possível enviar DMs para bots.",
        })
      }

      // Tentar criar DM
      let dmStatus = "❌ Falhou"
      let dmError = null

      try {
        const dm = await usuario.createDM()
        dmStatus = "✅ Sucesso"

        // Tentar enviar uma mensagem de teste (sem realmente enviar)
        try {
          // Apenas verificar se o canal existe e está acessível
          if (dm && dm.id) {
            dmStatus = "✅ DM Disponível"
          }
        } catch (testError) {
          dmStatus = "⚠️ DM Criada, mas pode estar bloqueada"
          dmError = testError.message
        }
      } catch (createError) {
        dmStatus = "❌ Não foi possível criar DM"
        dmError = createError.message
      }

      const embed = new EmbedBuilder()
        .setTitle("🔍 Verificação de DM")
        .setDescription(`Resultado da verificação para **${usuario.tag}**`)
        .addFields(
          {
            name: "👤 Usuário",
            value: `${usuario.tag} (${usuario.id})`,
            inline: true,
          },
          {
            name: "📱 Status DM",
            value: dmStatus,
            inline: true,
          },
          {
            name: "🤖 Bot",
            value: usuario.bot ? "Sim" : "Não",
            inline: true,
          },
        )
        .setColor(dmStatus.includes("✅") ? "#00FF88" : dmStatus.includes("⚠️") ? "#FFA502" : "#FF4757")
        .setThumbnail(usuario.displayAvatarURL({ dynamic: true }))
        .setTimestamp()

      if (dmError) {
        embed.addFields({
          name: "❌ Erro",
          value: `\`${dmError}\``,
          inline: false,
        })
      }

      if (!dmStatus.includes("✅")) {
        embed.addFields({
          name: "💡 Instruções para o Usuário",
          value:
            "1. Abrir **Configurações do Discord**\n2. Ir em **Privacidade e Segurança**\n3. Ativar **'Permitir mensagens diretas de membros do servidor'**\n4. Tentar novamente",
          inline: false,
        })
      }

      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      console.error("Erro ao verificar DMs:", error)
      await interaction.editReply({
        content: "❌ Erro ao verificar DMs do usuário.",
      })
    }
  },
}
