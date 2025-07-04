const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("entrevistar")
    .setDescription("🎤 Iniciar entrevista com um candidato")
    .addStringOption((option) =>
      option
        .setName("candidato")
        .setDescription("Selecione o candidato para entrevistar")
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const database = global.ticketSystem.database
    const focusedValue = interaction.options.getFocused()

    try {
      // Buscar processo ativo
      const activeProcess = await database.getActiveProcess()
      if (!activeProcess) {
        await interaction.respond([])
        return
      }

      // Buscar participantes do processo ativo
      const participants = await database.getProcessParticipants(activeProcess.id)

      // Buscar entrevistas já realizadas
      const interviews = await database.getProcessInterviews(activeProcess.id)
      const interviewedParticipantIds = interviews.map((i) => i.participant_id)

      // Filtrar participantes disponíveis para entrevista
      const availableCandidates = participants.filter((p) => {
        // Deve ter status 'accepted' ou 'pending' e não ter sido entrevistado
        const hasValidStatus = ["accepted", "pending"].includes(p.status)
        const notInterviewed = !interviewedParticipantIds.includes(p.id)
        const matchesSearch = p.username.toLowerCase().includes(focusedValue.toLowerCase())

        return hasValidStatus && notInterviewed && matchesSearch
      })

      console.log(`🔍 [AUTOCOMPLETE] Processo: ${activeProcess.id}`)
      console.log(`👥 [AUTOCOMPLETE] Total participantes: ${participants.length}`)
      console.log(`🎤 [AUTOCOMPLETE] Já entrevistados: ${interviewedParticipantIds.length}`)
      console.log(`✅ [AUTOCOMPLETE] Disponíveis: ${availableCandidates.length}`)

      const choices = availableCandidates.slice(0, 25).map((participant) => ({
        name: `${participant.username} (Status: ${participant.status})`,
        value: participant.id.toString(),
      }))

      await interaction.respond(choices)
    } catch (error) {
      console.error("Erro no autocomplete:", error)
      await interaction.respond([])
    }
  },

  async execute(interaction) {
    const participantId = Number.parseInt(interaction.options.getString("candidato"))
    const database = global.ticketSystem.database

    await interaction.deferReply({ ephemeral: true })

    try {
      // Verificar processo ativo
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

      // Buscar participante
      const participants = await database.getProcessParticipants(activeProcess.id)
      const participant = participants.find((p) => p.id === participantId)

      if (!participant) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle("❌ Participante Não Encontrado")
          .setDescription("Participante não encontrado no processo ativo.")
          .setColor(COLORS.ERROR)
          .setTimestamp()

        await interaction.followUp({ embeds: [notFoundEmbed] })
        return
      }

      // Verificar se já foi entrevistado
      const interviews = await database.getProcessInterviews(activeProcess.id)
      const existingInterview = interviews.find((i) => i.participant_id === participantId)

      if (existingInterview) {
        const alreadyInterviewedEmbed = new EmbedBuilder()
          .setTitle("⚠️ Já Entrevistado")
          .setDescription(`${participant.username} já foi entrevistado.`)
          .setColor(COLORS.WARNING)
          .addFields({
            name: "📋 Detalhes da Entrevista",
            value: `**Status:** ${existingInterview.status}\n**Resultado:** ${existingInterview.result}\n**Entrevistador:** ${existingInterview.interviewer_name}`,
            inline: false,
          })
          .setTimestamp()

        await interaction.followUp({ embeds: [alreadyInterviewedEmbed] })
        return
      }

      // Criar e iniciar entrevista automaticamente
      const interviewId = await database.createInterview(
        activeProcess.id,
        participantId,
        interaction.user.id,
        interaction.user.tag,
      )

      await database.startInterview(interviewId)

      // Atualizar status do participante
      await database.updateParticipantStatus(participantId, "interviewing", "interview")

      const startEmbed = new EmbedBuilder()
        .setTitle("🎤 Entrevista Iniciada!")
        .setDescription(`Entrevista com **${participant.username}** iniciada com sucesso!`)
        .setColor(COLORS.SUCCESS)
        .addFields(
          {
            name: "🆔 ID da Entrevista",
            value: `\`${interviewId}\``,
            inline: true,
          },
          {
            name: "👤 Candidato",
            value: participant.username,
            inline: true,
          },
          {
            name: "🎤 Entrevistador",
            value: interaction.user.tag,
            inline: true,
          },
          {
            name: "⏰ Iniciada em",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
          },
          {
            name: "⏭️ Para Finalizar",
            value: "Clique no botão abaixo quando terminar a entrevista",
            inline: false,
          },
        )
        .setFooter({ text: "Hylex • Sistema de Entrevistas" })
        .setTimestamp()

      // Botão para finalizar entrevista
      const finishButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`finish_interview_${interviewId}`)
          .setLabel("⏹️ Finalizar Entrevista")
          .setStyle(ButtonStyle.Primary),
      )

      await interaction.followUp({
        embeds: [startEmbed],
        components: [finishButton],
      })

      console.log(`🎤 Entrevista iniciada: ID ${interviewId} - ${participant.username} com ${interaction.user.tag}`)
    } catch (error) {
      console.error("Erro ao iniciar entrevista:", error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro na Entrevista")
        .setDescription("Ocorreu um erro ao iniciar a entrevista.")
        .setColor(COLORS.ERROR)
        .setTimestamp()

      await interaction.followUp({ embeds: [errorEmbed] })
    }
  },
}
