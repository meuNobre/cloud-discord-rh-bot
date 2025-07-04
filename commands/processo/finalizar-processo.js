const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
}

module.exports = {
  data: new SlashCommandBuilder().setName("finalizar-processo").setDescription("🏁 Finaliza o processo seletivo ativo"),

  async execute(interaction) {
    const database = global.ticketSystem.database

    await interaction.deferReply({ ephemeral: true })

    try {
      // Verificar se existe um processo ativo
      const activeProcess = await database.getActiveProcess()

      if (!activeProcess) {
        const noProcessEmbed = new EmbedBuilder()
          .setTitle("❌ Nenhum Processo Ativo")
          .setDescription("Não há nenhum processo seletivo ativo para finalizar.")
          .setColor(COLORS.ERROR)
          .addFields({
            name: "💡 Dica",
            value: "Use `/iniciar-processo` para começar um novo processo seletivo",
            inline: false,
          })
          .setFooter({ text: "Hylex • Sistema de Processos" })
          .setTimestamp()

        await interaction.followUp({ embeds: [noProcessEmbed] })
        return
      }

      // Obter estatísticas do processo antes de finalizar
      const processStats = await database.getProcessStats(activeProcess.id)
      const interviewStats = await database.getInterviewStats(activeProcess.id)

      // Finalizar o processo
      await database.endProcess(activeProcess.id, interaction.user.id)

      // Calcular duração do processo
      const startTime = new Date(activeProcess.started_at)
      const endTime = new Date()
      const durationDays = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24))

      const finalEmbed = new EmbedBuilder()
        .setTitle("🏁 Processo Seletivo Finalizado!")
        .setDescription(`O processo **${activeProcess.name}** foi finalizado com sucesso!`)
        .setColor(COLORS.SUCCESS)
        .addFields(
          {
            name: "📋 Informações do Processo",
            value: `**Nome:** ${activeProcess.name}\n**ID:** \`${activeProcess.id}\`\n**Duração:** ${durationDays} dias`,
            inline: false,
          },
          {
            name: "👥 Estatísticas de Participantes",
            value: `**Total:** ${processStats.total_participants}\n**✅ Aprovados:** ${processStats.approved}\n**❌ Rejeitados:** ${processStats.rejected}\n**🟡 Pendentes:** ${processStats.pending}`,
            inline: true,
          },
          {
            name: "🎤 Estatísticas de Entrevistas",
            value: `**Total:** ${interviewStats.total_interviews || 0}\n**✅ Concluídas:** ${interviewStats.completed || 0}\n**⏱️ Duração Média:** ${Math.round(interviewStats.avg_duration || 0)} min`,
            inline: true,
          },
          {
            name: "📊 Taxa de Aprovação",
            value: `${processStats.total_participants > 0 ? Math.round((processStats.approved / processStats.total_participants) * 100) : 0}%`,
            inline: true,
          },
          {
            name: "👤 Finalizado por",
            value: `${interaction.user.tag}`,
            inline: true,
          },
          {
            name: "📅 Período",
            value: `<t:${Math.floor(startTime.getTime() / 1000)}:d> até <t:${Math.floor(endTime.getTime() / 1000)}:d>`,
            inline: true,
          },
          {
            name: "💾 Dados Salvos",
            value: "Todos os dados foram preservados no histórico",
            inline: true,
          },
        )
        .setFooter({ text: "Hylex • Sistema de Processos" })
        .setTimestamp()
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))

      await interaction.followUp({ embeds: [finalEmbed] })

      console.log(
        `🏁 Processo seletivo finalizado: ID ${activeProcess.id} - ${activeProcess.name} por ${interaction.user.tag}`,
      )
    } catch (error) {
      console.error("Erro ao finalizar processo:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro ao Finalizar Processo")
        .setDescription("Ocorreu um erro ao finalizar o processo seletivo.")
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
