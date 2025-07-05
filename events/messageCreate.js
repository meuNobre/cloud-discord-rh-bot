const { Events, EmbedBuilder, ChannelType } = require("discord.js")

// IDs fixos
const GUILD_ID = "1245886288591196180"
const SUPORTE_CHANNEL_ID = "1250899735607513130"

// Cores do tema
const COLORS = {
  PRIMARY: "#00D9FF",
  SUCCESS: "#00FF88",
  ERROR: "#FF4757",
  WARNING: "#FFA502",
  SECONDARY: "#5F27CD",
  DARK: "#2C2C54",
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignora mensagens de bots
    if (message.author.bot) return

    // Acessa o sistema de tickets global
    const { activeTickets, threadUsers, database } = global.ticketSystem

    console.log(`📨 [DEBUG] Mensagem recebida:`)
    console.log(`   👤 Autor: ${message.author.tag} (${message.author.id})`)
    console.log(`   📍 Canal: ${message.channel.type} (${message.channel.id})`)
    console.log(`   💬 Conteúdo: ${message.content.slice(0, 50)}...`)

    const guild = message.client.guilds.cache.get(GUILD_ID)
    const supportChannel = guild?.channels.cache.get(SUPORTE_CHANNEL_ID)

    if (!guild || !supportChannel) {
      console.error("❌ Erro: Servidor ou canal de suporte não encontrado")
      return
    }

    // === MENSAGENS EM THREADS DE SUPORTE (EQUIPE RESPONDE) ===
    if (message.channel.isThread() && message.channel.parentId === SUPORTE_CHANNEL_ID) {
      console.log(`🔧 [DEBUG] Mensagem em thread de suporte detectada`)

      const threadId = message.channel.id
      const targetUserId = threadUsers.get(threadId)

      console.log(`🔍 [DEBUG] Buscando usuário para thread: ${threadId}`)
      console.log(`   👤 Usuário encontrado: ${targetUserId}`)

      if (!targetUserId) {
        console.log("❌ Usuário alvo não encontrado para este thread")
        return
      }

      try {
        // Busca o ticket no banco de dados
        const ticket = await database.getTicketByThread(threadId)
        console.log(`🎫 [DEBUG] Ticket encontrado:`, ticket ? `ID ${ticket.id}` : "Não encontrado")

        if (ticket) {
          // Salva a mensagem da equipe no banco
          await database.addTicketMessage(
            ticket.id,
            message.author.id,
            message.author.tag,
            message.content,
            "staff_response",
          )
          console.log(`💾 [DEBUG] Mensagem salva no banco de dados`)
        }

        const targetUser = await message.client.users.fetch(targetUserId)
        console.log(`👤 [DEBUG] Usuário alvo encontrado: ${targetUser.tag}`)

        // Embed da resposta da equipe
        const responseEmbed = new EmbedBuilder()
          .setTitle("💬 Resposta da Equipe de Suporte")
          .setDescription(message.content)
          .setColor(COLORS.PRIMARY)
          .addFields(
            {
              name: "👤 Respondido por",
              value: `${message.author.tag}`,
              inline: true,
            },
            {
              name: "💬 Responder",
              value: "Você pode responder diretamente aqui no DM",
              inline: true,
            },
            {
              name: "🎫 Ticket",
              value: `#${ticket ? ticket.id : "N/A"}`,
              inline: true,
            },
          )
          .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
          .setTimestamp()
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))

        await targetUser.send({ embeds: [responseEmbed] })
        console.log(`✅ [DEBUG] Resposta enviada para ${targetUser.tag}`)

        // Reação de confirmação na mensagem do thread
        await message.react("✅")
      } catch (error) {
        console.error("❌ Erro ao enviar resposta para o usuário:", error)
        try {
          await message.react("❌")
        } catch (reactionError) {
          console.error("❌ Erro ao adicionar reação:", reactionError)
        }
      }
      return
    }

    // === MENSAGENS EM DM DE USUÁRIOS COM TICKET ATIVO ===
    if (message.channel.type === ChannelType.DM) {
      console.log(`📩 [DEBUG] Mensagem DM detectada`)
      const userId = message.author.id
      const threadId = activeTickets.get(userId)

      console.log(`🔍 [DEBUG] Verificando ticket ativo para usuário: ${userId}`)
      console.log(`   🧵 Thread ID encontrado: ${threadId}`)

      if (!threadId) {
        console.log("❌ Usuário não tem ticket ativo")
        return
      }

      try {
        console.log(`🔍 [DEBUG] Buscando thread: ${threadId}`)
        const thread = await guild.channels.fetch(threadId)
        console.log(`🧵 [DEBUG] Thread encontrado:`, thread ? `${thread.name}` : "Não encontrado")

        if (!thread) {
          console.log("❌ Thread não encontrado")
          // Remove o ticket dos Maps
          activeTickets.delete(userId)
          threadUsers.delete(threadId)

          const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Ticket Não Encontrado")
            .setDescription("Seu ticket de suporte não foi encontrado ou foi encerrado.")
            .setColor(COLORS.ERROR)
            .addFields({
              name: "💡 Precisa de ajuda?",
              value: "Você pode criar um novo ticket usando o botão de suporte",
              inline: false,
            })
            .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
            .setTimestamp()

          try {
            await message.reply({ embeds: [errorEmbed] })
          } catch (replyError) {
            console.error("❌ Erro ao enviar mensagem de erro:", replyError)
          }
          return
        }

        if (thread.archived) {
          console.log("❌ Thread está arquivado")
          // Remove o ticket dos Maps
          activeTickets.delete(userId)
          threadUsers.delete(threadId)

          const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Ticket Encerrado")
            .setDescription("Seu ticket de suporte foi encerrado.")
            .setColor(COLORS.ERROR)
            .addFields({
              name: "💡 Precisa de ajuda?",
              value: "Você pode criar um novo ticket usando o botão de suporte",
              inline: false,
            })
            .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
            .setTimestamp()

          try {
            await message.reply({ embeds: [errorEmbed] })
          } catch (replyError) {
            console.error("❌ Erro ao enviar mensagem de erro:", replyError)
          }
          return
        }

        // Busca o ticket no banco de dados e salva a mensagem do usuário
        const ticket = await database.getTicketByThread(threadId)
        console.log(`🎫 [DEBUG] Ticket encontrado:`, ticket ? `ID ${ticket.id}` : "Não encontrado")

        if (ticket) {
          await database.addTicketMessage(
            ticket.id,
            message.author.id,
            message.author.tag,
            message.content,
            "user_message",
          )
          console.log(`💾 [DEBUG] Mensagem do usuário salva no banco`)
        }

        // Embed da resposta do usuário
        const userResponseEmbed = new EmbedBuilder()
          .setTitle("👤 Resposta do Usuário")
          .setDescription(message.content)
          .setColor(COLORS.SUCCESS)
          .addFields(
            {
              name: "👤 Enviado por",
              value: `${message.author.tag}`,
              inline: true,
            },
            {
              name: "🕒 Horário",
              value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
              inline: true,
            },
            {
              name: "🎫 Ticket",
              value: `#${ticket ? ticket.id : "N/A"}`,
              inline: true,
            },
          )
          .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
          .setTimestamp()
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))

        await thread.send({ embeds: [userResponseEmbed] })
        console.log(`✅ [DEBUG] Mensagem enviada para thread: ${thread.name}`)

        // Reação de confirmação na DM
        try {
          await message.react("✅")
        } catch (reactionError) {
          console.error("❌ Erro ao adicionar reação:", reactionError)
        }
      } catch (error) {
        console.error("❌ Erro ao enviar mensagem do usuário para o thread:", error)

        try {
          await message.react("❌")
        } catch (reactionError) {
          console.error("❌ Erro ao adicionar reação:", reactionError)
        }

        // Notifica o usuário sobre o erro
        try {
          const errorEmbed = new EmbedBuilder()
            .setTitle("❌ Erro ao Enviar Mensagem")
            .setDescription("Ocorreu um erro ao enviar sua mensagem para a equipe de suporte.")
            .setColor(COLORS.ERROR)
            .addFields({
              name: "🔄 Tente novamente",
              value: "Sua mensagem não foi enviada. Por favor, tente novamente.",
              inline: false,
            })
            .setFooter({ text: "iCloud Bot • Sistema de Suporte" })
            .setTimestamp()

          await message.reply({ embeds: [errorEmbed] })
        } catch (replyError) {
          console.error("❌ Erro ao enviar mensagem de erro:", replyError)
        }
      }
    }
  },
}