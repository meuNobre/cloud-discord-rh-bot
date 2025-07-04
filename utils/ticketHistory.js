const { EmbedBuilder, AttachmentBuilder } = require("discord.js")

/**
 * Salva o histórico completo de um ticket
 */
async function saveTicketHistory(database, ticket, channel) {
  try {
    console.log(`📋 Salvando histórico do ticket #${ticket.id}`)

    // Buscar todas as mensagens do canal
    const messages = []
    let lastMessageId = null

    // Coletar mensagens em lotes
    while (true) {
      const options = { limit: 100 }
      if (lastMessageId) {
        options.before = lastMessageId
      }

      const fetchedMessages = await channel.messages.fetch(options)
      if (fetchedMessages.size === 0) break

      messages.push(...fetchedMessages.values())
      lastMessageId = fetchedMessages.last().id
    }

    // Ordenar mensagens por data (mais antigas primeiro)
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)

    console.log(`📨 Coletadas ${messages.length} mensagens`)

    // Salvar cada mensagem no banco
    let userMessages = 0
    let staffResponses = 0

    for (const message of messages) {
      const messageType = message.author.bot
        ? "bot_message"
        : message.author.id === ticket.user_id
          ? "user_message"
          : "staff_response"

      if (messageType === "user_message") userMessages++
      if (messageType === "staff_response") staffResponses++

      // Processar anexos
      const attachments =
        message.attachments.size > 0
          ? message.attachments.map((att) => ({
              name: att.name,
              url: att.url,
              size: att.size,
              contentType: att.contentType,
            }))
          : null

      // Processar embeds
      const embedData =
        message.embeds.length > 0
          ? message.embeds.map((embed) => ({
              title: embed.title,
              description: embed.description,
              color: embed.color,
              fields: embed.fields,
              footer: embed.footer,
              timestamp: embed.timestamp,
            }))
          : null

      await database.addTicketMessage(
        ticket.id,
        message.author.id,
        message.author.tag,
        message.content || "[Sem conteúdo de texto]",
        messageType,
        attachments,
        embedData,
      )
    }

    // Calcular estatísticas
    const createdAt = new Date(ticket.created_at || Date.now())
    const closedAt = new Date()
    const resolutionTimeMinutes = Math.round((closedAt - createdAt) / (1000 * 60))

    // Salvar resumo do ticket
    const summary = {
      ticket_id: ticket.id,
      user_id: ticket.user_id,
      user_name: ticket.username,
      reason: ticket.reason,
      created_at: createdAt.toISOString(),
      closed_at: closedAt.toISOString(),
      total_messages: messages.length,
      staff_responses: staffResponses,
      user_messages: userMessages,
      resolution_time_minutes: resolutionTimeMinutes,
    }

    await database.saveTicketSummary(summary)

    console.log(`✅ Histórico salvo: ${messages.length} mensagens, ${resolutionTimeMinutes} minutos`)
    return summary
  } catch (error) {
    console.error("❌ Erro ao salvar histórico:", error)
    throw error
  }
}

/**
 * Envia log do ticket para o canal de logs
 */
