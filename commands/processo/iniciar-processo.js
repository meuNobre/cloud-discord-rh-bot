const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("iniciar-processo")
    .setDescription("🚀 Inicia um novo processo seletivo")
    .addStringOption((option) => option.setName("nome").setDescription("Nome do processo seletivo").setRequired(true))
    .addStringOption((option) =>
      option.setName("descricao").setDescription("Descrição do processo").setRequired(false),
    ),

  async execute(interaction) {
    const nome = interaction.options.getString("nome")
    const descricao = interaction.options.getString("descricao") || "Processo seletivo padrão"
    const database = global.ticketSystem.database

    await interaction.deferReply({ ephemeral: true })

    try {
      // Verificar se já existe um processo ativo
      const activeProcess = await database.getActiveProcess()

      if (activeProcess) {
        const activeEmbed = new EmbedBuilder()
          .setTitle("⚠️ Processo Já Ativo")
          .setDescription("Já existe um processo seletivo ativo. Finalize-o antes de iniciar um novo.")
          .setColor(COLORS.WARNING)
          .addFields(
            {
              name: "📋 Processo Atual",
              value: `**${activeProcess.name}**`,
              inline: true,
            },
            {
              name: "📅 Iniciado em",
              value: `<t:${Math.floor(new Date(activeProcess.started_at).getTime() / 1000)}:F>`,
              inline: true,
            },
            {
              name: "👤 Iniciado por",
              value: `<@${activeProcess.started_by}>`,
              inline: true,
            },
            {
              name: "💡 Solução",
              value: "Use `/finalizar-processo` para encerrar o processo atual",
              inline: false,
            },
          )
          .setFooter({ text: "Hylex • Sistema de Processos" })
          .setTimestamp()

        await interaction.followUp({ embeds: [activeEmbed] })
        return
      }

      // Criar novo processo
      const processId = await database.createProcess(nome, descricao, interaction.user.id)

      const successEmbed = new EmbedBuilder()
        .setTitle("🚀 Processo Seletivo Iniciado!")
        .setDescription(`O processo **${nome}** foi iniciado com sucesso!`)
        .setColor(COLORS.SUCCESS)
        .addFields(
          {
            name: "🆔 ID do Processo",
            value: `\`${processId}\``,
            inline: true,
          },
          {
            name: "📋 Nome",
            value: `**${nome}**`,
            inline: true,
          },
          {
            name: "👤 Iniciado por",
            value: `${interaction.user.tag}`,
            inline: true,
          },
          {
            name: "📝 Descrição",
            value: `${descricao}`,
            inline: false,
          },
          {
            name: "📅 Data de Início",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          },
          {
            name: "📊 Status",
            value: "🟢 Ativo",
            inline: true,
          },
          {
            name: "🎯 Próximos Passos",
            value:
              "• Use `/convidar-processo` para enviar convites\n• Use `/entrevista` para agendar entrevistas\n• Use `/resumo-processo` para ver estatísticas",
            inline: false,
          },
        )
        .setFooter({ text: "Hylex • Sistema de Processos" })
        .setTimestamp()
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))

      await interaction.followUp({ embeds: [successEmbed] })

      console.log(`🚀 Processo seletivo iniciado: ID ${processId} - ${nome} por ${interaction.user.tag}`)
    } catch (error) {
      console.error("Erro ao iniciar processo:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro ao Iniciar Processo")
        .setDescription("Ocorreu um erro ao iniciar o processo seletivo.")
        .setColor(COLORS.ERROR)
        .addFields({
          name: "🔧 Detalhes",
          value: `\`\`\`${error.message}\`\`\``,
          inline: false,
        })
        .setTimestamp()

      await interaction.followUp({ embeds: [errorEmbed] })
    }
  },
}
