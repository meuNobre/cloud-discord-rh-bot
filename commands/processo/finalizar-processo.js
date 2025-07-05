const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
}

// Cache para evitar processamento duplicado
const processedInteractions = new Set()

module.exports = {
  data: new SlashCommandBuilder().setName("finalizar-processo").setDescription("🏁 Finaliza o processo seletivo ativo"),

  async execute(interaction) {
    // Verificações de segurança mais rigorosas
    const interactionId = `${interaction.id}_${interaction.user.id}_${Date.now()}`
    const interactionAge = Date.now() - interaction.createdTimestamp

    console.log(`🔍 [FINALIZAR-PROCESSO] Iniciando comando:`)
    console.log(`   👤 Usuário: ${interaction.user.tag}`)
    console.log(`   🆔 ID: ${interaction.id}`)
    console.log(`   ⏰ Idade: ${interactionAge}ms`)
    console.log(`   ✅ Replied: ${interaction.replied}`)
    console.log(`   ⏳ Deferred: ${interaction.deferred}`)

    // Verificar se a interação é muito antiga (mais rigoroso)
    if (interactionAge > 2000) {
      console.warn(`⚠️ [FINALIZAR-PROCESSO] Interação muito antiga (${interactionAge}ms), ignorando`)
      return
    }

    // Verificar se já foi processada
    if (processedInteractions.has(interactionId)) {
      console.warn(`⚠️ [FINALIZAR-PROCESSO] Interação já processada, ignorando`)
      return
    }

    // Verificar estado da interação
    if (interaction.replied || interaction.deferred) {
      console.warn(`⚠️ [FINALIZAR-PROCESSO] Interação já foi respondida/deferida, ignorando`)
      return
    }

    // Marcar como processada
    processedInteractions.add(interactionId)

    // Limpar cache antigo
    if (processedInteractions.size > 100) {
      const entries = Array.from(processedInteractions)
      entries.slice(0, 50).forEach((id) => processedInteractions.delete(id))
    }

    const database = global.ticketSystem.database

    try {
      console.log(`🔄 [FINALIZAR-PROCESSO] Tentando deferReply...`)

      // Usar Promise.race com timeout mais agressivo
      const deferPromise = interaction.deferReply({ ephemeral: true })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout no deferReply")), 1500),
      )

      await Promise.race([deferPromise, timeoutPromise])
      console.log(`✅ [FINALIZAR-PROCESSO] DeferReply bem-sucedido`)

      // Verificar novamente se ainda pode responder
      if (interaction.replied && !interaction.deferred) {
        console.warn(`⚠️ [FINALIZAR-PROCESSO] Estado inconsistente após deferReply`)
        return
      }

      // Verificar se existe um processo ativo
      console.log(`🔍 [FINALIZAR-PROCESSO] Verificando processo ativo...`)
      const activeProcess = await database.getActiveProcess()

      if (!activeProcess) {
        console.log(`❌ [FINALIZAR-PROCESSO] Nenhum processo ativo encontrado`)

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

        // Verificar se ainda pode responder
        if (interaction.deferred && !interaction.replied) {
          console.log(`📤 [FINALIZAR-PROCESSO] Enviando resposta de processo não encontrado...`)
          await interaction.followUp({ embeds: [noProcessEmbed] })
        }
        return
      }

      console.log(`✅ [FINALIZAR-PROCESSO] Processo ativo encontrado: ${activeProcess.name}`)

      // Obter estatísticas do processo antes de finalizar
      console.log(`📊 [FINALIZAR-PROCESSO] Obtendo estatísticas...`)
      const processStats = await database.getProcessStats(activeProcess.id)
      const interviewStats = await database.getInterviewStats(activeProcess.id)

      // Finalizar o processo
      console.log(`🏁 [FINALIZAR-PROCESSO] Finalizando processo...`)
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

      // Verificar se ainda pode responder
      if (interaction.deferred && !interaction.replied) {
        console.log(`📤 [FINALIZAR-PROCESSO] Enviando confirmação de finalização...`)
        await interaction.followUp({ embeds: [finalEmbed] })
      }

      console.log(
        `🏁 Processo seletivo finalizado: ID ${activeProcess.id} - ${activeProcess.name} por ${interaction.user.tag}`,
      )
    } catch (error) {
      console.error(`❌ [FINALIZAR-PROCESSO] Erro ao finalizar processo:`, error)

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Erro ao Finalizar Processo")
        .setDescription("Ocorreu um erro ao finalizar o processo seletivo.")
        .setColor(COLORS.ERROR)
        .addFields({
          name: "🔧 Detalhes",
          value: `\`${error.message}\``,
          inline: false,
        })
        .setTimestamp()

      // Tentar responder de forma mais defensiva
      try {
        if (!interaction.replied && !interaction.deferred) {
          console.log(`📤 [FINALIZAR-PROCESSO] Tentando reply direto com erro...`)
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
        } else if (interaction.deferred && !interaction.replied) {
          console.log(`📤 [FINALIZAR-PROCESSO] Tentando followUp com erro...`)
          await interaction.followUp({ embeds: [errorEmbed] })
        } else {
          console.warn(
            `⚠️ [FINALIZAR-PROCESSO] Não pode responder erro - estado: replied=${interaction.replied}, deferred=${interaction.deferred}`,
          )
        }
      } catch (replyError) {
        console.error(`❌ [FINALIZAR-PROCESSO] Erro ao responder com erro:`, replyError.message)
      }
    } finally {
      // Remover do cache após um tempo
      setTimeout(() => {
        processedInteractions.delete(interactionId)
      }, 30000) // 30 segundos
    }
  },
}
