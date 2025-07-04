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
    .setName("resumo-processo")
    .setDescription("📊 Mostra resumo detalhado dos processos seletivos")
    .addIntegerOption((option) =>
      option
        .setName("processo-id")
        .setDescription("ID do processo específico (deixe vazio para o processo ativo)")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Tipo de resumo")
        .setRequired(false)
        .addChoices(
          { name: "📋 Resumo Geral", value: "general" },
          { name: "👥 Participantes", value: "participants" },
          { name: "🎤 Entrevistas", value: "interviews" },
          { name: "📈 Histórico", value: "history" },
        ),
    ),

  async execute(interaction) {
    const processId = interaction.options.getInteger("processo-id")
    const tipo = interaction.options.getString("tipo") || "general"
    const database = global.ticketSystem.database

    await interaction.deferReply({ ephemeral: true })

    try {
      let targetProcess

      if (processId) {
        // Buscar processo específico
        const allProcesses = await database.getAllProcesses(100)
        targetProcess = allProcesses.find((p) => p.id === processId)

        if (!targetProcess) {
          const notFoundEmbed = new EmbedBuilder()
            .setTitle("❌ Processo Não Encontrado")
            .setDescription(`Processo com ID \`${processId}\` não foi encontrado.`)
            .setColor(COLORS.ERROR)
            .setTimestamp()

          await interaction.followUp({ embeds: [notFoundEmbed] })
          return
        }
      } else {
        // Buscar processo ativo
        targetProcess = await database.getActiveProcess()

        if (!targetProcess) {
          const noActiveEmbed = new EmbedBuilder()
            .setTitle("❌ Nenhum Processo Ativo")
            .setDescription("Não há processo ativo. Especifique um ID ou inicie um novo processo.")
            .setColor(COLORS.ERROR)
            .setTimestamp()

          await interaction.followUp({ embeds: [noActiveEmbed] })
          return
        }
      }

      // Obter estatísticas
      const processStats = await database.getProcessStats(targetProcess.id)
      const interviewStats = await database.getInterviewStats(targetProcess.id)

      switch (tipo) {
        case "general":
          await showGeneralSummary(interaction, targetProcess, processStats, interviewStats)
          break
        case "participants":
          await showParticipantsSummary(interaction, database, targetProcess)
          break
        case "interviews":
          await showInterviewsSummary(interaction, database, targetProcess)
          break
        case "history":
          await showHistorySummary(interaction, database)
          break
      }
    } catch (error) {
      console.error("Erro ao gerar resumo:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro no Resumo")
        .setDescription("Ocorreu um erro ao gerar o resumo do processo.")
        .setColor(COLORS.ERROR)
        .setTimestamp()

      await interaction.followUp({ embeds: [errorEmbed] })
    }
  },
}

async function showGeneralSummary(interaction, process, processStats, interviewStats) {
  const startTime = new Date(process.started_at)
  const endTime = process.ended_at ? new Date(process.ended_at) : new Date()
  const durationDays = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24))

  const statusEmoji = process.status === "active" ? "🟢" : process.status === "completed" ? "✅" : "❌"
  const statusText = process.status === "active" ? "Ativo" : process.status === "completed" ? "Finalizado" : "Cancelado"

  const summaryEmbed = new EmbedBuilder()
    .setTitle("📊 Resumo do Processo Seletivo")
    .setDescription(`**${process.name}**\n${process.description || "Sem descrição"}`)
    .setColor(COLORS.PRIMARY)
    .addFields(
      {
        name: "ℹ️ Informações Gerais",
        value: `**ID:** \`${process.id}\`\n**Status:** ${statusEmoji} ${statusText}\n**Duração:** ${durationDays} dias`,
        inline: true,
      },
      {
        name: "👥 Participantes",
        value: `**Total:** ${processStats.total_participants}\n**✅ Aprovados:** ${processStats.approved}\n**❌ Rejeitados:** ${processStats.rejected}\n**🟡 Pendentes:** ${processStats.pending}`,
        inline: true,
      },
      {
        name: "🎤 Entrevistas",
        value: `**Total:** ${interviewStats.total_interviews || 0}\n**✅ Concluídas:** ${interviewStats.completed || 0}\n**🔄 Em andamento:** ${interviewStats.in_progress || 0}`,
        inline: true,
      },
      {
        name: "📈 Métricas",
        value: `**Taxa de Aprovação:** ${processStats.total_participants > 0 ? Math.round((processStats.approved / processStats.total_participants) * 100) : 0}%\n**Nota Média:** ${processStats.average_score ? Math.round(processStats.average_score * 10) / 10 : "N/A"}\n**Duração Média Entrevista:** ${Math.round(interviewStats.avg_duration || 0)} min`,
        inline: false,
      },
      {
        name: "📅 Cronologia",
        value: `**Iniciado:** <t:${Math.floor(startTime.getTime() / 1000)}:F>\n**Iniciado por:** <@${process.started_by}>${process.ended_at ? `\n**Finalizado:** <t:${Math.floor(new Date(process.ended_at).getTime() / 1000)}:F>\n**Finalizado por:** <@${process.ended_by}>` : ""}`,
        inline: false,
      },
    )
    .setFooter({ text: "Hylex • Resumo de Processos" })
    .setTimestamp()

  await interaction.followUp({ embeds: [summaryEmbed] })
}

