const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debug-candidatos")
    .setDescription("🔍 Debug dos candidatos disponíveis para entrevista"),

  async execute(interaction) {
    const database = global.ticketSystem.database

    await interaction.deferReply({ ephemeral: true })

    try {
      // Buscar processo ativo
      const activeProcess = await database.getActiveProcess()
      if (!activeProcess) {
        const noProcessEmbed = new EmbedBuilder()
          .setTitle("❌ Nenhum Processo Ativo")
          .setDescription("Não há processo seletivo ativo.")
          .setColor(COLORS.ERROR)
          .setTimestamp()

        await interaction.followUp({ embeds: [noProcessEmbed] })
        return
      }

      // Buscar todos os participantes
      const participants = await database.getProcessParticipants(activeProcess.id)

      // Buscar entrevistas
      const interviews = await database.getProcessInterviews(activeProcess.id)
      const interviewedParticipantIds = interviews.map((i) => i.participant_id)

      // Buscar convites
      const invites = await database.getRecentInvites(50)

      const debugEmbed = new EmbedBuilder()
        .setTitle("🔍 Debug de Candidatos")
        .setDescription(`Processo: **${activeProcess.name}** (ID: ${activeProcess.id})`)
        .setColor(COLORS.PRIMARY)
        .addFields({
          name: "📊 Estatísticas Gerais",
          value: `**Total de Participantes:** ${participants.length}\n**Total de Entrevistas:** ${interviews.length}\n**Total de Convites:** ${invites.length}`,
          inline: false,
        })

      // Listar participantes por status
      const byStatus = participants.reduce((acc, p) => {
        if (!acc[p.status]) acc[p.status] = []
        acc[p.status].push(p)
        return acc
      }, {})

      Object.entries(byStatus).forEach(([status, list]) => {
        const participantsList = list
          .map((p) => {
            const interviewed = interviewedParticipantIds.includes(p.id) ? "🎤" : "⏳"
            return `${interviewed} **${p.username}** (ID: ${p.id})`
          })
          .join("\n")

        debugEmbed.addFields({
          name: `📋 Status: ${status} (${list.length})`,
          value: participantsList || "Nenhum",
          inline: false,
        })
      })

      // Candidatos disponíveis para entrevista
      const available = participants.filter((p) => {
        const hasValidStatus = ["accepted", "pending"].includes(p.status)
        const notInterviewed = !interviewedParticipantIds.includes(p.id)
        return hasValidStatus && notInterviewed
      })

      debugEmbed.addFields({
        name: "✅ Disponíveis para Entrevista",
        value:
          available.length > 0
            ? available.map((p) => `• **${p.username}** (Status: ${p.status})`).join("\n")
            : "Nenhum candidato disponível",
        inline: false,
      })

      debugEmbed.setFooter({ text: "Hylex • Debug de Candidatos" }).setTimestamp()

      await interaction.followUp({ embeds: [debugEmbed] })
    } catch (error) {
      console.error("Erro no debug de candidatos:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro no Debug")
        .setDescription("Ocorreu um erro ao executar o debug.")
        .setColor(COLORS.ERROR)
        .setTimestamp()

      await interaction.followUp({ embeds: [errorEmbed] })
    }
  },
}
