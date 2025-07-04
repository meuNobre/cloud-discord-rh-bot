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
    .setName("resumo-geral")
    .setDescription("📊 Resumo completo de todos os processos seletivos"),

  async execute(interaction) {
    const database = global.ticketSystem.database

    await interaction.deferReply({ ephemeral: true })

    try {
      // Buscar todos os processos
      const allProcesses = await database.getAllProcesses(50)

      if (allProcesses.length === 0) {
        const noProcessesEmbed = new EmbedBuilder()
          .setTitle("📊 Resumo Geral")
          .setDescription("Nenhum processo seletivo encontrado.")
          .setColor(COLORS.WARNING)
          .setTimestamp()

        await interaction.followUp({ embeds: [noProcessesEmbed] })
        return
      }

      // Calcular estatísticas gerais
      let totalCandidates = 0
      let totalApproved = 0
      let totalRejected = 0
      let totalPending = 0
      let totalInterviews = 0
      let completedProcesses = 0
      let activeProcesses = 0

      const processDetails = []

      for (const process of allProcesses) {
        const stats = await database.getProcessStats(process.id)
        const interviewStats = await database.getInterviewStats(process.id)

        totalCandidates += stats.total_participants || 0
        totalApproved += stats.approved || 0
        totalRejected += stats.rejected || 0
        totalPending += stats.pending || 0
        totalInterviews += interviewStats.total_interviews || 0

        if (process.status === "completed") completedProcesses++
        if (process.status === "active") activeProcesses++

        processDetails.push({
          ...process,
          stats,
          interviewStats,
        })
      }

      // Criar gráfico visual com texto
      const chartText = createTextChart({
        approved: totalApproved,
        rejected: totalRejected,
        pending: totalPending,
      })

      // Embed principal
      const summaryEmbed = new EmbedBuilder()
        .setTitle("📊 Resumo Geral dos Processos Seletivos")
        .setDescription("Estatísticas completas de todos os processos realizados")
        .setColor(COLORS.PRIMARY)
        .addFields(
          {
            name: "📈 Estatísticas Gerais",
            value: `**Total de Processos:** ${allProcesses.length}\n**✅ Finalizados:** ${completedProcesses}\n**🟢 Ativos:** ${activeProcesses}\n**❌ Cancelados:** ${allProcesses.length - completedProcesses - activeProcesses}`,
            inline: true,
          },
          {
            name: "👥 Candidatos",
            value: `**Total:** ${totalCandidates}\n**✅ Aprovados:** ${totalApproved}\n**❌ Rejeitados:** ${totalRejected}\n**🟡 Pendentes:** ${totalPending}`,
            inline: true,
          },
          {
            name: "🎤 Entrevistas",
            value: `**Total Realizadas:** ${totalInterviews}\n**Taxa de Aprovação:** ${totalCandidates > 0 ? Math.round((totalApproved / totalCandidates) * 100) : 0}%\n**Eficiência:** ${totalInterviews > 0 ? Math.round((totalApproved / totalInterviews) * 100) : 0}%`,
            inline: true,
          },
          {
            name: "📊 Distribuição Visual de Candidatos",
            value: chartText,
            inline: false,
          },
        )
        .setFooter({ text: "Hylex • Resumo Geral de Processos" })
        .setTimestamp()

      // Adicionar detalhes dos últimos 5 processos
      const recentProcesses = processDetails.slice(0, 5)
      if (recentProcesses.length > 0) {
        const processesText = recentProcesses
          .map((p) => {
            const statusEmoji = p.status === "active" ? "🟢" : p.status === "completed" ? "✅" : "❌"
            const duration = p.ended_at
              ? Math.ceil((new Date(p.ended_at) - new Date(p.started_at)) / (1000 * 60 * 60 * 24))
              : Math.ceil((new Date() - new Date(p.started_at)) / (1000 * 60 * 60 * 24))

            return `${statusEmoji} **${p.name}** (ID: ${p.id})\n   Candidatos: ${p.stats.total_participants} | Aprovados: ${p.stats.approved} | Duração: ${duration} dias`
          })
          .join("\n\n")

        summaryEmbed.addFields({
          name: "📋 Processos Recentes",
          value: processesText,
          inline: false,
        })
      }

      // Adicionar métricas de performance
      if (allProcesses.length > 1) {
        const avgCandidatesPerProcess = Math.round(totalCandidates / allProcesses.length)
        const avgApprovalRate = totalCandidates > 0 ? Math.round((totalApproved / totalCandidates) * 100) : 0
        const avgInterviewsPerProcess = Math.round(totalInterviews / allProcesses.length)

        summaryEmbed.addFields({
          name: "📈 Métricas de Performance",
          value: `**Média de Candidatos/Processo:** ${avgCandidatesPerProcess}\n**Taxa Média de Aprovação:** ${avgApprovalRate}%\n**Média de Entrevistas/Processo:** ${avgInterviewsPerProcess}`,
          inline: false,
        })
      }

      await interaction.followUp({ embeds: [summaryEmbed] })
    } catch (error) {
      console.error("Erro ao gerar resumo geral:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro no Resumo")
        .setDescription("Ocorreu um erro ao gerar o resumo geral.")
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

function createTextChart(data) {
  const total = data.approved + data.rejected + data.pending

  if (total === 0) {
    return "```\n📊 Nenhum dado disponível\n```"
  }

  // Calcular percentuais
  const approvedPercent = Math.round((data.approved / total) * 100)
  const rejectedPercent = Math.round((data.rejected / total) * 100)
  const pendingPercent = Math.round((data.pending / total) * 100)

  // Criar barras visuais (máximo 20 caracteres)
  const maxBarLength = 20
  const approvedBar = "█".repeat(Math.round((data.approved / total) * maxBarLength))
  const rejectedBar = "█".repeat(Math.round((data.rejected / total) * maxBarLength))
  const pendingBar = "█".repeat(Math.round((data.pending / total) * maxBarLength))

  let chart = "```\n"
  chart += "📊 DISTRIBUIÇÃO DE CANDIDATOS\n"
  chart += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

  if (data.approved > 0) {
    chart += `✅ Aprovados: ${data.approved} (${approvedPercent}%)\n`
    chart += `${approvedBar.padEnd(maxBarLength, "░")}\n\n`
  }

  if (data.rejected > 0) {
    chart += `❌ Rejeitados: ${data.rejected} (${rejectedPercent}%)\n`
    chart += `${rejectedBar.padEnd(maxBarLength, "░")}\n\n`
  }

  if (data.pending > 0) {
    chart += `🟡 Pendentes: ${data.pending} (${pendingPercent}%)\n`
    chart += `${pendingBar.padEnd(maxBarLength, "░")}\n\n`
  }

  chart += `📈 TOTAL: ${total} candidatos\n`
  chart += "```"

  return chart
}