async function showParticipantsSummary(interaction, database, process) {
  const participants = await database.getProcessParticipants(process.id)

  if (participants.length === 0) {
    const noParticipantsEmbed = new EmbedBuilder()
      .setTitle("👥 Participantes do Processo")
      .setDescription("Nenhum participante encontrado neste processo.")
      .setColor(COLORS.WARNING)
      .setTimestamp()

    await interaction.followUp({ embeds: [noParticipantsEmbed] })
    return
  }

  const participantsEmbed = new EmbedBuilder()
    .setTitle(`👥 Participantes - ${process.name}`)
    .setDescription(`Total de ${participants.length} participantes`)
    .setColor(COLORS.SECONDARY)

  // Agrupar por status
  const byStatus = participants.reduce((acc, p) => {
    if (!acc[p.status]) acc[p.status] = []
    acc[p.status].push(p)
    return acc
  }, {})

  Object.entries(byStatus).forEach(([status, list]) => {
    const statusEmoji = {
      pending: "🟡",
      interviewing: "🔄",
      approved: "✅",
      rejected: "❌",
      withdrawn: "🚪",
    }

    const statusName = {
      pending: "Pendentes",
      interviewing: "Em Entrevista",
      approved: "Aprovados",
      rejected: "Rejeitados",
      withdrawn: "Desistentes",
    }

    const participantsList = list
      .slice(0, 10) // Limitar para não ficar muito longo
      .map((p) => `• **${p.username}** ${p.score > 0 ? `(${p.score}/10)` : ""}`)
      .join("\n")

    participantsEmbed.addFields({
      name: `${statusEmoji[status]} ${statusName[status]} (${list.length})`,
      value: participantsList + (list.length > 10 ? `\n... e mais ${list.length - 10}` : ""),
      inline: false,
    })
  })

  participantsEmbed.setFooter({ text: "Hylex • Participantes do Processo" }).setTimestamp()

  await interaction.followUp({ embeds: [participantsEmbed] })
}

async function showInterviewsSummary(interaction, database, process) {
  const interviews = await database.getProcessInterviews(process.id)

  if (interviews.length === 0) {
    const noInterviewsEmbed = new EmbedBuilder()
      .setTitle("🎤 Entrevistas do Processo")
      .setDescription("Nenhuma entrevista encontrada neste processo.")
      .setColor(COLORS.WARNING)
      .setTimestamp()

    await interaction.followUp({ embeds: [noInterviewsEmbed] })
    return
  }

  const interviewsEmbed = new EmbedBuilder()
    .setTitle(`🎤 Entrevistas - ${process.name}`)
    .setDescription(`Total de ${interviews.length} entrevistas`)
    .setColor(COLORS.PRIMARY)

  // Mostrar últimas 10 entrevistas
  const recentInterviews = interviews.slice(0, 10)

  const interviewsList = recentInterviews
    .map((interview) => {
      const statusEmoji = {
        scheduled: "📅",
        in_progress: "🔄",
        completed: "✅",
        cancelled: "❌",
      }

      const resultEmoji = {
        pending: "⏳",
        approved: "✅",
        rejected: "❌",
      }

      return `${statusEmoji[interview.status]} **${interview.participant_name}**\n   Entrevistador: ${interview.interviewer_name}\n   Status: ${interview.status} | Resultado: ${resultEmoji[interview.result]} ${interview.result}\n   ${interview.duration_minutes > 0 ? `Duração: ${interview.duration_minutes} min` : ""}`
    })
    .join("\n\n")

  interviewsEmbed.addFields({
    name: "📋 Entrevistas Recentes",
    value: interviewsList,
    inline: false,
  })

  if (interviews.length > 10) {
    interviewsEmbed.addFields({
      name: "ℹ️ Informação",
      value: `Mostrando as 10 entrevistas mais recentes de ${interviews.length} total.`,
      inline: false,
    })
  }

  interviewsEmbed.setFooter({ text: "Hylex • Entrevistas do Processo" }).setTimestamp()

  await interaction.followUp({ embeds: [interviewsEmbed] })
}

async function showHistorySummary(interaction, database) {
  const allProcesses = await database.getAllProcesses(10)

  if (allProcesses.length === 0) {
    const noHistoryEmbed = new EmbedBuilder()
      .setTitle("📈 Histórico de Processos")
      .setDescription("Nenhum processo encontrado no histórico.")
      .setColor(COLORS.WARNING)
      .setTimestamp()

    await interaction.followUp({ embeds: [noHistoryEmbed] })
    return
  }

  const historyEmbed = new EmbedBuilder()
    .setTitle("📈 Histórico de Processos Seletivos")
    .setDescription(`Últimos ${allProcesses.length} processos`)
    .setColor(COLORS.GOLD)

  for (const process of allProcesses.slice(0, 5)) {
    const stats = await database.getProcessStats(process.id)
    const statusEmoji = process.status === "active" ? "🟢" : process.status === "completed" ? "✅" : "❌"

    historyEmbed.addFields({
      name: `${statusEmoji} ${process.name} (ID: ${process.id})`,
      value: `**Participantes:** ${stats.total_participants} | **Aprovados:** ${stats.approved}\n**Período:** <t:${Math.floor(new Date(process.started_at).getTime() / 1000)}:d>${process.ended_at ? ` - <t:${Math.floor(new Date(process.ended_at).getTime() / 1000)}:d>` : " - Ativo"}`,
      inline: false,
    })
  }

  historyEmbed.setFooter({ text: "Hylex • Histórico de Processos" }).setTimestamp()

  await interaction.followUp({ embeds: [historyEmbed] })
}