async function sendTicketLog(client, ticket, closedByUserId, summary) {
  try {
    const LOG_CHANNEL_ID = "1246106949930582066"
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID)

    if (!logChannel) {
      console.error(`❌ Canal de logs não encontrado: ${LOG_CHANNEL_ID}`)
      return
    }

    // Buscar usuário que fechou o ticket
    let closedByUser = "Sistema"
    try {
      const user = await client.users.fetch(closedByUserId)
      closedByUser = user.tag
    } catch (error) {
      console.warn("⚠️ Não foi possível buscar usuário que fechou o ticket")
    }

    // Criar embed do log
    const logEmbed = new EmbedBuilder()
      .setTitle(`🎫 Ticket #${ticket.id} Encerrado`)
      .setColor("#FF6B6B")
      .addFields(
        {
          name: "👤 Usuário",
          value: `${ticket.username} (${ticket.user_id})`,
          inline: true,
        },
        {
          name: "🔒 Encerrado por",
          value: closedByUser,
          inline: true,
        },
        {
          name: "📝 Motivo Original",
          value: ticket.reason.length > 100 ? ticket.reason.substring(0, 100) + "..." : ticket.reason,
          inline: false,
        },
        {
          name: "📊 Estatísticas",
          value: `**Mensagens:** ${summary.total_messages}\n**Respostas da Equipe:** ${summary.staff_responses}\n**Mensagens do Usuário:** ${summary.user_messages}`,
          inline: true,
        },
        {
          name: "⏱️ Tempo de Resolução",
          value: `${summary.resolution_time_minutes} minutos`,
          inline: true,
        },
        {
          name: "📅 Período",
          value: `**Criado:** <t:${Math.floor(new Date(summary.created_at).getTime() / 1000)}:f>\n**Encerrado:** <t:${Math.floor(new Date(summary.closed_at).getTime() / 1000)}:f>`,
          inline: false,
        },
      )
      .setFooter({ text: "iCloud Bot • Sistema de Tickets" })
      .setTimestamp()

    // Buscar mensagens do banco para criar arquivo de texto
    const messages = await global.ticketSystem.database.getTicketMessages(ticket.id)

    // Criar conteúdo do arquivo de texto
    let textContent = `=== HISTÓRICO DO TICKET #${ticket.id} ===\n\n`
    textContent += `Usuário: ${ticket.username} (${ticket.user_id})\n`
    textContent += `Motivo: ${ticket.reason}\n`
    textContent += `Criado em: ${new Date(summary.created_at).toLocaleString("pt-BR")}\n`
    textContent += `Encerrado em: ${new Date(summary.closed_at).toLocaleString("pt-BR")}\n`
    textContent += `Duração: ${summary.resolution_time_minutes} minutos\n`
    textContent += `Total de mensagens: ${summary.total_messages}\n\n`
    textContent += `${"=".repeat(50)}\n\n`

    // Adicionar mensagens
    for (const message of messages) {
      const timestamp = new Date(message.created_at).toLocaleString("pt-BR")
      const messageType =
        message.message_type === "user_message"
          ? "👤 USUÁRIO"
          : message.message_type === "staff_response"
            ? "👮 STAFF"
            : "🤖 BOT"

      textContent += `[${timestamp}] ${messageType} - ${message.author_name}\n`
      textContent += `${message.content}\n`

      // Adicionar informações sobre anexos
      if (message.attachments) {
        try {
          const attachments = JSON.parse(message.attachments)
          textContent += `📎 Anexos: ${attachments.map((att) => att.name).join(", ")}\n`
        } catch (e) {
          // Ignorar erro de parse
        }
      }

      // Adicionar informações sobre embeds
      if (message.embed_data) {
        try {
          const embeds = JSON.parse(message.embed_data)
          textContent += `📋 Embeds: ${embeds.length} embed(s)\n`
        } catch (e) {
          // Ignorar erro de parse
        }
      }

      textContent += `\n${"-".repeat(30)}\n\n`
    }

    textContent += `=== FIM DO HISTÓRICO ===\n`
    textContent += `Relatório gerado automaticamente pelo iCloud Bot\n`
    textContent += `Data: ${new Date().toLocaleString("pt-BR")}`

    // Criar arquivo anexo
    const attachment = new AttachmentBuilder(Buffer.from(textContent, "utf-8"), {
      name: `ticket-${ticket.id}-historico.txt`,
    })

    // Enviar log
    await logChannel.send({
      embeds: [logEmbed],
      files: [attachment],
    })

    console.log(`📋 Log enviado para o canal ${LOG_CHANNEL_ID}`)
  } catch (error) {
    console.error("❌ Erro ao enviar log:", error)
  }
}

/**
 * Processa o fechamento completo de um ticket
 */
async function processTicketClosure(client, database, threadId, closedByUserId) {
  try {
    // Buscar dados do ticket
    const ticket = await database.getTicketByThread(threadId)
    if (!ticket) {
      throw new Error("Ticket não encontrado")
    }

    // Buscar o canal/thread
    const channel = client.channels.cache.get(threadId)
    if (!channel) {
      throw new Error("Canal não encontrado")
    }

    // Salvar histórico
    const summary = await saveTicketHistory(database, ticket, channel)

    // Enviar log
    await sendTicketLog(client, ticket, closedByUserId, summary)

    // Fechar ticket no banco
    await database.closeTicket(threadId, closedByUserId)

    console.log(`✅ Ticket #${ticket.id} processado completamente`)
    return summary
  } catch (error) {
    console.error("❌ Erro ao processar fechamento:", error)
    throw error
  }
}

module.exports = {
  saveTicketHistory,
  sendTicketLog,
  processTicketClosure,
}
